/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Startup Splash Screen
 */

import React, { useEffect, useState } from 'react';
import { Smartphone, CheckCircle, AlertTriangle } from 'lucide-react';
import { SystemStatusResponse } from '../types';

interface SplashScreenProps {
  status?: SystemStatusResponse | null;
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ status, onComplete }) => {
  const [progress, setProgress] = useState(20);
  const [stage, setStage] = useState('Probing Android SDK & ADB Binary...');

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setProgress(55);
      setStage('Checking Hardware Virtualization & Local AVDs...');
    }, 300);

    const timer2 = setTimeout(() => {
      setProgress(100);
      setStage('Real ADB Control Center Ready.');
    }, 700);

    const timer3 = setTimeout(() => {
      onComplete();
    }, 1050);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  const diag = status?.diagnostics;

  return (
    <div className="fixed inset-0 z-50 bg-[#080B11] flex flex-col items-center justify-center scanline-bg">
      <div className="relative flex flex-col items-center max-w-md w-full px-6 text-center">
        <div className="relative mb-6">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-violet-600/30 to-blue-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-900 to-cyan-950 border border-cyan-500/50 flex items-center justify-center shadow-2xl">
            <Smartphone className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
          </div>
        </div>

        <h1 className="font-tech text-3xl font-bold tracking-widest text-slate-100 mb-1">
          DYNOSHI <span className="text-cyan-400">ANDROID</span> LAB
        </h1>
        <p className="text-xs uppercase font-mono-code tracking-[0.25em] text-violet-400 mb-8">
          Real Android Device & Emulator Control Center
        </p>

        <div className="w-full bg-slate-900 rounded-full h-2 p-0.5 border border-slate-800 mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-violet-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between w-full text-[11px] font-mono-code text-slate-400 mb-6">
          <span className="truncate">{stage}</span>
          <span className="text-cyan-400 font-bold ml-2">{progress}%</span>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full text-[11px] font-mono-code text-slate-400 border border-slate-800/80 rounded-lg p-3 bg-slate-950/60 text-left">
          <div className="flex items-center gap-1.5">
            {diag?.adbInstalled !== false ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span className="truncate">ADB Binary</span>
          </div>
          <div className="flex items-center gap-1.5">
            {diag?.kvmAvailable ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span className="truncate">{diag?.kvmAvailable ? 'KVM Ready' : 'KVM/Accel Check'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Local Registry</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">ADB Runner</span>
          </div>
        </div>

        <button
          onClick={onComplete}
          className="mt-6 text-xs text-slate-500 hover:text-cyan-400 underline underline-offset-4 transition font-mono-code"
        >
          Enter Control Center
        </button>
      </div>
    </div>
  );
};
