/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Technical Verification & Google Play Audit Center
 * Runs genuine ADB verification commands and reports verbatim stdout, stderr, and exit codes.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Terminal,
  AlertTriangle,
  Globe,
  Film,
  Settings as SettingsIcon,
} from 'lucide-react';
import { VirtualDevice, DeviceVerificationReport } from '../types';

interface GoogleTestingViewProps {
  devices: VirtualDevice[];
  onRefreshDevices: () => void;
  onSelectDeviceForControl: (device: VirtualDevice) => void;
}

export const GoogleTestingView: React.FC<GoogleTestingViewProps> = ({
  devices,
  onRefreshDevices,
  onSelectDeviceForControl,
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [report, setReport] = useState<DeviceVerificationReport | null>(null);
  const [actionResult, setActionResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [urlInput, setUrlInput] = useState('https://www.youtube.com');

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];
  const activeReport = report && report.deviceId === selectedDevice?.id
    ? report
    : selectedDevice?.verificationReport || null;

  const handleRunVerification = async () => {
    if (!selectedDevice) return;
    setIsVerifying(true);
    setActionResult(null);
    try {
      const res = await fetch(`/api/devices/${selectedDevice.id}/verify`, { method: 'POST' });
      const data: DeviceVerificationReport = await res.json();
      setReport(data);
      onRefreshDevices();
    } catch (err: any) {
      setActionResult({ ok: false, msg: `Verification request failed: ${err.message}` });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLaunchRealPackage = async (packageName: string, label: string) => {
    if (!selectedDevice) return;
    setActionResult(null);
    const res = await fetch(`/api/devices/${selectedDevice.id}/apps/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageName, appName: label }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      setActionResult({ ok: true, msg: `Launched real package ${packageName}: ${data.output || 'OK'}` });
    } else {
      setActionResult({ ok: false, msg: data.error || `Failed to launch ${packageName}` });
    }
  };

  const handleOpenUrl = async () => {
    if (!selectedDevice || !urlInput.trim()) return;
    setActionResult(null);
    const res = await fetch(`/api/devices/${selectedDevice.id}/open-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      setActionResult({ ok: true, msg: `Opened ${urlInput} in Android Browser` });
    } else {
      setActionResult({ ok: false, msg: data.error || 'Failed to open URL via ADB' });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070a11] overflow-hidden text-slate-200">
      {/* Header */}
      <div className="px-6 py-4 bg-[#0a0e17] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-wide">
              Technical Verification & Google Play Audit Center
            </h1>
            <p className="text-xs text-slate-400">
              Executes real ADB commands (`adb devices -l`, `getprop`, `pm list packages`, `ping`, `dumpsys`) and shows verbatim command outputs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedDevice?.id || ''}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            aria-label="Target device for verification"
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-mono-code max-w-[260px]"
          >
            {devices.length === 0 ? (
              <option value="">No devices registered</option>
            ) : (
              devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.adbSerial || 'No ADB Serial'})
                </option>
              ))
            )}
          </select>

          {selectedDevice && (
            <>
              <button
                disabled={isVerifying}
                onClick={handleRunVerification}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Run Real ADB Verification</span>
              </button>

              <button
                onClick={() => onSelectDeviceForControl(selectedDevice)}
                className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/40 text-cyan-300 text-xs font-mono-code flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Screen
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* Notice on Authentic Google Play & YouTube */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300 space-y-1.5">
          <div className="font-semibold text-cyan-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Certified Google Play & YouTube Requirement</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Genuine Google Play Store (<code className="text-slate-200">com.android.vending</code>) and YouTube (
            <code className="text-slate-200">com.google.android.youtube</code>) require either a certified physical Android phone or an official Android Emulator AVD created from a <code className="text-slate-200">google_apis_playstore</code> system image. Sign in directly on the live Android screen after launching Play Store.
          </p>
        </div>

        {/* Real Action Bar */}
        {selectedDevice && (
          <div className="p-4 rounded-xl bg-[#0c101b] border border-slate-800 space-y-3">
            <div className="text-xs font-mono-code text-slate-400 uppercase font-semibold">
              Direct Real App & Browser Actions ({selectedDevice.adbSerial || 'Unattached'})
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleLaunchRealPackage('com.android.vending', 'Google Play Store')}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 text-xs font-mono-code flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Launch Play Store (`com.android.vending`)</span>
              </button>

              <button
                onClick={() => handleLaunchRealPackage('com.google.android.youtube', 'YouTube')}
                className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-700/50 text-red-300 text-xs font-mono-code flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Launch YouTube (`com.google.android.youtube`)</span>
              </button>

              <button
                onClick={() => handleLaunchRealPackage('com.android.settings', 'Android Settings')}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono-code flex items-center gap-1.5"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>Launch Settings</span>
              </button>

              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono-code text-slate-200 w-56"
                />
                <button
                  onClick={handleOpenUrl}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono-code flex items-center gap-1"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Open URL</span>
                </button>
              </div>
            </div>

            {actionResult && (
              <div
                className={`p-2.5 rounded-lg text-xs font-mono-code border ${
                  actionResult.ok
                    ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-300'
                    : 'bg-rose-950/50 border-rose-700/50 text-rose-300'
                }`}
              >
                {actionResult.msg}
              </div>
            )}
          </div>
        )}

        {/* Verbatim Verification Output */}
        {!selectedDevice ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 text-slate-500 font-mono-code text-xs">
            No Android device selected or attached. Connect a real device or boot a local AVD first.
          </div>
        ) : !activeReport ? (
          <div className="p-10 text-center rounded-xl border border-dashed border-slate-800 text-slate-400 font-mono-code text-xs space-y-2">
            <Terminal className="w-8 h-8 text-slate-600 mx-auto" />
            <div>Click &quot;Run Real ADB Verification&quot; to execute live ADB diagnostic checks and inspect verbatim results.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Strip */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4 font-mono-code text-xs">
              <div className="flex items-center gap-2">
                {activeReport.overallPassed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <span className="font-bold text-white">
                  Overall Verification: {activeReport.overallPassed ? 'PASSED' : 'FAILED / INCOMPLETE'}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px]">
                <span>Serial: <strong className="text-cyan-300">{activeReport.adbSerial}</strong></span>
                <span>Booted: <strong className={activeReport.bootCompleted ? 'text-emerald-400' : 'text-rose-400'}>{String(activeReport.bootCompleted)}</strong></span>
                <span>Play Store: <strong className={activeReport.hasPlayStore ? 'text-emerald-400' : 'text-amber-400'}>{activeReport.hasPlayStore ? 'Verified' : 'Absent'}</strong></span>
                <span>YouTube: <strong className={activeReport.hasYouTube ? 'text-emerald-400' : 'text-amber-400'}>{activeReport.hasYouTube ? 'Verified' : 'Absent'}</strong></span>
                <span>Network: <strong className={activeReport.networkConnected ? 'text-emerald-400' : 'text-rose-400'}>{activeReport.networkConnected ? 'Online' : 'Offline'}</strong></span>
              </div>
            </div>

            {/* Individual Verbatim Check Results */}
            <div className="space-y-2">
              {activeReport.checks.map((chk) => (
                <div key={chk.id} className="p-3.5 rounded-xl bg-[#0c101b] border border-slate-800 space-y-2 font-mono-code text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {chk.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-100">{chk.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      exit={chk.exitCode} • {chk.durationMs}ms
                    </span>
                  </div>
                  <div className="text-[11px] text-cyan-400">$ {chk.command}</div>
                  {(chk.stdout || chk.stderr) && (
                    <pre className="p-2.5 rounded bg-black border border-slate-900 text-[11px] text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {chk.stdout || chk.stderr}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
