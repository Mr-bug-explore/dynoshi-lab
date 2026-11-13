/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real Laboratory Dashboard View
 */

import React, { useState } from 'react';
import {
  Smartphone,
  Play,
  Square,
  RotateCw,
  Eye,
  Activity,
  Cpu,
  HardDrive,
  LayoutGrid,
  List,
  Plus,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { VirtualDevice, SystemStatusResponse, LabTask } from '../types';
import { paginateItems } from '../logic/avd_engine';

interface DashboardViewProps {
  devices: VirtualDevice[];
  status: SystemStatusResponse | null;
  tasks: LabTask[];
  onStartDevice: (id: string) => void;
  onStopDevice: (id: string) => void;
  onRestartDevice: (id: string) => void;
  onOpenLiveControl: (device: VirtualDevice) => void;
  onCreateNewDevice: () => void;
  onOpenWorkflows: () => void;
  onOpenResourceManager?: () => void;
  onScanAdb?: () => void;
  onConnectAdb?: (endpoint: string) => Promise<{ success: boolean; error?: string; output?: string }>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  devices,
  status,
  tasks,
  onStartDevice,
  onStopDevice,
  onRestartDevice,
  onOpenLiveControl,
  onCreateNewDevice,
  onOpenWorkflows,
  onOpenResourceManager,
  onScanAdb,
  onConnectAdb,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped' | 'error'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [adbEndpoint, setAdbEndpoint] = useState('');
  const [adbFeedback, setAdbFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const pageSize = 12;

  const runningCount = devices.filter((d) => d.status === 'running').length;
  const stoppedCount = devices.filter((d) => d.status === 'stopped' || d.status === 'offline').length;
  const errorCount = devices.filter((d) => d.status === 'error' || d.status === 'unauthorized').length;

  const manufacturers = Array.from(new Set(devices.map((d) => d.manufacturer).filter(Boolean)));

  const filteredDevices = devices.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      d.name.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q) ||
      d.manufacturer.toLowerCase().includes(q) ||
      (d.adbSerial && d.adbSerial.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' ? true : d.status === statusFilter;
    const matchesBrand = brandFilter === 'all' ? true : d.manufacturer.toLowerCase() === brandFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesBrand;
  });

  const { items: paginatedDevices, totalPages } = paginateItems(filteredDevices, currentPage, pageSize);
  const diag = status?.diagnostics;

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adbEndpoint.trim() || !onConnectAdb) return;
    setIsConnecting(true);
    setAdbFeedback(null);
    try {
      const res = await onConnectAdb(adbEndpoint.trim());
      if (res.success) {
        setAdbFeedback({ ok: true, msg: res.output || `Connected to ${adbEndpoint}` });
        setAdbEndpoint('');
      } else {
        setAdbFeedback({ ok: false, msg: res.error || 'ADB connection failed' });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              LABORATORY CONTROL CENTER
            </h1>
            <span
              className={`text-[10px] font-mono-code px-2 py-0.5 rounded border ${
                status?.adb?.isAdbAvailable
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                  : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
              }`}
            >
              {status?.adb?.isAdbAvailable ? 'REAL ADB READY' : 'ADB MISSING'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Genuine Android Virtual Device, physical ADB, and distributed host node telemetry. Zero simulated screens.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onScanAdb && (
            <button
              onClick={onScanAdb}
              className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-code text-slate-200 flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Scan ADB</span>
            </button>
          )}
          <button
            onClick={onOpenWorkflows}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition"
          >
            <PlayCircle className="w-4 h-4 text-violet-400" />
            <span>Automation</span>
          </button>
          <button
            onClick={onCreateNewDevice}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold font-tech tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Device & AVD Manager</span>
          </button>
        </div>
      </div>

      {/* Real Host SDK & Virtualization Diagnostics Banner */}
      {diag && (
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs font-mono-code">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-200 font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Host SDK & Hardware Virtualization ({diag.platform} / {diag.arch})
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={`px-2 py-0.5 rounded border ${
                  diag.adbInstalled
                    ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-700/50 text-rose-300'
                }`}
              >
                ADB: {diag.adbInstalled ? 'Installed' : 'Missing'}
              </span>
              <span
                className={`px-2 py-0.5 rounded border ${
                  diag.emulatorInstalled
                    ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-700/50 text-amber-300'
                }`}
              >
                Emulator: {diag.emulatorInstalled ? 'Installed' : 'Not Installed'}
              </span>
              <span
                className={`px-2 py-0.5 rounded border ${
                  diag.kvmAvailable
                    ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-700/50 text-amber-300'
                }`}
              >
                KVM/HW Accel: {diag.kvmAvailable ? 'Ready' : 'Unavailable'}
              </span>
              <span className="px-2 py-0.5 rounded border bg-slate-950 border-slate-800 text-slate-300">
                Local AVDs: {diag.availableAvds.length}
              </span>
            </div>
          </div>

          {diag.blockers.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-700/40 text-amber-200 text-[11px] space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Environment Blockers on This Host:</span>
              </div>
              {diag.blockers.map((b, i) => (
                <div key={i}>• {b}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick TCP/IP ADB Connect Bar */}
      {onConnectAdb && (
        <form
          onSubmit={handleQuickConnect}
          className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-3 text-xs font-mono-code"
        >
          <div className="flex items-center gap-2 text-cyan-400 font-semibold shrink-0">
            <Link2 className="w-4 h-4" />
            <span>ADB TCP/IP Connect:</span>
          </div>
          <input
            type="text"
            value={adbEndpoint}
            onChange={(e) => setAdbEndpoint(e.target.value)}
            placeholder="e.g. 192.168.1.50:5555 or host.docker.internal:5555"
            aria-label="ADB host and port endpoint"
            className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={isConnecting || !adbEndpoint.trim()}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-tech font-semibold"
          >
            {isConnecting ? 'Connecting...' : 'Connect ADB'}
          </button>
          {adbFeedback && (
            <span className={`text-[11px] ${adbFeedback.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
              {adbFeedback.msg}
            </span>
          )}
        </form>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono-code">
            <span>Total Devices</span>
            <Smartphone className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-tech font-bold text-slate-100">{devices.length}</div>
          <div className="text-[11px] text-slate-500 font-mono-code">Registered Real/AVD</div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-1">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-mono-code">
            <span>Running</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-tech font-bold text-emerald-300">{runningCount}</div>
          <div className="text-[11px] text-emerald-600 font-mono-code">Verified Online</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono-code">
            <span>Stopped / Offline</span>
            <Square className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-tech font-bold text-slate-300">{stoppedCount}</div>
          <div className="text-[11px] text-slate-500 font-mono-code">Not Active</div>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1">
          <div className="flex items-center justify-between text-rose-400 text-xs font-mono-code">
            <span>Errors / Unauth</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-tech font-bold text-rose-300">{errorCount}</div>
          <div className="text-[11px] text-rose-500 font-mono-code">Attention Needed</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-violet-400 text-xs font-mono-code">
            <span>Host RAM</span>
            <HardDrive className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-tech font-bold text-violet-300">
            {status?.hostMetrics?.ramUsagePercent ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono-code">
            {status?.hostMetrics
              ? `${Math.round(status.hostMetrics.usedMemMb / 1024)}GB / ${Math.round(
                  status.hostMetrics.totalMemMb / 1024
                )}GB`
              : 'Host OS'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono-code">
            <span>ADB Bridge</span>
            <CheckCircle2
              className={`w-4 h-4 ${status?.adb?.isAdbAvailable ? 'text-emerald-400' : 'text-rose-400'}`}
            />
          </div>
          <div
            className={`text-sm font-tech font-bold pt-1 ${
              status?.adb?.isAdbAvailable ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {status?.adb?.isAdbAvailable ? 'ADB NATIVE' : 'UNAVAILABLE'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono-code">
            {tasks.filter((t) => t.status === 'running').length} active tasks
          </div>
        </div>
      </div>

      {/* Capacity Governor Bar */}
      <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-code">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
            <Cpu className="w-4 h-4" /> Host Capacity Governor:
          </span>
          <span className="text-slate-300">
            {runningCount} Running / {status?.capacity?.safeMaxConcurrentDevices || 1} Safe Local Limit
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-emerald-400">
            {status?.capacity?.availableSlots ?? 0} Safe Slots Available
          </span>
        </div>

        {onOpenResourceManager && (
          <button
            onClick={onOpenResourceManager}
            className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition"
          >
            Configure Governor & Limits →
          </button>
        )}
      </div>

      {/* Toolbar: Search, Filters & View Toggle */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search devices by name, serial, model..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs font-mono-code">
              {(['all', 'running', 'stopped', 'error'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    setStatusFilter(filter);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded capitalize transition ${
                    statusFilter === filter
                      ? 'bg-cyan-950 text-cyan-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg self-end sm:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition ${
                viewMode === 'grid' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
              aria-label="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition ${
                viewMode === 'list' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
              title="List View"
              aria-label="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {manufacturers.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono-code">
            <span className="text-slate-500 text-[11px] mr-1">Manufacturer:</span>
            <button
              onClick={() => {
                setBrandFilter('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] transition shrink-0 ${
                brandFilter === 'all'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              All ({devices.length})
            </button>
            {manufacturers.map((b) => (
              <button
                key={b}
                onClick={() => {
                  setBrandFilter(b);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] transition shrink-0 ${
                  brandFilter.toLowerCase() === b.toLowerCase()
                    ? 'bg-cyan-600 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty State or Devices Grid/List */}
      {filteredDevices.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
          <Smartphone className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="font-tech text-base font-bold text-slate-200">
            No Real Android Devices Registered or Attached
          </h3>
          <p className="text-xs text-slate-400 font-mono-code max-w-lg mx-auto leading-relaxed">
            DYNOSHI displays only genuine Android OS instances. Attach a phone with USB Debugging, enter an ADB TCP/IP host:port above, or open Device & AVD Manager on a host with Android Studio SDK & KVM/WHPX.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedDevices.map((device) => {
            const isRunning = device.status === 'running';
            return (
              <div
                key={device.id}
                className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                  isRunning ? 'bg-[#0f1422] border-cyan-800/60' : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isRunning ? 'bg-emerald-400' : device.status === 'error' ? 'bg-rose-500' : 'bg-slate-600'
                          }`}
                        />
                        <h3 className="font-tech text-base font-bold text-slate-100 truncate max-w-[200px]">
                          {device.name}
                        </h3>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-code mt-0.5">
                        {device.model} • Android {device.androidVersion} (API {device.apiLevel || '?'})
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono-code uppercase px-2 py-0.5 rounded font-semibold ${
                        isRunning
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-600/40'
                          : device.status === 'error'
                          ? 'bg-rose-950/80 text-rose-400 border border-rose-600/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {device.status}
                    </span>
                  </div>
                </div>

                {/* Real Framebuffer Preview or Honest Offline/Error Message */}
                <div className="px-4 py-2">
                  <div className="h-36 rounded-xl bg-black border border-slate-800/80 relative overflow-hidden flex items-center justify-center group">
                    {isRunning && device.adbSerial ? (
                      <img
                        src={`/api/devices/${device.id}/screen?t=${Math.floor(Date.now() / 4000)}`}
                        alt={`Live screen for ${device.name}`}
                        className="h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-3">
                        <Smartphone className="w-7 h-7 text-slate-700 mx-auto mb-1" />
                        <div className="text-[11px] text-slate-400 font-mono-code uppercase">{device.status}</div>
                        {device.lastError && (
                          <div className="text-[10px] text-rose-400 font-mono-code mt-1 line-clamp-2 max-w-[230px]">
                            {device.lastError}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => onOpenLiveControl(device)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-tech font-semibold flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Open Live Screen</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] font-mono-code text-slate-400">
                    <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/60 text-center">
                      <div className="text-slate-500">Resolution</div>
                      <div className="text-slate-200">
                        {device.resolution.width}x{device.resolution.height}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/60 text-center">
                      <div className="text-slate-500">ADB Serial</div>
                      <div className="text-slate-200 truncate">{device.adbSerial || 'None'}</div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/60 text-center">
                      <div className="text-slate-500">Play Store</div>
                      <div className={device.googlePlay.playStoreInstalled ? 'text-emerald-400' : 'text-slate-400'}>
                        {device.googlePlay.playStoreInstalled ? 'Present' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/50 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isRunning ? (
                      <>
                        <button
                          onClick={() => onStopDevice(device.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 text-xs font-mono-code flex items-center gap-1 transition"
                        >
                          <Square className="w-3 h-3 text-rose-400 fill-current" />
                          <span>Stop</span>
                        </button>
                        <button
                          onClick={() => onRestartDevice(device.id)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                          title="Restart"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => onStartDevice(device.id)}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-tech font-semibold flex items-center gap-1 transition"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenLiveControl(device)}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-300 text-xs font-tech font-semibold flex items-center gap-1.5 transition border border-slate-700"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Control</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 font-mono-code text-[11px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Device Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Android OS</th>
                <th className="py-3 px-4">ADB Serial / AVD</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-code text-[11px]">
              {paginatedDevices.map((device) => {
                const isRunning = device.status === 'running';
                return (
                  <tr key={device.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-slate-200">{device.name}</td>
                    <td className="py-3 px-4 uppercase">{device.status}</td>
                    <td className="py-3 px-4">
                      {device.androidVersion} (API {device.apiLevel || '?'})
                    </td>
                    <td className="py-3 px-4 text-cyan-400">{device.adbSerial || device.avdName || 'Unattached'}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {isRunning ? (
                        <button
                          onClick={() => onStopDevice(device.id)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-900 text-slate-300"
                        >
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => onStartDevice(device.id)}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          Start
                        </button>
                      )}
                      <button
                        onClick={() => onOpenLiveControl(device)}
                        className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-tech"
                      >
                        Control
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredDevices.length > pageSize && (
        <div className="flex items-center justify-between py-3 border-t border-slate-800 text-xs font-mono-code text-slate-400">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, filteredDevices.length)} of {filteredDevices.length} devices
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800"
            >
              Previous
            </button>
            <span className="px-2 text-cyan-300 font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
