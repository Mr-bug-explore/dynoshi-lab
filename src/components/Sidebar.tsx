/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Sidebar Navigation
 */

import React from 'react';
import {
  LayoutDashboard,
  Smartphone,
  Gamepad2,
  Users,
  Package,
  PlayCircle,
  FolderTree,
  Camera,
  Layers,
  Clock,
  FileText,
  Settings,
  Download,
  Activity,
  HardDrive,
  Cpu,
  MonitorPlay,
  ShieldCheck,
  Gauge,
  Network,
  Bot,
} from 'lucide-react';
import { SystemStatusResponse } from '../types';

export type NavTab =
  | 'dashboard'
  | 'devices'
  | 'control'
  | 'screenwall'
  | 'googletesting'
  | 'resources'
  | 'nodes'
  | 'fleet'
  | 'apps'
  | 'automation'
  | 'files'
  | 'media'
  | 'profiles'
  | 'tasks'
  | 'logs'
  | 'assistant'
  | 'settings'
  | 'packaging';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  status: SystemStatusResponse | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, status }) => {
  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; badge?: string | number }> = [
    { id: 'dashboard', label: 'Lab Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'devices',
      label: 'Device & AVD Manager',
      icon: <Smartphone className="w-4 h-4" />,
      badge: status?.totalDevices,
    },
    {
      id: 'screenwall',
      label: 'Live Screen Wall',
      icon: <MonitorPlay className="w-4 h-4" />,
      badge: status?.runningDevices ? `${status.runningDevices} Live` : undefined,
    },
    {
      id: 'control',
      label: 'Live Device Control',
      icon: <Gamepad2 className="w-4 h-4" />,
    },
    {
      id: 'googletesting',
      label: 'ADB & Play Audit',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'resources',
      label: 'Resource Governor',
      icon: <Gauge className="w-4 h-4" />,
      badge: status?.capacity ? `${status.capacity.availableSlots} free` : undefined,
    },
    {
      id: 'nodes',
      label: 'Distributed Nodes',
      icon: <Network className="w-4 h-4" />,
      badge: status?.nodesCount ?? 1,
    },
    { id: 'fleet', label: 'Multi-Device Fleet', icon: <Users className="w-4 h-4" /> },
    { id: 'apps', label: 'Application Manager', icon: <Package className="w-4 h-4" /> },
    { id: 'automation', label: 'Automation Studio', icon: <PlayCircle className="w-4 h-4" /> },
    { id: 'files', label: 'File Explorer', icon: <FolderTree className="w-4 h-4" /> },
    { id: 'media', label: 'Screenshots & Media', icon: <Camera className="w-4 h-4" /> },
    { id: 'profiles', label: 'Device Profiles', icon: <Layers className="w-4 h-4" /> },
    {
      id: 'tasks',
      label: 'Task Queue',
      icon: <Clock className="w-4 h-4" />,
      badge: status?.activeTasks && status.activeTasks > 0 ? status.activeTasks : undefined,
    },
    { id: 'logs', label: 'Logs & Reports', icon: <FileText className="w-4 h-4" /> },
    {
      id: 'assistant',
      label: 'AI Lab Assistant',
      icon: <Bot className="w-4 h-4" />,
      badge: 'Search',
    },
    { id: 'settings', label: 'Settings & SDK', icon: <Settings className="w-4 h-4" /> },
    { id: 'packaging', label: 'Windows Desktop Hub', icon: <Download className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-[#0a0e17] border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none">
      {/* Top Nav List */}
      <div className="p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] uppercase font-mono-code tracking-wider text-slate-500 font-semibold">
          Laboratory Navigation
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-950/80 to-slate-900 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono-code px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Telemetry Card */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="rounded-lg p-2.5 bg-slate-900/60 border border-slate-800/60 text-slate-400 text-[11px] font-mono-code space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Host Telemetry</span>
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded border ${
                status?.diagnostics?.kvmAvailable
                  ? 'text-emerald-400 bg-emerald-950/80 border-emerald-600/30'
                  : 'text-amber-400 bg-amber-950/80 border-amber-600/30'
              }`}
            >
              {status?.diagnostics?.kvmAvailable ? 'KVM READY' : 'NO KVM'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="flex items-center gap-1 text-slate-500">
                <Cpu className="w-3 h-3 text-sky-400" /> Host RAM
              </span>
              <span className="text-slate-300">
                {status?.hostMetrics?.ramUsagePercent ?? 0}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
              <div
                className="bg-sky-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${status?.hostMetrics?.ramUsagePercent ?? 0}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
            <span>ADB Bridge</span>
            <span
              className={
                status?.adb?.isAdbAvailable ? 'text-emerald-400 font-semibold' : 'text-rose-400'
              }
            >
              {status?.adb?.isAdbAvailable ? 'Real ADB' : 'Missing'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
