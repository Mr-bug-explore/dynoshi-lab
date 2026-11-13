/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real Application & Package Manager View
 */

import React, { useState, useEffect } from 'react';
import {
  Package,
  Upload,
  Play,
  Square,
  Trash2,
  RotateCcw,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { VirtualDevice, InstalledApp } from '../types';

interface ApplicationManagerViewProps {
  devices: VirtualDevice[];
  onInstallApk: (deviceId: string, file: File, appName?: string) => Promise<any>;
}

export const ApplicationManagerView: React.FC<ApplicationManagerViewProps> = ({
  devices,
  onInstallApk,
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || '');
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'user' | 'system'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [appToClear, setAppToClear] = useState<InstalledApp | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (devices.length > 0 && (!selectedDeviceId || !devices.some((d) => d.id === selectedDeviceId))) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  const fetchApps = async (devId: string, refresh = false) => {
    if (!devId) {
      setApps([]);
      return;
    }
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/devices/${devId}/apps${refresh ? '?refresh=true' : ''}`);
      const data = await res.json();
      setApps(Array.isArray(data) ? data : []);
    } catch {
      setApps([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedDeviceId) {
      fetchApps(selectedDeviceId, false);
    } else {
      setApps([]);
    }
  }, [selectedDeviceId]);

  const handleLaunch = async (app: InstalledApp) => {
    const res = await fetch(`/api/devices/${selectedDeviceId}/apps/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageName: app.packageName, appName: app.appName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusFeedback({ ok: false, msg: data.error || `Failed to launch ${app.packageName}` });
    } else {
      setStatusFeedback({ ok: true, msg: `Launched ${app.packageName} via monkey` });
    }
  };

  const handleStop = async (app: InstalledApp) => {
    const res = await fetch(`/api/devices/${selectedDeviceId}/apps/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageName: app.packageName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusFeedback({ ok: false, msg: data.error || `Force-stop failed for ${app.packageName}` });
    } else {
      setStatusFeedback({ ok: true, msg: `Force stopped ${app.packageName}` });
    }
  };

  const handleClearData = async () => {
    if (!appToClear) return;
    const res = await fetch(`/api/devices/${selectedDeviceId}/apps/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageName: appToClear.packageName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusFeedback({ ok: false, msg: data.error || `pm clear failed for ${appToClear.packageName}` });
    } else {
      setStatusFeedback({ ok: true, msg: data.message || `Cleared data for ${appToClear.packageName}` });
    }
    setAppToClear(null);
  };

  const handleUninstall = async (app: InstalledApp) => {
    const res = await fetch(`/api/devices/${selectedDeviceId}/apps/uninstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageName: app.packageName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusFeedback({ ok: false, msg: data.error || `adb uninstall failed for ${app.packageName}` });
    } else {
      setStatusFeedback({ ok: true, msg: `Uninstalled ${app.packageName}` });
      fetchApps(selectedDeviceId, true);
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.apk')) {
      handleProcessApk(files[0]);
    }
  };

  const handleProcessApk = async (file: File) => {
    if (!selectedDeviceId) {
      setStatusFeedback({ ok: false, msg: 'Select a running ADB device before installing an APK.' });
      return;
    }
    setIsUploading(true);
    setUploadProgress(30);
    const timer = setInterval(() => setUploadProgress((p) => Math.min(90, p + 15)), 250);

    try {
      const result = await onInstallApk(selectedDeviceId, file);
      clearInterval(timer);
      setUploadProgress(100);
      setStatusFeedback({
        ok: true,
        msg: result?.message || `Installed ${file.name} via adb install -r`,
      });
      fetchApps(selectedDeviceId, true);
    } catch (err: any) {
      clearInterval(timer);
      setStatusFeedback({ ok: false, msg: err?.message || 'APK installation failed.' });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const filteredApps = apps.filter((a) => {
    const matchesSearch =
      a.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.packageName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === 'all' ? true : filterType === 'user' ? !a.isSystem : a.isSystem;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              APPLICATION & PACKAGE MANAGER
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              REAL ADB PM
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Inspect real installed packages (`pm list packages -f`), sideload APKs (`adb install -r`), launch, force-stop, clear data, and uninstall.
          </p>
        </div>

        {/* Device Target Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono-code text-slate-400">Target Device:</span>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono-code focus:outline-none focus:border-cyan-500"
          >
            {devices.length === 0 ? (
              <option value="">No Devices Attached</option>
            ) : (
              devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.adbSerial || d.status})
                </option>
              ))
            )}
          </select>
          <button
            onClick={() => fetchApps(selectedDeviceId, true)}
            disabled={!selectedDeviceId || isRefreshing}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-code text-slate-200 flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh `pm`</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {statusFeedback && (
        <div
          className={`p-3 rounded-lg text-xs font-mono-code flex items-center gap-2 border ${
            statusFeedback.ok
              ? 'bg-emerald-950/70 border-emerald-600/60 text-emerald-300'
              : 'bg-rose-950/70 border-rose-600/60 text-rose-300'
          }`}
        >
          {statusFeedback.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusFeedback.msg}</span>
        </div>
      )}

      {/* Drag & Drop APK Installation Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
        className={`p-6 rounded-2xl border-2 border-dashed transition-all text-center relative overflow-hidden ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
        }`}
      >
        <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
        <h3 className="font-tech text-base font-bold text-slate-200">
          Drag & Drop Android APK File (`adb install -r`)
        </h3>
        <p className="text-xs text-slate-400 mt-0.5 mb-3 font-mono-code">
          {selectedDevice?.adbSerial
            ? `Target ADB Serial: ${selectedDevice.adbSerial}`
            : 'Attach a live Android device or emulator before installing an APK'}
        </p>
        <label className="inline-block px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-tech font-bold tracking-wider cursor-pointer shadow-lg shadow-cyan-600/25 transition">
          <span>Browse APK File</span>
          <input
            type="file"
            accept=".apk"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleProcessApk(e.target.files[0]);
            }}
          />
        </label>

        {isUploading && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 z-20">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-xs font-mono-code text-cyan-300">
                <span>Installing APK via adb install -r ...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search package name or app..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono-code"
            />
          </div>

          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs font-mono-code">
            {(['all', 'user', 'system'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded capitalize transition ${
                  filterType === type
                    ? 'bg-cyan-950 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono-code text-slate-500">
          Showing {filteredApps.length} real package(s)
        </div>
      </div>

      {/* Installed Packages Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        {filteredApps.length === 0 ? (
          <div className="p-10 text-center text-xs font-mono-code text-slate-500">
            No packages queried yet. Attach a running device and click "Refresh `pm`".
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 font-mono-code text-[11px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Application</th>
                <th className="py-3 px-4">Package Name</th>
                <th className="py-3 px-4">APK Path</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-code text-[11px]">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-semibold text-slate-200">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-cyan-400" />
                      <span>{app.appName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{app.packageName}</td>
                  <td className="py-3 px-4 text-slate-500 truncate max-w-[260px]">
                    {app.apkPath || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        app.isSystem
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-cyan-950 text-cyan-400 border border-cyan-800/40'
                      }`}
                    >
                      {app.isSystem ? 'System' : 'User App'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      onClick={() => handleLaunch(app)}
                      className="p-1.5 rounded hover:bg-cyan-950 hover:text-cyan-300 text-slate-300 transition"
                      title="Launch Application"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      onClick={() => handleStop(app)}
                      className="p-1.5 rounded hover:bg-slate-800 hover:text-slate-100 text-slate-400 transition"
                      title="Force Stop App"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      onClick={() => setAppToClear(app)}
                      className="p-1.5 rounded hover:bg-slate-800 hover:text-amber-400 text-slate-400 transition"
                      title="Clear Application Data"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    {!app.isSystem && (
                      <button
                        onClick={() => handleUninstall(app)}
                        className="p-1.5 rounded hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 transition"
                        title="Uninstall App"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CONFIRMATION: Clear Data Modal */}
      {appToClear && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-800 rounded-2xl max-w-sm w-full p-5 text-xs text-slate-200 shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-tech text-base font-bold">
              <ShieldAlert className="w-5 h-5" />
              <span>Clear App Data & Cache?</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Execute <code>adb shell pm clear {appToClear.packageName}</code> on target device?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAppToClear(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-tech font-bold"
              >
                Clear Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
