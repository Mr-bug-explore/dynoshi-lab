/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Desktop Titlebar
 */

import React, { useState } from 'react';
import {
  Smartphone,
  Minus,
  Square,
  X,
  Maximize2,
  Minimize2,
  Terminal,
  Activity,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  Cloud,
} from 'lucide-react';
import { SystemStatusResponse } from '../types';
import { useFirebase } from './FirebaseProvider';

interface DesktopTitlebarProps {
  status: SystemStatusResponse | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export const DesktopTitlebar: React.FC<DesktopTitlebarProps> = ({
  status,
  onRefresh,
  onOpenSettings,
}) => {
  const { user, authError, signInWithGoogle, signOut, retryProfileSync } = useFirebase();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const isRealAdb = status?.adb?.isAdbAvailable;

  return (
    <header className="relative flex items-center justify-between h-10 px-3 bg-[#0a0e17] border-b border-cyan-950/50 text-slate-300 select-none z-50">
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-12 right-6 px-4 py-2 bg-slate-900/95 border border-cyan-500/50 rounded shadow-xl text-xs text-cyan-300 flex items-center gap-2 z-50 animate-bounce">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Left: Brand & Desktop Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span className="font-tech tracking-wider font-bold text-sm bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400 bg-clip-text text-transparent">
            DYNOSHI
          </span>
          <span className="text-[10px] uppercase tracking-widest text-violet-400 font-semibold px-1 rounded bg-violet-950/80 border border-violet-600/30">
            LAB
          </span>
        </div>

        {/* Engine status indicator */}
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono-code transition border ${
            isRealAdb
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/60'
              : 'bg-rose-950/30 text-rose-400 border-rose-800/40 hover:bg-rose-950/50'
          }`}
          title="Click to view Android SDK & ADB diagnostics"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRealAdb ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
            }`}
          />
          <span>{isRealAdb ? 'REAL ADB ONLINE' : 'ADB UNAVAILABLE'}</span>
        </button>

        {/* Running Device Count Pill */}
        {status && (
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-mono-code">
            <span className="text-slate-600">|</span>
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Devices:{' '}
              <strong className="text-emerald-400">{status.runningDevices}</strong>/
              {status.totalDevices}
            </span>
          </div>
        )}

        {/* Host CPU & Memory */}
        {status?.hostMetrics && (
          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 font-mono-code">
            <div className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>Host RAM: {status.hostMetrics.ramUsagePercent}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Center: System Header Title */}
      <div className="hidden sm:block text-[11px] font-mono-code text-slate-500 tracking-wider">
        REAL ANDROID DEVICE & EMULATOR CONTROL CENTER v3.0
      </div>

      {/* Right: Account Sync & Window Controls */}
      <div className="flex items-center gap-1.5">
        {user ? (
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono-code ${
              authError
                ? 'bg-amber-950/60 border-amber-700/60 text-amber-200'
                : 'bg-violet-950/50 border-violet-700/50 text-violet-200'
            }`}
            title={authError || 'Google Cloud Sync active'}
          >
            {authError ? (
              <button
                type="button"
                onClick={() => retryProfileSync().catch(() => {})}
                className="flex items-center gap-1 hover:text-white transition"
                title={`${authError} Click to retry`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="hidden md:inline">Cloud Offline</span>
              </button>
            ) : (
              <>
                <Cloud className="w-3 h-3 text-violet-400" />
                <span className="max-w-[120px] truncate hidden md:inline">
                  {user.displayName || user.email?.split('@')[0] || 'Operator'}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() => signOut()}
              className="p-0.5 hover:text-rose-300 transition"
              title="Sign out of Google Cloud Sync"
              aria-label="Sign out"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signInWithGoogle().catch(() => showToast('Google Sign-In popup closed.'))}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono-code text-cyan-300 transition"
            title="Sign in with Google for Firestore Cloud Sync"
          >
            <LogIn className="w-3 h-3" />
            <span className="hidden md:inline">Cloud Sync</span>
          </button>
        )}

        <button
          onClick={() => {
            onRefresh();
            if (user && authError) retryProfileSync().catch(() => {});
          }}
          className="p-1.5 rounded hover:bg-slate-800/70 text-slate-400 hover:text-cyan-300 transition"
          title="Refresh Device State & ADB Telemetry"
          aria-label="Refresh telemetry"
        >
          <Activity className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 transition"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        {/* Native Windows Controls Simulation */}
        <button
          onClick={() => showToast('Application minimized to system tray')}
          className="p-1.5 rounded hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 transition"
          title="Minimize to Tray"
          aria-label="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => showToast('Window dimensions snapped to desktop bounds')}
          className="p-1.5 rounded hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 transition"
          title="Maximize Window"
          aria-label="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>

        <button
          onClick={() =>
            showToast('Dynoshi Lab daemon running in background. Use launch script to restart.')
          }
          className="p-1.5 rounded hover:bg-rose-900/60 hover:text-rose-200 text-slate-400 transition"
          title="Close Dynoshi Window"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
