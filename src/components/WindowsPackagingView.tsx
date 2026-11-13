/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Windows Desktop Hub & Packaging Instructions
 */

import React from 'react';
import {
  Download,
  Terminal,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Folder,
  Layers,
  Cpu,
  Monitor,
  Copy,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export const WindowsPackagingView: React.FC = () => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              WINDOWS DESKTOP PACKAGING & LAUNCHER HUB
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              NATIVE WIN32 / X64
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete standalone desktop executable setup, batch launchers, Electron wrapper, and setup instructions.
          </p>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Method 1: Instant Windows Batch Launcher */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-800/60 space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-tech font-bold text-base">
            <Terminal className="w-5 h-5" />
            <span>1. Instant Windows Launcher (`launch_dynoshi.bat`)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-mono-code">
            Double-click <code>launch_dynoshi.bat</code> in the project root on any Windows desktop.
            It automatically checks Node.js, scans for Android SDK platform-tools in <code>%LOCALAPPDATA%\Android\Sdk</code>, and boots Dynoshi Lab in high performance desktop mode.
          </p>
          <div className="p-3 bg-black/80 rounded-xl border border-slate-800 text-[11px] font-mono-code text-cyan-300 flex items-center justify-between">
            <span>.\launch_dynoshi.bat</span>
            <button
              onClick={() => copyToClipboard('.\\launch_dynoshi.bat')}
              className="text-slate-400 hover:text-white"
              title="Copy"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Method 2: Standalone .EXE Builder */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-violet-950/40 to-slate-900 border border-violet-800/60 space-y-3">
          <div className="flex items-center gap-2 text-violet-400 font-tech font-bold text-base">
            <Download className="w-5 h-5" />
            <span>2. Package Standalone .EXE Installer</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-mono-code">
            Run <code>package_windows_app.bat</code> to compile a single standalone Windows setup executable (<code>dist/dynoshi-android-lab-setup.exe</code>) with frameless native titlebars, taskbar tray icon, and offline runtime.
          </p>
          <div className="p-3 bg-black/80 rounded-xl border border-slate-800 text-[11px] font-mono-code text-violet-300 flex items-center justify-between">
            <span>.\package_windows_app.bat</span>
            <button
              onClick={() => copyToClipboard('.\\package_windows_app.bat')}
              className="text-slate-400 hover:text-white"
              title="Copy"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Windows Project Structure & Deliverables Matrix */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h2 className="font-tech text-base font-bold text-slate-100 flex items-center gap-2">
          <Folder className="w-5 h-5 text-cyan-400" />
          <span>Desktop Project Architecture & Deliverables</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono-code">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-cyan-400 font-bold">launch_dynoshi.bat</div>
            <div className="text-slate-400">Windows double-click launcher script with automatic SDK detection.</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-violet-400 font-bold">package_windows_app.bat</div>
            <div className="text-slate-400">Automated packaging script for Electron-based standalone Windows executable.</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-emerald-400 font-bold">electron/main.cjs</div>
            <div className="text-slate-400">Native desktop window process with frameless window, system tray, and GPU acceleration.</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-sky-400 font-bold">data/dynoshi_lab.json</div>
            <div className="text-slate-400">Persistent local database storing devices, workflows, reports, and settings.</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-amber-400 font-bold">server.ts & src/server/adb_service.ts</div>
            <div className="text-slate-400">Full-stack backend providing direct real ADB, Android Emulator AVD, and Host Agent orchestration.</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-pink-400 font-bold">README.md</div>
            <div className="text-slate-400">Comprehensive documentation, setup guide, test checklist, and troubleshooting matrix.</div>
          </div>
        </div>
      </div>

      {/* 16-Point Verification Checklist */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h2 className="font-tech text-base font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Complete Verification Checklist</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono-code text-slate-300">
          {[
            '1. Desktop GUI with futuristic technology-lab aesthetic',
            '2. Real ADB integration & system PATH auto-detection',
            '3. Virtual Device Manager with AVD creation & profiles',
            '4. Live Device Control Center with touch, drag & input',
            '5. Android navigation bar (Back, Home, Recents, Power)',
            '6. Multi-Device Fleet Manager for batch start/stop/run',
            '7. Drag-and-drop APK installer & package manager',
            '8. Visual Automation Studio with action sequence builder',
            '9. Reusable test templates (Smoke, Stress, Forms)',
            '10. Device File Explorer with ADB Push & Pull',
            '11. Screenshot & Media vault with desktop export',
            '12. Task Queue Manager with background progress tracking',
            '13. Real-time Logcat stream with levels V/D/I/W/E',
            '14. Export reports to CSV, JSON, PDF & SQLite dump',
            '15. Windows launch script (launch_dynoshi.bat)',
            '16. Windows packaging script & Electron main process',
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
