/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real Device & Emulator Manager View
 */

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  Play,
  Square,
  RotateCw,
  Copy,
  Trash2,
  Info,
  RefreshCw,
  ShieldAlert,
  X,
  Eye,
  Search,
  Link2,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import { VirtualDevice, DeviceProfile, EmulatorAvdInfo, HostEnvironmentDiagnostics } from '../types';
import { filterDevices, paginateItems } from '../logic/avd_engine';

interface VirtualDeviceManagerViewProps {
  devices: VirtualDevice[];
  profiles: DeviceProfile[];
  diagnostics?: HostEnvironmentDiagnostics;
  onStartDevice: (id: string) => void;
  onStopDevice: (id: string) => void;
  onRestartDevice: (id: string) => void;
  onDeleteDevice: (id: string) => void;
  onCloneDevice: (id: string) => void;
  onCreateDevice: (device: Partial<VirtualDevice>) => void;
  onOpenLiveControl: (device: VirtualDevice) => void;
  onScanAdb: () => void;
  onConnectAdb?: (endpoint: string) => Promise<{ success: boolean; error?: string; output?: string }>;
  isScanningAdb: boolean;
}

export const VirtualDeviceManagerView: React.FC<VirtualDeviceManagerViewProps> = ({
  devices,
  profiles,
  diagnostics,
  onStartDevice,
  onStopDevice,
  onRestartDevice,
  onDeleteDevice,
  onCloneDevice,
  onCreateDevice,
  onOpenLiveControl,
  onScanAdb,
  onConnectAdb,
  isScanningAdb,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDeviceForInfo, setSelectedDeviceForInfo] = useState<VirtualDevice | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<VirtualDevice | null>(null);
  const [avds, setAvds] = useState<EmulatorAvdInfo[]>([]);
  const [adbEndpoint, setAdbEndpoint] = useState('');
  const [adbFeedback, setAdbFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const loadAvds = async () => {
    try {
      const res = await fetch('/api/avds');
      if (res.ok) {
        const data = await res.json();
        setAvds(data.avds || []);
      }
    } catch {}
  };

  useEffect(() => {
    loadAvds();
  }, []);

  // Real-time filtered devices
  const filteredDevices = filterDevices(devices, searchQuery, statusFilter);
  const { items: paginatedDevices, totalPages } = paginateItems(filteredDevices, currentPage, pageSize);

  // Form state for registering a device/AVD
  const [newName, setNewName] = useState('');
  const [avdName, setAvdName] = useState('');
  const [adbSerial, setAdbSerial] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id || '');
  const [customModel, setCustomModel] = useState('Pixel 8 Pro');
  const [customManufacturer, setCustomManufacturer] = useState('Google');
  const [customAndroidVer, setCustomAndroidVer] = useState('14.0');
  const [customApiLevel, setCustomApiLevel] = useState(34);
  const [customRamMb, setCustomRamMb] = useState(4096);
  const [customStorageMb, setCustomStorageMb] = useState(16384);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(2400);
  const [customDpi, setCustomDpi] = useState(420);
  const [customAbi, setCustomAbi] = useState('x86_64');

  const handleProfileSelect = (profId: string) => {
    setSelectedProfileId(profId);
    const p = profiles.find((prof) => prof.id === profId);
    if (p) {
      setCustomModel(p.model);
      setCustomManufacturer(p.manufacturer);
      setCustomAndroidVer(p.androidVersion.split(' ')[0] || '14.0');
      setCustomApiLevel(p.apiLevel);
      setCustomRamMb(p.ramMb);
      setCustomStorageMb(p.storageMb);
      setCustomWidth(p.resolution.width);
      setCustomHeight(p.resolution.height);
      setCustomDpi(p.resolution.densityDpi);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateDevice({
      name: newName || avdName || adbSerial || `${customModel} AVD`,
      model: customModel,
      manufacturer: customManufacturer,
      androidVersion: customAndroidVer,
      apiLevel: Number(customApiLevel),
      abi: customAbi,
      ramMb: Number(customRamMb),
      storageMb: Number(customStorageMb),
      avdName: avdName.trim() || undefined,
      adbSerial: adbSerial.trim() || undefined,
      resolution: {
        width: Number(customWidth),
        height: Number(customHeight),
        densityDpi: Number(customDpi),
      },
    });
    setIsCreateModalOpen(false);
    setNewName('');
    setAvdName('');
    setAdbSerial('');
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
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

  const getCategoryLabel = (device: VirtualDevice) => {
    if (device.deviceCategory === 'physical') return 'Physical HW (ADB)';
    if (device.deviceCategory === 'emulator_playstore') return 'Google Play AVD';
    if (device.deviceCategory === 'cloud_device') return 'Cloud Android';
    if (device.deviceCategory === 'remote_agent') return 'Remote Host Node';
    return 'Emulator (AOSP)';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
            REAL DEVICE & AVD MANAGER
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Register official Android Emulator AVDs, detect USB/TCP-IP ADB hardware, and inspect host virtualization capabilities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onScanAdb();
              loadAvds();
            }}
            disabled={isScanningAdb}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-code text-slate-300 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanningAdb ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isScanningAdb ? 'Scanning ADB...' : 'Scan ADB & AVDs'}</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold font-tech tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-600/25 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Register AVD / Device</span>
          </button>
        </div>
      </div>

      {/* Host AVDs & TCP/IP Connect Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Local AVDs */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs font-mono-code">
          <div className="flex items-center justify-between">
            <span className="text-slate-200 font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Host Local AVDs (`emulator -list-avds`)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
              {avds.length} Discovered
            </span>
          </div>
          {avds.length > 0 ? (
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {avds.map((a) => (
                <div
                  key={a.name}
                  className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <span className="text-cyan-300 font-bold">{a.name}</span>
                    {a.tagAbi && <span className="text-slate-500 ml-2">({a.tagAbi})</span>}
                  </div>
                  <button
                    onClick={() =>
                      onCreateDevice({
                        name: a.name,
                        avdName: a.name,
                        model: a.device || 'Android Emulator',
                        manufacturer: 'Google',
                        apiLevel: a.apiLevel || 34,
                        androidVersion: a.apiLevel ? `API ${a.apiLevel}` : 'Android Emulator',
                        deviceCategory: a.hasGooglePlay ? 'emulator_playstore' : 'emulator_aosp',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] shrink-0"
                  >
                    Register
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-amber-300/90 flex items-start gap-2 pt-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {diagnostics && !diagnostics.emulatorInstalled
                  ? 'Android Emulator binary & AVDs are not installed on this container host. Attach a remote device via ADB TCP/IP or run DYNOSHI on a desktop with Android Studio SDK.'
                  : 'No local AVDs found. Create an AVD in Android Studio Device Manager or via avdmanager.'}
              </span>
            </div>
          )}
        </div>

        {/* TCP/IP ADB Connect */}
        {onConnectAdb && (
          <form
            onSubmit={handleConnectSubmit}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs font-mono-code"
          >
            <div className="flex items-center gap-2 text-cyan-400 font-semibold">
              <Link2 className="w-4 h-4" />
              <span>Connect Network / Wireless ADB Device</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={adbEndpoint}
                onChange={(e) => setAdbEndpoint(e.target.value)}
                placeholder="192.168.1.50:5555 or host.docker.internal:5555"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isConnecting || !adbEndpoint.trim()}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-tech font-bold"
              >
                {isConnecting ? 'Connecting...' : 'adb connect'}
              </button>
            </div>
            {adbFeedback && (
              <div className={`text-[11px] ${adbFeedback.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                {adbFeedback.msg}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Search & Real-time Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search devices by name, status, or Android version..."
              aria-label="Search virtual devices"
              className="w-full pl-10 pr-9 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono-code transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                title="Clear search"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs font-mono-code">
            {(['all', 'running', 'stopped'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded capitalize transition ${
                  statusFilter === filter
                    ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono-code text-slate-400 flex items-center gap-2">
          <span>
            Showing <strong className="text-cyan-400">{filteredDevices.length}</strong> of{' '}
            {devices.length} Devices
          </span>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-[11px] text-cyan-400 hover:underline hover:text-cyan-300 transition"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Device Grid */}
      {filteredDevices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedDevices.map((device) => {
            const isRunning = device.status === 'running';
            return (
              <div
                key={device.id}
                className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-cyan-400" />
                        <span className="font-tech font-bold text-base text-slate-100">{device.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-code mt-0.5">
                        {device.model} • Android {device.androidVersion}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                          {getCategoryLabel(device)}
                        </span>
                        <span className="text-[10px] font-mono-code text-slate-500">
                          Node: {device.nodeId}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono-code uppercase px-2 py-0.5 rounded font-semibold ${
                        isRunning
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40'
                          : device.status === 'error'
                          ? 'bg-rose-950 text-rose-400 border border-rose-700/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {device.status}
                    </span>
                  </div>

                  {device.lastError && (
                    <div className="mt-2 p-2 rounded bg-rose-950/30 border border-rose-800/40 text-[10px] text-rose-300 font-mono-code leading-relaxed">
                      {device.lastError}
                    </div>
                  )}

                  {/* Specs Box */}
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 font-mono-code text-[11px] text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">ADB Serial:</span>
                      <span className="text-cyan-300">{device.adbSerial || 'Not attached'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">AVD Name:</span>
                      <span className="text-slate-300">{device.avdName || 'None'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">API / ABI:</span>
                      <span className="text-slate-300">
                        API {device.apiLevel || '?'} • {device.abi}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Display Resolution:</span>
                      <span className="text-slate-300">
                        {device.resolution.width}x{device.resolution.height} ({device.resolution.densityDpi} DPI)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Play Store:</span>
                      <span className={device.googlePlay.playStoreInstalled ? 'text-emerald-400' : 'text-slate-500'}>
                        {device.googlePlay.playStoreInstalled ? 'Installed (com.android.vending)' : 'Not detected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isRunning ? (
                      <>
                        <button
                          onClick={() => onStopDevice(device.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 text-xs font-mono-code flex items-center gap-1"
                        >
                          <Square className="w-3 h-3 text-rose-400 fill-current" />
                          <span>Stop</span>
                        </button>
                        <button
                          onClick={() => onRestartDevice(device.id)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                          title="Restart"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => onStartDevice(device.id)}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-tech font-semibold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start AVD</span>
                      </button>
                    )}
                    <button
                      onClick={() => onOpenLiveControl(device)}
                      className="p-1.5 rounded bg-slate-800 hover:bg-cyan-950 hover:text-cyan-400 text-slate-300 text-xs"
                      title="Open Screen Control"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedDeviceForInfo(device)}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                      title="Device Hardware Info"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onCloneDevice(device.id)}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400"
                      title="Clone Device Environment"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeviceToDelete(device)}
                      className="p-1.5 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                      title="Delete Virtual Device"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <Smartphone className="w-10 h-10 text-slate-700 mx-auto" />
          <h3 className="font-tech font-bold text-base text-slate-300">No Matching Android Devices</h3>
          <p className="text-xs text-slate-500 font-mono-code max-w-md mx-auto">
            {devices.length === 0
              ? 'No physical USB/TCP-IP phones or local Android Emulator AVDs are currently registered. Connect a device via ADB or register an AVD.'
              : `No devices found matching "${searchQuery}"${statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.`}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 font-mono-code transition border border-slate-700"
            >
              Clear Search & Filters
            </button>
          )}
        </div>
      )}

      {/* Pagination Footer */}
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
              className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800 transition"
            >
              Previous
            </button>
            <span className="px-2 text-cyan-300 font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Register Real AVD or Device Profile */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800/80 rounded-2xl max-w-xl w-full p-6 text-xs text-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <h2 className="font-tech text-lg font-bold text-white">Register AVD / ADB Device</h2>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono-code text-slate-400">
              Note: Hardware templates below configure target metadata only. Booting a real Android OS requires either a local AVD name installed in Android SDK or a live ADB serial.
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono-code text-slate-400 mb-1.5">
                  Hardware Template Preset:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {profiles.map((prof) => (
                    <button
                      type="button"
                      key={prof.id}
                      onClick={() => handleProfileSelect(prof.id)}
                      className={`p-2 rounded-lg border text-left transition ${
                        selectedProfileId === prof.id
                          ? 'bg-cyan-950/70 border-cyan-500/80 text-cyan-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-tech font-bold text-xs truncate">{prof.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono-code truncate">
                        {prof.manufacturer} • API {prof.apiLevel}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono-code">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Display Name:</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Pixel_8_PlayStore"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Backing Local AVD Name (optional):
                  </label>
                  <input
                    type="text"
                    value={avdName}
                    onChange={(e) => setAvdName(e.target.value)}
                    list="discovered-avds"
                    placeholder="Exact AVD name from emulator -list-avds"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                  <datalist id="discovered-avds">
                    {avds.map((a) => (
                      <option key={a.name} value={a.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="font-mono-code">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Existing ADB Serial (optional, e.g. 192.168.1.50:5555 or emulator-5554):
                </label>
                <input
                  type="text"
                  value={adbSerial}
                  onChange={(e) => setAdbSerial(e.target.value)}
                  placeholder="Leave blank for new AVD"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono-code">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Android OS Version:</label>
                  <select
                    value={customAndroidVer}
                    onChange={(e) => {
                      setCustomAndroidVer(e.target.value);
                      if (e.target.value === '15.0') setCustomApiLevel(35);
                      else if (e.target.value === '14.0') setCustomApiLevel(34);
                      else if (e.target.value === '13.0') setCustomApiLevel(33);
                      else if (e.target.value === '12.0') setCustomApiLevel(31);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="15.0">Android 15 - API 35</option>
                    <option value="14.0">Android 14 - API 34</option>
                    <option value="13.0">Android 13 - API 33</option>
                    <option value="12.0">Android 12 - API 31</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Architecture (ABI):</label>
                  <select
                    value={customAbi}
                    onChange={(e) => setCustomAbi(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="x86_64">x86_64 (Desktop Emulator)</option>
                    <option value="arm64-v8a">arm64-v8a (Physical / Apple Silicon)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">RAM Size (MB):</label>
                  <input
                    type="number"
                    value={customRamMb}
                    onChange={(e) => setCustomRamMb(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Storage Size (MB):</label>
                  <input
                    type="number"
                    value={customStorageMb}
                    onChange={(e) => setCustomStorageMb(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-semibold tracking-wider shadow-lg shadow-cyan-600/30"
                >
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Device Hardware Specs Info */}
      {selectedDeviceForInfo && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800 rounded-2xl max-w-md w-full p-6 text-xs text-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-tech text-base font-bold text-cyan-300">
                Device Info: {selectedDeviceForInfo.name}
              </span>
              <button onClick={() => setSelectedDeviceForInfo(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 font-mono-code text-[11px]">
              <div className="p-2 rounded bg-slate-950 flex justify-between">
                <span className="text-slate-500">ADB Serial:</span>
                <span className="text-cyan-300">{selectedDeviceForInfo.adbSerial || 'Not attached'}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 flex justify-between">
                <span className="text-slate-500">AVD Name:</span>
                <span className="text-slate-200">{selectedDeviceForInfo.avdName || 'None'}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 flex justify-between">
                <span className="text-slate-500">Model:</span>
                <span className="text-slate-200">{selectedDeviceForInfo.model}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 flex justify-between">
                <span className="text-slate-500">Manufacturer:</span>
                <span className="text-slate-200">{selectedDeviceForInfo.manufacturer}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 flex justify-between">
                <span className="text-slate-500">Android Version:</span>
                <span className="text-cyan-400">
                  {selectedDeviceForInfo.androidVersion} (API {selectedDeviceForInfo.apiLevel || '?'})
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950 flex justify-between">
                <span className="text-slate-500">Play Store Package:</span>
                <span className="text-slate-200">
                  {selectedDeviceForInfo.googlePlay.playStoreInstalled ? 'com.android.vending' : 'Not detected'}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950 flex justify-between">
                <span className="text-slate-500">YouTube Package:</span>
                <span className="text-slate-200">
                  {selectedDeviceForInfo.googlePlay.youtubeInstalled ? 'com.google.android.youtube' : 'Not detected'}
                </span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedDeviceForInfo(null)}
                className="px-4 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: Delete Device */}
      {deviceToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-800 rounded-2xl max-w-sm w-full p-5 text-xs text-slate-200 shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-tech text-base font-bold">
              <ShieldAlert className="w-5 h-5" />
              <span>Remove Device Entry</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Remove <strong>{deviceToDelete.name}</strong> from the DYNOSHI device registry?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeviceToDelete(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteDevice(deviceToDelete.id);
                  setDeviceToDelete(null);
                }}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-tech font-semibold"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
