/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Live Device Control Center (Genuine ADB Framebuffer & Controls)
 */

import React, { useState } from 'react';
import {
  Smartphone,
  Columns2,
  Columns3,
  Activity,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { VirtualDevice } from '../types';
import { DevicePhoneScreen } from './DevicePhoneScreen';
import { DeviceDiagnostics } from './DeviceDiagnostics';

interface LiveDeviceControlViewProps {
  devices: VirtualDevice[];
  activeDeviceId: string | null;
  onSelectActiveDevice: (id: string) => void;
  onUpdateDevice: (device: VirtualDevice) => void;
  onTakeScreenshot: (deviceId: string) => void;
  onStartDevice: (id: string) => void;
}

export const LiveDeviceControlView: React.FC<LiveDeviceControlViewProps> = ({
  devices,
  activeDeviceId,
  onSelectActiveDevice,
  onUpdateDevice,
  onTakeScreenshot,
  onStartDevice,
}) => {
  const [layoutMode, setLayoutMode] = useState<'single' | 'split2' | 'split4'>('single');
  const [splitDeviceIds, setSplitDeviceIds] = useState<string[]>([]);

  const runningDevices = devices.filter((d) => d.status === 'running');
  const primaryDevice =
    devices.find((d) => d.id === activeDeviceId) || runningDevices[0] || devices[0];

  const handleToggleSplitDevice = (devId: string) => {
    setSplitDeviceIds((prev) =>
      prev.includes(devId) ? prev.filter((id) => id !== devId) : [...prev, devId]
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              LIVE DEVICE CONTROL CENTER
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              REAL ADB FRAMEBUFFER
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Stream live PNG frames from `adb exec-out screencap -p` and dispatch real touch, swipe, keyevent, text, URL, and shell commands.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs font-mono-code">
            <button
              onClick={() => setLayoutMode('single')}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
                layoutMode === 'single'
                  ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Single Focus</span>
            </button>
            <button
              onClick={() => {
                setLayoutMode('split2');
                if (splitDeviceIds.length < 2 && devices.length >= 2) {
                  setSplitDeviceIds([devices[0].id, devices[1].id]);
                }
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
                layoutMode === 'split2'
                  ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Split Dual (2)</span>
            </button>
            <button
              onClick={() => {
                setLayoutMode('split4');
                setSplitDeviceIds(devices.slice(0, 4).map((d) => d.id));
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
                layoutMode === 'split4'
                  ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Multi Grid (4)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Device Selector Pill Bar */}
      {devices.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-[11px] font-mono-code text-slate-500 uppercase tracking-wider shrink-0">
            Target Device:
          </span>
          {devices.map((d) => {
            const isSelected =
              layoutMode === 'single' ? primaryDevice?.id === d.id : splitDeviceIds.includes(d.id);
            const isRunning = d.status === 'running';

            return (
              <button
                key={d.id}
                onClick={() => {
                  if (layoutMode === 'single') {
                    onSelectActiveDevice(d.id);
                  } else {
                    handleToggleSplitDevice(d.id);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono-code transition shrink-0 border ${
                  isSelected
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/80'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-emerald-400' : d.status === 'error' ? 'bg-rose-500' : 'bg-slate-600'
                  }`}
                />
                <span className="font-semibold text-slate-200">{d.name}</span>
                <span className="text-[10px] text-slate-500">{d.adbSerial || d.avdName || d.model}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Control Surface */}
      {layoutMode === 'single' ? (
        primaryDevice ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 flex justify-center p-6 rounded-2xl bg-[#090d18] border border-slate-800/80 shadow-2xl relative">
              <DevicePhoneScreen
                device={primaryDevice}
                onUpdateDevice={onUpdateDevice}
                onTakeScreenshot={onTakeScreenshot}
                onStartDevice={onStartDevice}
              />
            </div>

            <div className="lg:col-span-6 space-y-4">
              <DeviceDiagnostics device={primaryDevice} />
              {/* Real Device Hardware & ADB Identity */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 font-mono-code text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="flex items-center gap-2 text-cyan-400 font-semibold">
                    <Activity className="w-4 h-4" />
                    <span>Live Device Inspection</span>
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                      primaryDevice.status === 'running'
                        ? 'text-emerald-400 bg-emerald-950'
                        : 'text-slate-400 bg-slate-800'
                    }`}
                  >
                    {primaryDevice.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                      <span>Device RAM Usage (`/proc/meminfo`)</span>
                      <span className="text-violet-400">{primaryDevice.ramUsage}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-violet-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${primaryDevice.ramUsage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">ADB Serial:</span>
                    <span className="text-cyan-400 truncate">{primaryDevice.adbSerial || 'Not attached'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">AVD Name:</span>
                    <span className="text-slate-200 truncate">{primaryDevice.avdName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Device Type:</span>
                    <span className="text-slate-200">{primaryDevice.deviceCategory}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Android OS:</span>
                    <span className="text-slate-200">
                      {primaryDevice.androidVersion} (API {primaryDevice.apiLevel || '?'})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Display (`wm size`):</span>
                    <span className="text-slate-200">
                      {primaryDevice.resolution.width}x{primaryDevice.resolution.height} @{' '}
                      {primaryDevice.resolution.densityDpi}dpi
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Battery (`dumpsys`):</span>
                    <span className="text-slate-200">
                      {primaryDevice.batteryLevel}% {primaryDevice.isCharging ? '(Charging)' : '(Discharging)'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Google Play (`com.android.vending`):</span>
                    <span className={primaryDevice.googlePlay.playStoreInstalled ? 'text-emerald-400' : 'text-amber-400'}>
                      {primaryDevice.googlePlay.playStoreInstalled ? 'Installed' : 'Not Detected'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs space-y-2 text-slate-300">
                <div className="font-tech font-bold text-cyan-300 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Direct ADB Input Mapping</span>
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-1 font-mono-code">
                  <li>Click on the screen to send `adb shell input tap X Y`.</li>
                  <li>Drag across the screen to send `adb shell input swipe`.</li>
                  <li>Use bottom nav (Back / Home / Recents) for real keyevents.</li>
                  <li>Use the side bar for URL launch, text input, screenshots, and shell.</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 font-mono-code text-xs space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-200">No Real Android Devices Attached</div>
              <p className="max-w-md mx-auto text-slate-500">
                Attach a physical phone via USB Debugging, connect an Android device via `adb connect host:port`, or launch an AVD from Virtual Device Manager.
              </p>
            </div>
            <DeviceDiagnostics device={null} />
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {devices
            .filter((d) => splitDeviceIds.includes(d.id))
            .map((dev) => (
              <div
                key={dev.id}
                className="p-4 rounded-2xl bg-[#0a0f1d] border border-slate-800 flex flex-col items-center shadow-xl"
              >
                <DevicePhoneScreen
                  device={dev}
                  onUpdateDevice={onUpdateDevice}
                  onTakeScreenshot={onTakeScreenshot}
                  onStartDevice={onStartDevice}
                  compact={true}
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
