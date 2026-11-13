/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Genuine Multi-Screen Wall View (Real ADB Framebuffers)
 */

import React, { useState, useEffect } from 'react';
import {
  MonitorPlay,
  Maximize2,
  Play,
  Power,
  Tv,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { VirtualDevice } from '../types';

interface ScreenWallViewProps {
  devices: VirtualDevice[];
  onStartDevice: (id: string) => void;
  onStopDevice: (id: string) => void;
  onSelectDeviceForControl: (device: VirtualDevice) => void;
  onRefresh: () => void;
}

const ScreenTileStream: React.FC<{ device: VirtualDevice; pollMs: number }> = ({ device, pollMs }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (device.status !== 'running' || !device.adbSerial) {
      setSrc(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    let objUrl: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pull = async () => {
      try {
        const res = await fetch(`/api/devices/${device.id}/screen?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          if (!cancelled) setErr(j.error || `HTTP ${res.status}`);
        } else {
          const blob = await res.blob();
          const nextUrl = URL.createObjectURL(blob);
          if (objUrl) URL.revokeObjectURL(objUrl);
          objUrl = nextUrl;
          if (!cancelled) {
            setSrc(nextUrl);
            setErr(null);
          }
        }
      } catch (e: any) {
        if (!cancelled) setErr(e.message);
      }
      if (!cancelled) timer = setTimeout(pull, pollMs);
    };

    pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [device.id, device.status, device.adbSerial, pollMs]);

  if (err) {
    return (
      <div className="flex flex-col items-center justify-center p-3 text-center text-rose-300 text-[10px] font-mono-code">
        <AlertTriangle className="w-5 h-5 mb-1 text-rose-400" />
        <span>{err}</span>
      </div>
    );
  }
  if (!src) {
    return (
      <div className="flex flex-col items-center justify-center p-3 text-slate-400 text-[10px] font-mono-code">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400 mb-1" />
        <span>Streaming ADB PNG...</span>
      </div>
    );
  }
  return <img src={src} alt={device.name} className="w-full h-full object-contain bg-black" />;
};

export const ScreenWallView: React.FC<ScreenWallViewProps> = ({
  devices,
  onStartDevice,
  onStopDevice,
  onSelectDeviceForControl,
  onRefresh,
}) => {
  const [layoutMode, setLayoutMode] = useState<'4' | '8' | '12' | 'all'>('8');
  const [filterRunningOnly, setFilterRunningOnly] = useState<boolean>(false);
  const [lowBandwidthMode, setLowBandwidthMode] = useState<boolean>(true);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');

  let displayed = devices;
  if (filterRunningOnly) {
    displayed = displayed.filter((d) => d.status === 'running');
  }
  if (selectedManufacturer !== 'all') {
    displayed = displayed.filter((d) => d.manufacturer.toLowerCase() === selectedManufacturer.toLowerCase());
  }

  const limit = layoutMode === '4' ? 4 : layoutMode === '8' ? 8 : layoutMode === '12' ? 12 : 36;
  const activeWallDevices = displayed.slice(0, limit);
  const manufacturers = Array.from(new Set(devices.map((d) => d.manufacturer).filter(Boolean)));

  const getGridColsClass = () => {
    switch (layoutMode) {
      case '4':
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4';
      case '8':
        return 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      case '12':
      default:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070a11] overflow-hidden text-slate-200">
      <div className="px-6 py-4 bg-[#0a0e17] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <MonitorPlay className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
              Live Multi-Device Screen Wall
              <span className="text-[11px] font-mono-code px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {activeWallDevices.length} displayed
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Live PNG framebuffer matrix sourced directly from attached Android `adb exec-out screencap -p` streams.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setFilterRunningOnly(!filterRunningOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition-all flex items-center gap-1.5 border ${
              filterRunningOnly
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${filterRunningOnly ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            Running Only
          </button>

          <button
            onClick={() => setLowBandwidthMode(!lowBandwidthMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition-all border ${
              lowBandwidthMode
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {lowBandwidthMode ? 'Interval: 1.5s' : 'Interval: 0.7s'}
          </button>

          <select
            value={selectedManufacturer}
            onChange={(e) => setSelectedManufacturer(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-300 font-mono-code"
          >
            <option value="all">All Manufacturers</option>
            {manufacturers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            {(['4', '8', '12', 'all'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setLayoutMode(m)}
                className={`px-2.5 py-1 text-xs font-mono-code rounded-md transition-all ${
                  layoutMode === m
                    ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'all' ? 'All' : `${m}x`}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
            title="Refresh Devices"
            aria-label="Refresh Screen Wall"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto">
        {activeWallDevices.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            <Tv className="w-10 h-10 mb-2 text-slate-600" />
            <p className="text-sm">No real devices or AVDs match the active screen wall filter.</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${getGridColsClass()}`}>
            {activeWallDevices.map((dev) => {
              const isRunning = dev.status === 'running';
              return (
                <div
                  key={dev.id}
                  className={`group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200 bg-[#0c101b] ${
                    isRunning ? 'border-cyan-500/30' : 'border-slate-800/80 opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isRunning ? 'bg-emerald-400' : dev.status === 'error' ? 'bg-rose-500' : 'bg-slate-600'
                        }`}
                      />
                      <span className="font-semibold text-white truncate max-w-[130px]">{dev.name}</span>
                    </div>
                    <span className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-code text-[10px]">
                      {dev.adbSerial || dev.manufacturer}
                    </span>
                  </div>

                  <div
                    className="relative aspect-[9/16] max-h-[360px] bg-black flex items-center justify-center overflow-hidden cursor-pointer select-none group/screen"
                    onClick={() => onSelectDeviceForControl(dev)}
                  >
                    {isRunning && dev.adbSerial ? (
                      <>
                        <ScreenTileStream device={dev} pollMs={lowBandwidthMode ? 1500 : 700} />
                        <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover/screen:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-20">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDeviceForControl(dev);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open Controller
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-center text-slate-500">
                        <Power className="w-8 h-8 mb-2 text-slate-700" />
                        <span className="text-xs font-mono-code uppercase">{dev.status}</span>
                        <span className="text-[10px] text-slate-600 mt-1 line-clamp-3">
                          {dev.lastError || dev.model}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartDevice(dev.id);
                          }}
                          className="mt-3 px-3 py-1 rounded bg-slate-800 hover:bg-emerald-900/60 hover:text-emerald-300 border border-slate-700 text-[11px] text-slate-300 transition-all"
                        >
                          Start Device
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="px-3 py-2 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      {isRunning ? (
                        <button
                          onClick={() => onStopDevice(dev.id)}
                          className="p-1 rounded hover:bg-red-950/60 text-slate-400 hover:text-red-400"
                          title="Power Off"
                          aria-label={`Stop ${dev.name}`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onStartDevice(dev.id)}
                          className="p-1 rounded hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-400"
                          title="Start Device"
                          aria-label={`Start ${dev.name}`}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono-code text-slate-500">{dev.deviceCategory}</span>
                      <button
                        onClick={() => onSelectDeviceForControl(dev)}
                        className="p-1 rounded text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/60"
                        title="Open Interactive Controller"
                        aria-label={`Open ${dev.name} controller`}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
