/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Host Resource & Safe Capacity Governor
 */

import React, { useState, useEffect } from 'react';
import {
  Gauge,
  Cpu,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ShieldAlert,
  Server,
  Zap,
  RefreshCw,
  Power,
  Layers,
} from 'lucide-react';
import { CapacityStatus, SystemStatusResponse, VirtualDevice } from '../types';

interface ResourceManagerViewProps {
  status: SystemStatusResponse | null;
  devices: VirtualDevice[];
  onRefresh: () => void;
  onStopAllRunning?: () => void;
}

export const ResourceManagerView: React.FC<ResourceManagerViewProps> = ({
  status,
  devices,
  onRefresh,
  onStopAllRunning,
}) => {
  const [capacity, setCapacity] = useState<CapacityStatus | null>(status?.capacity || null);
  const [maxConcurrentLimit, setMaxConcurrentLimit] = useState<number>(
    status?.settings?.maxConcurrentRunningDevices || 4
  );
  const [emergencyOverride, setEmergencyOverride] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/capacity')
      .then((r) => r.json())
      .then((data) => setCapacity(data))
      .catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveGovernorSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxConcurrentRunningDevices: maxConcurrentLimit,
          autoManageCapacity: true,
        }),
      });
      if (res.ok) {
        showToast('Capacity governor limits updated!');
        onRefresh();
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const runningDevices = devices.filter((d) => d.status === 'running');
  const stoppedDevices = devices.filter((d) => d.status === 'stopped');

  const totalHostRam = capacity?.totalHostRamMb ?? status?.hostMetrics?.totalMemMb ?? 0;
  const freeHostRam = capacity?.freeHostRamMb ?? status?.hostMetrics?.freeMemMb ?? 0;
  const usedHostRam = Math.max(0, totalHostRam - freeHostRam);
  const ramPercent = totalHostRam > 0 ? Math.round((usedHostRam / totalHostRam) * 100) : 0;

  const safeCapacity = capacity?.safeMaxConcurrentDevices ?? 0;
  const currentlyRunning = runningDevices.length;
  const isNearLimit = safeCapacity > 0 && currentlyRunning >= safeCapacity;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070a11] overflow-hidden text-slate-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 px-4 py-2 rounded-xl bg-cyan-950 border border-cyan-500/50 text-cyan-200 text-xs shadow-xl flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="px-6 py-4 bg-[#0a0e17] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
              Host Resource & Safe Capacity Governor
              <span className="text-[10px] font-mono-code px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                100+ AVD Safeguard Active
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Guarantees host stability by preventing memory overload and throttling excessive concurrent emulators.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {runningDevices.length > 0 && onStopAllRunning && (
            <button
              onClick={onStopAllRunning}
              className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/40 text-xs font-mono-code flex items-center gap-1.5 transition-all"
            >
              <Power className="w-3.5 h-3.5" />
              Stop All Active ({runningDevices.length})
            </button>
          )}

          <button
            onClick={() => {
              onRefresh();
              fetch('/api/capacity')
                .then((r) => r.json())
                .then((d) => setCapacity(d));
            }}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Warning Alert if Capacity Exceeded */}
      {isNearLimit && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-white">Capacity Warning:</span>{' '}
            {capacity?.warningMessage ||
              `Host concurrent threshold reached (${currentlyRunning}/${safeCapacity} active). Offload additional devices to distributed nodes or cloud clusters.`}
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Safe Max Concurrent */}
          <div className="p-4 rounded-xl bg-[#0c101b] border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-cyan-400" /> Safe Concurrent Limit
              </span>
              <span className="text-[10px] font-mono-code text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                GOVERNOR
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono-code">
              {safeCapacity} <span className="text-xs font-normal text-slate-500">instances</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Computed based on {totalHostRam} MB total RAM minus 3GB host OS reservation.
            </p>
          </div>

          {/* Card 2: Currently Running */}
          <div className="p-4 rounded-xl bg-[#0c101b] border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" /> Active Running
              </span>
              <span className="text-[10px] font-mono-code text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                LIVE
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono-code">
              {currentlyRunning} <span className="text-xs font-normal text-slate-500">/ {devices.length}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {stoppedDevices.length} registered devices idle in standby.
            </p>
          </div>

          {/* Card 3: Free Slots */}
          <div className="p-4 rounded-xl bg-[#0c101b] border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-400" /> Available Safe Slots
              </span>
            </div>
            <div className="text-2xl font-bold text-cyan-400 font-mono-code">
              {Math.max(0, safeCapacity - currentlyRunning)}{' '}
              <span className="text-xs font-normal text-slate-500">slots</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Safe to start without degrading audio/video framerates.
            </p>
          </div>

          {/* Card 4: Host RAM Usage */}
          <div className="p-4 rounded-xl bg-[#0c101b] border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-400" /> Host Memory
              </span>
              <span className="text-xs font-mono-code text-slate-300">{ramPercent}%</span>
            </div>
            <div className="text-2xl font-bold text-white font-mono-code">
              {Math.round(usedHostRam / 1024)} / {Math.round(totalHostRam / 1024)}{' '}
              <span className="text-xs font-normal text-slate-500">GB</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  ramPercent > 80 ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${ramPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Governor Configuration Card */}
        <div className="p-5 rounded-xl bg-[#0c101b] border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Concurrency Threshold Governor Controls</h3>
            </div>
            <button
              disabled={savingSettings}
              onClick={handleSaveGovernorSettings}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-950 transition-all disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Apply Limits'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono-code">
                <span className="text-slate-400">Concurrent Device Ceiling:</span>
                <span className="text-cyan-300 font-bold">{maxConcurrentLimit} Devices</span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                value={maxConcurrentLimit}
                onChange={(e) => setMaxConcurrentLimit(parseInt(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <p className="text-[11px] text-slate-500">
                Limits how many virtual devices can boot simultaneously on this machine.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-code">
                <span className="text-slate-400">Emergency Override:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emergencyOverride}
                    onChange={(e) => setEmergencyOverride(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600" />
                </label>
              </div>
              <p className="text-[11px] text-slate-500">
                Allows force booting beyond safe limits (caution: risk of OS stutter).
              </p>
            </div>
          </div>
        </div>

        {/* Distributed Architecture Explanation */}
        <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/60 space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-semibold text-white">How 100+ Device Architecture Operates</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400 leading-relaxed font-mono-code text-[11px]">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-slate-200 font-bold mb-1">1. Local Host (Node 01)</div>
              Runs your primary active emulators and UI rendering pipeline directly on this desktop.
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-slate-200 font-bold mb-1">2. Remote Agents (Node 02)</div>
              Connects to additional lab PCs on your LAN over high-speed RPC WebSocket streaming.
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-slate-200 font-bold mb-1">3. Cloud Android Pool</div>
              Auto-scales elastic ARM64 cloud instances for mass regression without touching local RAM.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
