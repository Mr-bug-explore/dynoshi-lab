/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real Host SDK, Virtualization & Settings View
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Palette,
  Layers,
  Save,
  Smartphone,
  Cpu,
  XCircle,
} from 'lucide-react';
import { LabSettings, SystemStatusResponse } from '../types';

interface SettingsViewProps {
  settings: LabSettings | null;
  status: SystemStatusResponse | null;
  onSaveSettings: (settings: Partial<LabSettings>) => void;
  onDetectSdk: (customPath?: string) => Promise<any>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  status,
  onSaveSettings,
  onDetectSdk,
}) => {
  const [androidSdkPath, setAndroidSdkPath] = useState(settings?.androidSdkPath || '');
  const [adbPath, setAdbPath] = useState(settings?.adbPath || '');
  const [emulatorPath, setEmulatorPath] = useState(settings?.emulatorPath || '');
  const [labMode, setLabMode] = useState<LabSettings['labMode']>(
    settings?.labMode || 'real_adb_and_emulator'
  );
  const [theme, setTheme] = useState<LabSettings['theme']>(settings?.theme || 'cyber_blue');
  const [logRetentionDays] = useState(settings?.logRetentionDays || 14);
  const [autoRefreshIntervalMs, setAutoRefreshIntervalMs] = useState(
    settings?.autoRefreshIntervalMs || 3000
  );
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionFeedback, setDetectionFeedback] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setAndroidSdkPath(settings.androidSdkPath || '');
      setAdbPath(settings.adbPath || '');
      setEmulatorPath(settings.emulatorPath || '');
      setLabMode(settings.labMode || 'real_adb_and_emulator');
      setTheme(settings.theme || 'cyber_blue');
      setAutoRefreshIntervalMs(settings.autoRefreshIntervalMs || 3000);
    }
  }, [settings]);

  const handleRunAutoDetect = async () => {
    setIsDetecting(true);
    setDetectionFeedback('Probing host PATH, ./tools/, ANDROID_SDK_ROOT, and KVM/WHPX virtualization...');
    try {
      const result = await onDetectSdk(androidSdkPath);
      setDetectionFeedback(result.message);
      if (result.sdkPath) setAndroidSdkPath(result.sdkPath);
      if (result.adbPath) setAdbPath(result.adbPath);
      if (result.diagnostics?.emulatorPath) setEmulatorPath(result.diagnostics.emulatorPath);
    } catch (err: any) {
      setDetectionFeedback(`Detection error: ${err.message}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      androidSdkPath,
      adbPath,
      emulatorPath,
      labMode,
      theme,
      logRetentionDays: Number(logRetentionDays),
      autoRefreshIntervalMs: Number(autoRefreshIntervalMs),
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const isRealAdb = status?.adb?.isAdbAvailable;
  const diag = status?.diagnostics;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              SETTINGS & HOST SDK DIAGNOSTICS
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              REAL ADB / SDK
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure host Android SDK platform-tools, official Emulator / AVD paths, hardware virtualization diagnostics, and strict mode policy.
          </p>
        </div>

        {saveSuccess && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-500/50 text-xs text-emerald-300 font-mono-code flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Settings Saved Successfully</span>
          </div>
        )}
      </div>

      {/* Live Host Diagnostics Grid */}
      {diag && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h2 className="font-tech text-base font-bold text-slate-100">
                Host Binary & Hardware Virtualization Probe ({diag.platform} / {diag.arch})
              </h2>
            </div>
            <button
              type="button"
              onClick={handleRunAutoDetect}
              disabled={isDetecting}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-tech font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
              <span>Re-Probe Host SDK</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono-code text-xs">
            {[
              { label: 'ADB Binary', ok: diag.adbInstalled, detail: diag.adbPath || 'Not found', sub: diag.adbVersion },
              { label: 'Android Emulator', ok: diag.emulatorInstalled, detail: diag.emulatorPath || 'Not installed', sub: diag.emulatorVersion },
              { label: 'KVM / WHPX Accel', ok: diag.kvmAvailable, detail: diag.kvmMessage, sub: 'Required for local x86_64 AVDs' },
              { label: 'avdmanager', ok: diag.avdmanagerInstalled, detail: diag.avdmanagerPath || 'Not found', sub: 'cmdline-tools' },
              { label: 'sdkmanager', ok: diag.sdkmanagerInstalled, detail: diag.sdkmanagerPath || 'Not found', sub: 'cmdline-tools' },
              { label: 'scrcpy', ok: diag.scrcpyInstalled, detail: diag.scrcpyPath || 'Optional (fallback screencap -p active)', sub: 'High-FPS stream' },
              { label: 'Appium CLI', ok: diag.appiumInstalled, detail: diag.appiumPath || 'Not installed', sub: diag.appiumVersion || 'UIAutomator2 driver host' },
            ].map((item) => (
              <div
                key={item.label}
                className={`p-3 rounded-xl border ${
                  item.ok
                    ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-200'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{item.label}</span>
                  {item.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="text-[10px] text-slate-400 break-all">{item.detail}</div>
                {item.sub && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{item.sub}</div>}
              </div>
            ))}
          </div>

          {diag.blockers.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-700/50 text-amber-200 text-xs font-mono-code space-y-1.5">
              <div className="font-bold flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Detected Environment Blockers</span>
              </div>
              {diag.blockers.map((b, i) => (
                <div key={i} className="text-[11px] leading-relaxed">
                  • {b}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Android SDK & ADB Bridge Card */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            <h2 className="font-tech text-base font-bold text-slate-100">
              Android SDK & Binary Paths
            </h2>
          </div>

          <div
            className={`p-4 rounded-xl border text-xs font-mono-code space-y-1 ${
              isRealAdb
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
            }`}
          >
            <div className="font-bold">
              {isRealAdb
                ? `Real ADB Online: ${status?.adb?.adbVersion}`
                : 'Real ADB Binary Not Found'}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {detectionFeedback ||
                (isRealAdb
                  ? 'All device discovery, shell execution, package management, and live framebuffers run through the host ADB daemon.'
                  : 'Install Android SDK Platform-Tools or configure the adb binary path below.')}
            </p>
          </div>

          <div className="space-y-3 font-mono-code text-xs">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Android SDK Root Directory (ANDROID_HOME / ANDROID_SDK_ROOT):
              </label>
              <input
                type="text"
                value={androidSdkPath}
                onChange={(e) => setAndroidSdkPath(e.target.value)}
                placeholder="e.g. C:\Users\<Username>\AppData\Local\Android\Sdk or /opt/android-sdk"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                ADB Binary Path:
              </label>
              <input
                type="text"
                value={adbPath}
                onChange={(e) => setAdbPath(e.target.value)}
                placeholder="e.g. ./tools/platform-tools/adb or %LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Emulator Binary Path:
              </label>
              <input
                type="text"
                value={emulatorPath}
                onChange={(e) => setEmulatorPath(e.target.value)}
                placeholder="e.g. %LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Operating Lab Mode */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Layers className="w-5 h-5 text-violet-400" />
            <h2 className="font-tech text-base font-bold text-slate-100">
              Strict Android Execution Policy
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono-code text-xs">
            <label
              className={`p-4 rounded-xl border cursor-pointer transition ${
                labMode === 'real_adb_and_emulator'
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400'
              }`}
            >
              <input
                type="radio"
                name="labMode"
                value="real_adb_and_emulator"
                checked={labMode === 'real_adb_and_emulator'}
                onChange={() => setLabMode('real_adb_and_emulator')}
                className="hidden"
              />
              <div className="font-tech font-bold text-sm text-slate-100 mb-1">
                Real ADB & Official Emulator
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Manages genuine physical USB/TCP-IP Android devices, official Android Emulator AVDs (with Google Play system images), and remote Host Node Agents.
              </p>
            </label>

            <label
              className={`p-4 rounded-xl border cursor-pointer transition ${
                labMode === 'strict_physical_only'
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400'
              }`}
            >
              <input
                type="radio"
                name="labMode"
                value="strict_physical_only"
                checked={labMode === 'strict_physical_only'}
                onChange={() => setLabMode('strict_physical_only')}
                className="hidden"
              />
              <div className="font-tech font-bold text-sm text-slate-100 mb-1">
                Physical / Remote ADB Only
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Restricts booting to already-attached physical USB/Wi-Fi Android hardware and skips local desktop AVD launches.
              </p>
            </label>
          </div>
        </div>

        {/* Theme & Performance Preferences */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Palette className="w-5 h-5 text-cyan-400" />
            <h2 className="font-tech text-base font-bold text-slate-100">
              Interface & Polling Preferences
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono-code text-xs">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">UI Accent Theme:</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
              >
                <option value="cyber_blue">Cyber Blue (Electric Cyan & Navy)</option>
                <option value="neon_violet">Neon Violet (Ultraviolet & Obsidian)</option>
                <option value="matrix_emerald">Matrix Emerald (Phosphor Green & Charcoal)</option>
                <option value="solar_amber">Solar Amber (Industrial Gold & Slate)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Telemetry Refresh Rate:</label>
              <select
                value={autoRefreshIntervalMs}
                onChange={(e) => setAutoRefreshIntervalMs(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
              >
                <option value="1000">1,000ms (High Frequency)</option>
                <option value="3000">3,000ms (Balanced Default)</option>
                <option value="5000">5,000ms (Low CPU Usage)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold text-sm tracking-wider flex items-center gap-2 shadow-xl shadow-cyan-600/30 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
