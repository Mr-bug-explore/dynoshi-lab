/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real-Time Hardware & ADB Device Diagnostics Component
 * Triggers real backend probes for `adb devices -l`, `adb shell getprop`,
 * `com.android.vending`, and `com.google.android.youtube`, rendering live PASS/FAIL
 * verification steps inside a scrollable monospaced log panel.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Terminal,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Search,
  PackageCheck,
  Cpu,
  Usb,
  Clock,
  AlertTriangle,
  CloudUpload,
  Loader2,
} from 'lucide-react';
import { LiveDeviceDiagnosticsResult, VirtualDevice } from '../types';
import {
  buildDiagnosticVerificationSteps,
  DiagnosticStepId,
  DiagnosticVerificationStep,
  formatDiagnosticLogTranscript,
} from '../logic/diagnostics_log';
import { useFirebase } from './FirebaseProvider';

interface DeviceDiagnosticsProps {
  device: VirtualDevice | null;
}

interface StepApiResult {
  step: 'devices' | 'getprop' | 'playstore' | 'youtube';
  command: string;
  exitCode: number;
  passed: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  checkedAt: string;
  adbSerial: string | null;
  extra?: Record<string, any>;
}

const STEP_META: Array<{
  apiStep: 'devices' | 'getprop' | 'playstore' | 'youtube';
  id: DiagnosticStepId;
  label: string;
  defaultCmd: string;
}> = [
  {
    apiStep: 'devices',
    id: 'adb_devices',
    label: 'ADB Hardware Probe (adb devices -l)',
    defaultCmd: 'adb devices -l',
  },
  {
    apiStep: 'getprop',
    id: 'getprop',
    label: 'System Properties (adb shell getprop)',
    defaultCmd: 'adb shell getprop',
  },
  {
    apiStep: 'playstore',
    id: 'playstore',
    label: 'Play Store Package (com.android.vending)',
    defaultCmd: 'adb shell pm path com.android.vending',
  },
  {
    apiStep: 'youtube',
    id: 'youtube',
    label: 'YouTube Package (com.google.android.youtube)',
    defaultCmd: 'adb shell pm path com.google.android.youtube',
  },
];

export const DeviceDiagnostics: React.FC<DeviceDiagnosticsProps> = ({ device }) => {
  const { user, profileReady, saveDiagnosticSnapshot, cloudDiagnostics } = useFirebase();
  const [data, setData] = useState<LiveDeviceDiagnosticsResult | null>(null);
  const [steps, setSteps] = useState<DiagnosticVerificationStep[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoPoll, setAutoPoll] = useState<boolean>(false);
  const [propQuery, setPropQuery] = useState<string>('');
  const [showRawGetprop, setShowRawGetprop] = useState<boolean>(false);
  const [savingCloud, setSavingCloud] = useState<boolean>(false);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runDiagnostics = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    setCloudNotice(null);

    const nowIso = new Date().toISOString();
    setSteps(
      STEP_META.map((m) => ({
        id: m.id,
        label: m.label,
        command: m.defaultCmd,
        status: 'running',
        summary: 'Executing background probe...',
        rawOutput: '',
        checkedAt: nowIso,
      }))
    );

    try {
      const devParam = device?.id ? `&deviceId=${encodeURIComponent(device.id)}` : '';
      const qFull = device?.id ? `?deviceId=${encodeURIComponent(device.id)}` : '';

      const stepPromises = STEP_META.map(async (meta) => {
        const res = await fetch(`/api/adb/diagnostics/step?step=${meta.apiStep}${devParam}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`Step "${meta.apiStep}" returned HTTP ${res.status}`);
        }
        const stepData: StepApiResult = await res.json();
        if (!mountedRef.current) return stepData;

        const rawOutput = [stepData.stdout, stepData.stderr].filter(Boolean).join('\n').trim() || '(no output)';
        let summary = stepData.passed ? 'Verification passed' : 'Verification failed';
        if (meta.apiStep === 'devices') {
          summary = `${stepData.extra?.attachedCount ?? 0} attached ADB target(s)`;
        } else if (meta.apiStep === 'getprop') {
          const cnt = stepData.extra?.propertyCount ?? 0;
          summary = cnt > 0 ? `${cnt} system properties parsed` : 'No device properties returned';
        } else if (meta.apiStep === 'playstore' || meta.apiStep === 'youtube') {
          const paths: string[] = stepData.extra?.apkPaths || [];
          summary = stepData.passed
            ? `Installed (${paths.length} APK path)`
            : 'Package not installed or device unreachable';
        }

        setSteps((prev) =>
          prev.map((s) =>
            s.id === meta.id
              ? {
                  ...s,
                  command: stepData.command,
                  status: stepData.passed ? 'pass' : 'fail',
                  exitCode: stepData.exitCode,
                  durationMs: stepData.durationMs,
                  summary,
                  rawOutput,
                  checkedAt: stepData.checkedAt,
                }
              : s
          )
        );
        return stepData;
      });

      const fullPromise = fetch(`/api/adb/diagnostics${qFull}`, { cache: 'no-store' }).then(
        async (r) => {
          if (!r.ok) throw new Error(`Diagnostics endpoint returned HTTP ${r.status}`);
          return (await r.json()) as LiveDeviceDiagnosticsResult;
        }
      );

      const [fullData] = await Promise.all([fullPromise, ...stepPromises]);
      if (!mountedRef.current) return;
      setData(fullData);
      setSteps(buildDiagnosticVerificationSteps(fullData));
    } catch (err: any) {
      if (!mountedRef.current) return;
      setFetchError(err?.message || 'Failed to query live ADB diagnostics');
      setSteps((prev) =>
        prev.map((s) =>
          s.status === 'running'
            ? {
                ...s,
                status: 'fail',
                summary: err?.message || 'Probe aborted',
                rawOutput: err?.message || 'Request failed',
              }
            : s
        )
      );
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [device?.id]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  useEffect(() => {
    if (!autoPoll) return;
    const timer = setInterval(() => {
      runDiagnostics();
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPoll, runDiagnostics]);

  const handleSaveToCloud = async () => {
    if (!data || !user || !profileReady) return;
    setSavingCloud(true);
    setCloudNotice(null);
    try {
      const summary = formatDiagnosticLogTranscript(steps).slice(0, 3900);
      await saveDiagnosticSnapshot(data, summary);
      setCloudNotice('Saved diagnostic snapshot to Firestore.');
    } catch (err: any) {
      setCloudNotice(err?.message || 'Failed to save snapshot.');
    } finally {
      setSavingCloud(false);
    }
  };

  const filteredProps = useMemo(() => {
    if (!data?.getprop?.properties) return [];
    const entries = Object.entries(data.getprop.properties);
    const q = propQuery.trim().toLowerCase();
    if (!q) return entries.slice(0, 60);
    return entries.filter(
      ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
    );
  }, [data?.getprop?.properties, propQuery]);

  const logTranscript = useMemo(() => formatDiagnosticLogTranscript(steps), [steps]);
  const passedCount = steps.filter((s) => s.status === 'pass').length;
  const failedCount = steps.filter((s) => s.status === 'fail').length;

  return (
    <section
      aria-label="Device Diagnostics"
      className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 space-y-4 font-mono-code text-xs"
    >
      {/* Header & Real-Time Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <h2 className="font-tech text-sm font-bold text-slate-100 tracking-wide">
              DEVICE DIAGNOSTICS (LIVE ADB PROBE)
            </h2>
            <p className="text-[11px] text-slate-400">
              Executes <code className="text-cyan-300">adb devices -l</code>,{' '}
              <code className="text-cyan-300">adb shell getprop</code>, Play Store &amp; YouTube package checks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {data?.checkedAt && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(data.checkedAt).toLocaleTimeString()}
            </span>
          )}

          <button
            type="button"
            aria-pressed={autoPoll}
            onClick={() => setAutoPoll((p) => !p)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition flex items-center gap-1.5 ${
              autoPoll
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                autoPoll ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span>{autoPoll ? 'Auto-Poll 5s: ON' : 'Auto-Poll: OFF'}</span>
          </button>

          {user && profileReady && data && (
            <button
              type="button"
              disabled={savingCloud}
              onClick={handleSaveToCloud}
              className="px-2.5 py-1 rounded-lg bg-violet-950/80 hover:bg-violet-900/80 border border-violet-700/60 text-violet-200 text-[11px] flex items-center gap-1.5 transition"
              title={`Save snapshot to Firestore (${cloudDiagnostics.length} saved)`}
            >
              {savingCloud ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              <span>Save Snapshot</span>
            </button>
          )}

          <button
            type="button"
            disabled={isLoading}
            onClick={runDiagnostics}
            className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-[11px] font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Run Diagnostics</span>
          </button>
        </div>
      </div>

      {cloudNotice && (
        <div className="px-3 py-2 rounded-lg bg-violet-950/50 border border-violet-700/50 text-violet-200 text-[11px]">
          {cloudNotice}
        </div>
      )}

      {fetchError && (
        <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700/60 text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Verification Step Status Badges & Scrollable Monospaced Log Panel */}
      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-200">
            VERIFICATION STEPS &amp; MONOSPACED EXECUTION LOG
          </span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
              {passedCount} PASS
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700/50">
              {failedCount} FAIL
            </span>
          </div>
        </div>

        {/* Step-by-step Pass/Fail Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {steps.map((step) => (
            <div
              key={step.id}
              data-testid={`diag-step-${step.id}`}
              className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-[11px] ${
                step.status === 'pass'
                  ? 'bg-emerald-950/20 border-emerald-800/60'
                  : step.status === 'fail'
                  ? 'bg-rose-950/20 border-rose-800/50'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {step.status === 'pass' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : step.status === 'fail' ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-slate-200 font-semibold truncate">{step.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{step.summary}</div>
                </div>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 border ${
                  step.status === 'pass'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                    : step.status === 'fail'
                    ? 'bg-rose-950 text-rose-300 border-rose-700/60'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-700/60'
                }`}
              >
                {step.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable Monospaced Log Panel */}
        <div
          role="log"
          aria-label="Diagnostic execution log"
          className="p-3 rounded-lg bg-black border border-slate-800/90 max-h-60 overflow-y-auto font-mono-code text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap"
        >
          {logTranscript || 'Waiting for diagnostic probe execution...'}
        </div>
      </div>

      {!data ? (
        <div className="p-4 text-center text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Collecting structured hardware properties...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. `adb devices -l` Host Probe */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <Usb className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Attached Hardware (`adb devices -l`)</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span
                  className={`px-1.5 py-0.5 rounded uppercase ${
                    data.adbDevices.attachedCount > 0
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                      : 'bg-amber-950 text-amber-300 border border-amber-700/50'
                  }`}
                >
                  {data.adbDevices.attachedCount} Attached
                </span>
                <span className="text-slate-500">
                  exit={data.adbDevices.exitCode} • {data.adbDevices.durationMs}ms
                </span>
              </div>
            </div>

            {data.adbDevices.devices.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {data.adbDevices.devices.map((d) => (
                  <div
                    key={d.id}
                    className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="text-slate-100 font-semibold truncate">{d.id}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {d.model || d.product || d.device || 'Android Device'}
                      </div>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase shrink-0 ${
                        d.state === 'device'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/40'
                          : 'bg-rose-950 text-rose-300 border border-rose-700/40'
                      }`}
                    >
                      {d.state}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Package Verification (`com.android.vending` & `com.google.android.youtube`) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold px-0.5">
              <PackageCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. Google Play Store &amp; YouTube Package Verification</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  title: 'Google Play Store',
                  pkg: data.packages.playStore,
                },
                {
                  title: 'Official YouTube',
                  pkg: data.packages.youtube,
                },
              ].map(({ title, pkg }) => (
                <div
                  key={pkg.packageName}
                  className={`p-3 rounded-xl border space-y-2 ${
                    pkg.installed
                      ? 'bg-emerald-950/25 border-emerald-700/50'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {pkg.installed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-100 truncate">{title}</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase shrink-0 ${
                        pkg.installed
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                          : 'bg-rose-950/70 text-rose-300 border border-rose-700/50'
                      }`}
                    >
                      {pkg.installed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>

                  {pkg.installed ? (
                    <div className="p-2 rounded bg-black/80 border border-emerald-900/50 text-[10px] text-emerald-300 break-all">
                      {pkg.apkPaths.map((p) => (
                        <div key={p}>{p}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 rounded bg-black/80 border border-slate-900 text-[10px] text-slate-400 break-words">
                      {pkg.stderr || pkg.stdout || `exit=${pkg.exitCode}`}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>pkg: {pkg.packageName}</span>
                    <span>
                      exit={pkg.exitCode} • {pkg.durationMs}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. `adb shell getprop` System Properties Inspector */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>3. System Properties (`adb shell getprop`)</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-400">
                  {data.getprop.propertyCount} props • exit={data.getprop.exitCode} • {data.getprop.durationMs}ms
                </span>
                {data.getprop.stdout && (
                  <button
                    type="button"
                    onClick={() => setShowRawGetprop((v) => !v)}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 hover:bg-slate-800"
                  >
                    {showRawGetprop ? 'Parsed Grid' : 'Raw stdout'}
                  </button>
                )}
              </div>
            </div>

            {data.getprop.propertyCount === 0 ? (
              <pre className="p-2.5 rounded bg-black border border-slate-900 text-[11px] text-slate-400 whitespace-pre-wrap">
                {data.getprop.stderr || data.getprop.stdout || 'No system properties available.'}
              </pre>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  {[
                    { k: 'Model', v: data.getprop.highlights.model },
                    { k: 'Manufacturer', v: data.getprop.highlights.manufacturer },
                    {
                      k: 'Android OS',
                      v: data.getprop.highlights.androidRelease
                        ? `${data.getprop.highlights.androidRelease} (SDK ${data.getprop.highlights.apiLevel || '?'})`
                        : undefined,
                    },
                    { k: 'CPU ABI', v: data.getprop.highlights.abi },
                    { k: 'Boot Completed', v: data.getprop.highlights.bootCompleted },
                    {
                      k: 'Environment',
                      v:
                        data.getprop.highlights.isEmulator === undefined
                          ? undefined
                          : data.getprop.highlights.isEmulator
                          ? 'QEMU Emulator'
                          : 'Physical Hardware',
                    },
                  ].map((item) => (
                    <div
                      key={item.k}
                      className="p-2 rounded bg-slate-900/90 border border-slate-800/80 min-w-0"
                    >
                      <div className="text-[10px] text-slate-500">{item.k}</div>
                      <div className="text-slate-200 font-semibold truncate">{item.v || 'N/A'}</div>
                    </div>
                  ))}
                </div>

                {showRawGetprop ? (
                  <pre className="p-2.5 rounded bg-black border border-slate-900 text-[10px] text-slate-300 whitespace-pre-wrap max-h-56 overflow-y-auto">
                    {data.getprop.stdout}
                  </pre>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={propQuery}
                        onChange={(e) => setPropQuery(e.target.value)}
                        placeholder="Filter getprop keys or values (e.g. ro.product, qemu, abi)..."
                        aria-label="Filter getprop properties"
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded bg-black border border-slate-900 divide-y divide-slate-900">
                      {filteredProps.length === 0 ? (
                        <div className="p-3 text-center text-slate-500 text-[11px]">
                          No properties match &quot;{propQuery}&quot;
                        </div>
                      ) : (
                        filteredProps.map(([key, val]) => (
                          <div
                            key={key}
                            className="px-2.5 py-1 flex items-start justify-between gap-3 text-[10px]"
                          >
                            <span className="text-cyan-400 shrink-0 max-w-[55%] break-all">{key}</span>
                            <span className="text-slate-300 text-right break-all">{val || '""'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
