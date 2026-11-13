/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Genuine Live Android Framebuffer & Input Controller
 * Streams real PNG framebuffers from `adb exec-out screencap -p` and dispatches real ADB events.
 * ZERO HTML phone mocks or simulated apps.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  Power,
  Volume2,
  Volume1,
  Camera,
  Terminal,
  Type,
  Play,
  X,
  ArrowLeft,
  Globe,
  AlertTriangle,
  RefreshCw,
  Smartphone,
  Video,
  Square,
} from 'lucide-react';
import { VirtualDevice } from '../types';
import { translateCoordinates } from '../logic/avd_engine';

interface DevicePhoneScreenProps {
  device: VirtualDevice;
  onUpdateDevice: (updated: VirtualDevice) => void;
  onTakeScreenshot: (deviceId: string) => void;
  onStartDevice?: (deviceId: string) => Promise<void> | void;
  compact?: boolean;
}

export const DevicePhoneScreen: React.FC<DevicePhoneScreenProps> = ({
  device,
  onUpdateDevice,
  onTakeScreenshot,
  onStartDevice,
  compact = false,
}) => {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [captureMs, setCaptureMs] = useState<number>(0);
  const [measuredFps, setMeasuredFps] = useState<number>(0);
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [isShellModalOpen, setIsShellModalOpen] = useState(false);
  const [shellCommand, setShellCommand] = useState('shell getprop ro.product.model');
  const [shellOutput, setShellOutput] = useState<string>('');
  const [isRunningShell, setIsRunningShell] = useState(false);

  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [inputText, setInputText] = useState('');

  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('https://www.google.com');

  const [flashEffect, setFlashEffect] = useState(false);
  const [isBootingClick, setIsBootingClick] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);

  const screenRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const isLandscape = device.orientation === 'landscape';

  const notify = (ok: boolean, msg: string) => {
    setActionFeedback({ ok, msg });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Real PNG framebuffer poller from `/api/devices/:id/screen`
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let frameTimes: number[] = [];

    const clearFrame = () => {
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
        activeObjectUrlRef.current = null;
      }
      setFrameUrl(null);
    };

    if (device.status !== 'running' || !device.adbSerial) {
      clearFrame();
      setStreamError(null);
      setMeasuredFps(0);
      return;
    }

    const fetchFrame = async () => {
      if (cancelled) return;
      const t0 = performance.now();
      try {
        const res = await fetch(`/api/devices/${device.id}/screen?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          let errMsg = `Framebuffer HTTP ${res.status}`;
          try {
            const j = await res.json();
            if (j.error) errMsg = j.error;
          } catch {}
          if (!cancelled) {
            setStreamError(errMsg);
            setMeasuredFps(0);
          }
        } else {
          const blob = await res.blob();
          if (!cancelled) {
            const objUrl = URL.createObjectURL(blob);
            if (activeObjectUrlRef.current) {
              URL.revokeObjectURL(activeObjectUrlRef.current);
            }
            activeObjectUrlRef.current = objUrl;
            setFrameUrl(objUrl);
            setStreamError(null);

            const elapsed = Math.round(performance.now() - t0);
            setCaptureMs(elapsed);

            const now = Date.now();
            frameTimes = [...frameTimes.filter((t) => now - t <= 3000), now];
            setMeasuredFps(Math.round((frameTimes.length / 3) * 10) / 10);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setStreamError(err?.message || 'Network error fetching framebuffer');
          setMeasuredFps(0);
        }
      }

      if (!cancelled) {
        timer = setTimeout(fetchFrame, compact ? 900 : 450);
      }
    };

    fetchFrame();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
        activeObjectUrlRef.current = null;
      }
    };
  }, [device.id, device.status, device.adbSerial, compact]);

  // Pointer down -> start tap or swipe gesture
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (device.status !== 'running' || !device.adbSerial) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  // Pointer up -> dispatch real `adb shell input tap` or `input swipe`
  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (device.status !== 'running' || !device.adbSerial || !screenRef.current || !dragStartRef.current) return;

    const start = dragStartRef.current;
    dragStartRef.current = null;

    const rect = screenRef.current.getBoundingClientRect();
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);

    const endCoords = translateCoordinates(e.clientX, e.clientY, rect, device.resolution, device.orientation);
    const rippleId = Date.now();
    setClickRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: rippleId });
    setTimeout(() => setClickRipple((prev) => (prev?.id === rippleId ? null : prev)), 500);

    try {
      if (dist >= 12) {
        const startCoords = translateCoordinates(start.x, start.y, rect, device.resolution, device.orientation);
        const durationMs = Math.min(1200, Math.max(120, Date.now() - start.time));
        const res = await fetch(`/api/devices/${device.id}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'swipe',
            params: {
              startX: startCoords.x,
              startY: startCoords.y,
              endX: endCoords.x,
              endY: endCoords.y,
              durationMs,
            },
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          notify(false, d.error || 'Swipe failed');
        }
      } else {
        const res = await fetch(`/api/devices/${device.id}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'tap', params: { x: endCoords.x, y: endCoords.y } }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          notify(false, d.error || 'Tap failed');
        }
      }
    } catch (err: any) {
      notify(false, err.message);
    }
  };

  const sendKey = useCallback(
    async (keyCode: number, label: string) => {
      try {
        const res = await fetch(`/api/devices/${device.id}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'key', params: { keyCode } }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          notify(false, data.error || `${label} keyevent failed`);
        }
      } catch (err: any) {
        notify(false, err.message);
      }
    },
    [device.id]
  );

  const handleLaunchRealApp = async (pkg: string, name: string) => {
    try {
      const res = await fetch(`/api/devices/${device.id}/apps/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName: pkg, appName: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        notify(false, data.error || `Could not launch ${pkg}`);
        return;
      }
      onUpdateDevice({ ...device, activeAppPackage: pkg, activeAppTitle: name });
      notify(true, `Launched ${name} (${pkg})`);
    } catch (err: any) {
      notify(false, err.message);
    }
  };

  const handleRotate = async () => {
    try {
      const res = await fetch(`/api/devices/${device.id}/rotate`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(false, data.error || 'Rotation failed');
        return;
      }
      onUpdateDevice({ ...device, orientation: data.orientation });
    } catch (err: any) {
      notify(false, err.message);
    }
  };

  const handleScreenshot = () => {
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);
    onTakeScreenshot(device.id);
  };

  const handleToggleRecording = async () => {
    if (isRecordingBusy) return;
    setIsRecordingBusy(true);
    try {
      const endpoint = isRecording
        ? `/api/devices/${device.id}/record/stop`
        : `/api/devices/${device.id}/record/start`;
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(false, data.error || 'Screen recording command failed');
        setIsRecording(false);
      } else if (isRecording) {
        setIsRecording(false);
        notify(true, `Saved MP4 recording (${Math.round((data.media?.fileSizeBytes || 0) / 1024)} KB)`);
      } else {
        setIsRecording(true);
        notify(true, 'Recording screen via `adb shell screenrecord`...');
      }
    } catch (err: any) {
      notify(false, err.message);
      setIsRecording(false);
    } finally {
      setIsRecordingBusy(false);
    }
  };

  const handleSendTextInput = async () => {
    if (!inputText) return;
    const res = await fetch(`/api/devices/${device.id}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'text', params: { text: inputText } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) notify(false, data.error || 'ADB text input failed');
    else notify(true, 'Text sent to Android device');
    setInputText('');
    setIsTextModalOpen(false);
  };

  const handleOpenUrl = async () => {
    if (!targetUrl) return;
    const res = await fetch(`/api/devices/${device.id}/open-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) notify(false, data.error || 'Failed to open URL');
    else notify(true, `Opened ${targetUrl}`);
    setIsUrlModalOpen(false);
  };

  const handleRunShell = async () => {
    if (!shellCommand.trim()) return;
    setIsRunningShell(true);
    setShellOutput('Executing via real ADB...');
    try {
      const res = await fetch(`/api/devices/${device.id}/shell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: shellCommand }),
      });
      const data = await res.json();
      setShellOutput(
        `$ ${data.command}\n[exitCode=${data.exitCode} | ${data.durationMs}ms]\n\n${
          data.output || data.stderr || '(empty output)'
        }`
      );
    } catch (err: any) {
      setShellOutput(`Error: ${err.message}`);
    } finally {
      setIsRunningShell(false);
    }
  };

  const handleBootClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBootingClick(true);
    try {
      if (onStartDevice) {
        await onStartDevice(device.id);
      } else {
        const res = await fetch(`/api/devices/${device.id}/start`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          notify(false, data.error || data.message || 'Failed to start device');
          onUpdateDevice({ ...device, status: 'error', lastError: data.error || data.message });
        }
      }
    } finally {
      setIsBootingClick(false);
    }
  };

  const frameWidth = isLandscape ? (compact ? 'w-[440px]' : 'w-[560px]') : compact ? 'w-[270px]' : 'w-[330px]';
  const frameHeight = isLandscape ? (compact ? 'h-[270px]' : 'h-[350px]') : compact ? 'h-[500px]' : 'h-[620px]';

  return (
    <div className="flex flex-col items-center">
      {/* Device Header Info */}
      <div className="flex items-center justify-between w-full max-w-sm mb-2 px-1 text-xs text-slate-400 font-mono-code">
        <div className="flex items-center gap-2 truncate">
          <span
            className={`w-2 h-2 rounded-full ${
              device.status === 'running'
                ? 'bg-emerald-400'
                : device.status === 'booting'
                ? 'bg-amber-400 animate-ping'
                : device.status === 'error' || device.status === 'unauthorized'
                ? 'bg-rose-500'
                : 'bg-slate-600'
            }`}
          />
          <span className="font-semibold text-slate-200 truncate">{device.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {device.status === 'running' && frameUrl && (
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
              {measuredFps} FPS ({captureMs}ms)
            </span>
          )}
          <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
            {device.adbSerial || 'No Serial'}
          </span>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div
          className={`mb-2 px-3 py-1.5 rounded-lg text-[11px] font-mono-code max-w-sm w-full border ${
            actionFeedback.ok
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
          }`}
        >
          {actionFeedback.msg}
        </div>
      )}

      {/* Main Bezel + Side Hardware Toolbar */}
      <div className="flex items-center gap-3">
        <div
          className={`relative ${frameWidth} ${frameHeight} rounded-[36px] p-3 bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] border-4 border-slate-700 shadow-2xl transition-all duration-300 flex flex-col`}
        >
          {flashEffect && (
            <div className="absolute inset-0 bg-white z-40 rounded-[32px] pointer-events-none" />
          )}

          {/* Genuine Android Display Surface */}
          <div
            ref={screenRef}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className="relative flex-1 bg-black rounded-[26px] overflow-hidden flex flex-col select-none cursor-crosshair border border-slate-900"
          >
            {clickRipple && (
              <span
                className="absolute pointer-events-none rounded-full bg-cyan-400/40 border border-cyan-300 animate-ping z-40"
                style={{
                  left: clickRipple.x - 12,
                  top: clickRipple.y - 12,
                  width: 24,
                  height: 24,
                }}
              />
            )}

            {device.status !== 'running' || !device.adbSerial ? (
              <div className="flex-1 flex flex-col items-center justify-center p-5 text-center bg-slate-950 text-slate-400">
                <Smartphone className="w-10 h-10 mb-3 text-slate-700" />
                <div className="text-xs font-mono-code font-semibold text-slate-200 mb-1 uppercase">
                  {device.status === 'booting'
                    ? 'Booting Android OS...'
                    : device.status === 'unauthorized'
                    ? 'USB Debugging Unauthorized'
                    : device.status === 'error'
                    ? 'Emulator / ADB Error'
                    : 'Device Offline'}
                </div>
                <p className="text-[11px] font-mono-code text-slate-400 leading-relaxed mb-4 max-w-[230px]">
                  {device.lastError ||
                    'No live ADB framebuffer stream available. Start a configured local AVD or connect an Android device via USB / ADB TCP-IP.'}
                </p>
                {device.status !== 'booting' && (
                  <button
                    disabled={isBootingClick}
                    onClick={handleBootClick}
                    className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium font-tech flex items-center gap-1.5"
                  >
                    {isBootingClick ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{device.deviceCategory === 'physical' ? 'Verify ADB' : 'Start Real AVD'}</span>
                  </button>
                )}
              </div>
            ) : streamError ? (
              <div className="flex-1 flex flex-col items-center justify-center p-5 text-center bg-slate-950 text-rose-300">
                <AlertTriangle className="w-8 h-8 mb-2 text-rose-400" />
                <div className="text-xs font-mono-code font-semibold mb-1">ADB Stream Unavailable</div>
                <p className="text-[11px] font-mono-code text-slate-400 break-words max-w-[240px]">
                  {streamError}
                </p>
              </div>
            ) : frameUrl ? (
              <img
                src={frameUrl}
                alt={`Live Android framebuffer for ${device.name}`}
                draggable={false}
                className="w-full h-full object-fill pointer-events-none select-none"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-5 text-center bg-slate-950 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
                <div className="text-xs font-mono-code">Connecting to `adb exec-out screencap -p`...</div>
              </div>
            )}

            {/* Android Hardware Navigation Bar (Real ADB Keyevents) */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="h-9 bg-black flex items-center justify-around border-t border-slate-900 z-30 shrink-0"
            >
              <button
                onClick={() => sendKey(4, 'Back')}
                className="p-2 text-slate-400 hover:text-white transition"
                title="Android Back (KEYCODE_BACK = 4)"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => sendKey(3, 'Home')}
                className="p-2 text-slate-400 hover:text-white transition"
                title="Android Home (KEYCODE_HOME = 3)"
                aria-label="Home"
              >
                <div className="w-3.5 h-3.5 rounded-full border-2 border-current" />
              </button>
              <button
                onClick={() => sendKey(187, 'Recents')}
                className="p-2 text-slate-400 hover:text-white transition"
                title="Android Recents (KEYCODE_APP_SWITCH = 187)"
                aria-label="Recent Apps"
              >
                <div className="w-3.5 h-3.5 rounded-sm border-2 border-current" />
              </button>
            </div>
          </div>
        </div>

        {/* Side Hardware Control Toolbar */}
        <div className="flex flex-col gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 shadow-xl">
          <button
            onClick={() => sendKey(26, 'Power')}
            className="p-2 rounded-lg hover:bg-slate-800 hover:text-rose-400 transition"
            title="Power Button (KEYCODE_POWER = 26)"
            aria-label="Power"
          >
            <Power className="w-4 h-4" />
          </button>

          <button
            onClick={() => sendKey(24, 'Volume Up')}
            className="p-2 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition"
            title="Volume Up (KEYCODE_VOLUME_UP = 24)"
            aria-label="Volume Up"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => sendKey(25, 'Volume Down')}
            className="p-2 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition"
            title="Volume Down (KEYCODE_VOLUME_DOWN = 25)"
            aria-label="Volume Down"
          >
            <Volume1 className="w-4 h-4" />
          </button>

          <div className="h-px bg-slate-800 my-0.5" />

          <button
            onClick={handleRotate}
            className="p-2 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition"
            title="Toggle Portrait / Landscape via ADB user_rotation"
            aria-label="Rotate Screen"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleScreenshot}
            className="p-2 rounded-lg hover:bg-slate-800 hover:text-emerald-400 transition"
            title="Capture Real PNG Screenshot to Media Vault"
            aria-label="Take Screenshot"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            disabled={isRecordingBusy || device.status !== 'running'}
            onClick={handleToggleRecording}
            className={`p-2 rounded-lg transition ${
              isRecording
                ? 'bg-rose-950 text-rose-400 animate-pulse'
                : 'hover:bg-slate-800 hover:text-rose-400 disabled:opacity-40'
            }`}
            title={isRecording ? 'Stop & Save MP4 Recording' : 'Start Real ADB Screen Recording (MP4)'}
            aria-label={isRecording ? 'Stop Recording' : 'Record Screen'}
          >
            {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Video className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsTextModalOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition"
            title="Type Text Input (adb shell input text)"
            aria-label="Type Text"
          >
            <Type className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsUrlModalOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition"
            title="Open URL in Real Android Browser"
            aria-label="Open URL"
          >
            <Globe className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsShellModalOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition"
            title="Open Real ADB Shell Terminal"
            aria-label="ADB Shell"
          >
            <Terminal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real Package Quick-Launch Strip (executes genuine `adb shell monkey`) */}
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 max-w-md">
          {[
            { label: 'Play Store', pkg: 'com.android.vending' },
            { label: 'YouTube', pkg: 'com.google.android.youtube' },
            { label: 'Chrome', pkg: 'com.android.chrome' },
            { label: 'Settings', pkg: 'com.android.settings' },
          ].map((app) => (
            <button
              key={app.pkg}
              disabled={device.status !== 'running'}
              onClick={() => handleLaunchRealApp(app.pkg, app.label)}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-[11px] font-mono-code text-slate-300 transition"
              title={`Launch ${app.pkg} via ADB`}
            >
              Launch {app.label}
            </button>
          ))}
        </div>
      )}

      {/* MODAL: Real ADB Shell */}
      {isShellModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800 rounded-xl max-w-lg w-full p-4 font-mono-code text-xs text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <span className="flex items-center gap-2 text-cyan-400 font-semibold">
                <Terminal className="w-4 h-4" />
                <span>ADB Shell - {device.adbSerial || device.name}</span>
              </span>
              <button
                onClick={() => setIsShellModalOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close Shell Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shellCommand}
                  onChange={(e) => setShellCommand(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRunShell();
                  }}
                  placeholder="e.g. shell getprop ro.product.model"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 focus:outline-none focus:border-cyan-500 font-mono-code"
                />
                <button
                  disabled={isRunningShell}
                  onClick={handleRunShell}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded text-white font-medium"
                >
                  Run
                </button>
              </div>

              <div className="p-3 bg-black rounded border border-slate-800 max-h-60 overflow-y-auto whitespace-pre-wrap text-[11px] text-slate-300">
                {shellOutput || 'Enter an ADB command (e.g. "shell getprop ro.build.version.release" or "shell pm list packages") and click Run.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Text Input */}
      {isTextModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800 rounded-xl max-w-sm w-full p-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <span className="font-semibold text-slate-200">Send Keyboard Text (`adb shell input text`)</span>
              <button onClick={() => setIsTextModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type text to dispatch to Android..."
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendTextInput();
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsTextModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendTextInput}
                  className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                >
                  Send Text
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Open URL */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800 rounded-xl max-w-sm w-full p-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <span className="font-semibold text-slate-200">Open URL on Android Browser</span>
              <button onClick={() => setIsUrlModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono-code"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOpenUrl();
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsUrlModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOpenUrl}
                  className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                >
                  Open URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
