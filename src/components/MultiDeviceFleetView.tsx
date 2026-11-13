/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Multi-Device Fleet Manager
 */

import React, { useState } from 'react';
import {
  Users,
  Smartphone,
  CheckSquare,
  Square,
  Play,
  RotateCw,
  Package,
  PlayCircle,
  Camera,
  AlertCircle,
  Activity,
  Layers,
  Upload,
} from 'lucide-react';
import { VirtualDevice, AutomationWorkflow } from '../types';

interface MultiDeviceFleetViewProps {
  devices: VirtualDevice[];
  workflows: AutomationWorkflow[];
  onStartDevice: (id: string) => void;
  onStopDevice: (id: string) => void;
  onRestartDevice: (id: string) => void;
  onRunWorkflow: (workflowId: string, targetDeviceIds: string[]) => void;
  onTakeScreenshot: (deviceId: string) => void;
  onBatchInstallApk: (deviceIds: string[], file: File) => void;
}

export const MultiDeviceFleetView: React.FC<MultiDeviceFleetViewProps> = ({
  devices,
  workflows,
  onStartDevice,
  onStopDevice,
  onRestartDevice,
  onRunWorkflow,
  onTakeScreenshot,
  onBatchInstallApk,
}) => {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflows[0]?.id || '');
  const [isBatchInstallOpen, setIsBatchInstallOpen] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);

  const toggleSelectDevice = (id: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((dId) => dId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedDeviceIds.length === devices.length) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(devices.map((d) => d.id));
    }
  };

  const handleBatchStart = () => {
    selectedDeviceIds.forEach((id) => onStartDevice(id));
  };

  const handleBatchStop = () => {
    selectedDeviceIds.forEach((id) => onStopDevice(id));
  };

  const handleBatchRestart = () => {
    selectedDeviceIds.forEach((id) => onRestartDevice(id));
  };

  const handleBatchScreenshot = () => {
    selectedDeviceIds.forEach((id) => onTakeScreenshot(id));
  };

  const handleBatchRunWorkflow = () => {
    if (!selectedWorkflowId || selectedDeviceIds.length === 0) return;
    onRunWorkflow(selectedWorkflowId, selectedDeviceIds);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              MULTI-DEVICE FLEET MANAGEMENT
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-violet-950/80 text-violet-400 border border-violet-800/60">
              BATCH WORKSPACE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Execute synchronized batch operations, parallel APK deployments, and automated testing suites across selected device targets.
          </p>
        </div>

        {/* Selected Count Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono-code">
          <span className="text-slate-400">Selected:</span>
          <span className="px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
            {selectedDeviceIds.length} / {devices.length} Devices
          </span>
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            {selectedDeviceIds.length === devices.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Batch Control Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono-code text-slate-400 font-semibold mr-1">
            Batch Actions:
          </span>

          <button
            onClick={handleBatchStart}
            disabled={selectedDeviceIds.length === 0}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-tech font-semibold flex items-center gap-1.5 shadow-md transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Selected</span>
          </button>

          <button
            onClick={handleBatchStop}
            disabled={selectedDeviceIds.length === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 disabled:opacity-40 text-slate-200 text-xs font-mono-code flex items-center gap-1.5 transition"
          >
            <Square className="w-3 h-3 text-rose-400 fill-current" />
            <span>Stop Selected</span>
          </button>

          <button
            onClick={handleBatchRestart}
            disabled={selectedDeviceIds.length === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-mono-code flex items-center gap-1.5 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Restart Selected</span>
          </button>

          <button
            onClick={() => setIsBatchInstallOpen(true)}
            disabled={selectedDeviceIds.length === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 disabled:opacity-40 text-slate-200 text-xs font-mono-code flex items-center gap-1.5 transition border border-slate-700"
          >
            <Package className="w-3.5 h-3.5 text-cyan-400" />
            <span>Batch Install APK</span>
          </button>

          <button
            onClick={handleBatchScreenshot}
            disabled={selectedDeviceIds.length === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-mono-code flex items-center gap-1.5 transition"
          >
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span>Batch Screenshot</span>
          </button>
        </div>

        {/* Workflow Runner on Batch Selection */}
        <div className="flex items-center gap-2">
          <select
            value={selectedWorkflowId}
            onChange={(e) => setSelectedWorkflowId(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono-code"
          >
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name} ({wf.steps.length} steps)
              </option>
            ))}
          </select>
          <button
            onClick={handleBatchRunWorkflow}
            disabled={selectedDeviceIds.length === 0}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-tech font-bold flex items-center gap-1.5 shadow-lg shadow-violet-600/30 transition"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Run on Selected ({selectedDeviceIds.length})</span>
          </button>
        </div>
      </div>

      {/* Device Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {devices.map((device) => {
          const isSelected = selectedDeviceIds.includes(device.id);
          const isRunning = device.status === 'running';

          return (
            <div
              key={device.id}
              onClick={() => toggleSelectDevice(device.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-cyan-950/40 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                  <span className="font-tech font-bold text-sm text-slate-100">{device.name}</span>
                </div>
                <span
                  className={`text-[9px] font-mono-code uppercase px-1.5 py-0.5 rounded ${
                    isRunning ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {device.status}
                </span>
              </div>

              <div className="font-mono-code text-[11px] text-slate-400 space-y-1">
                <div>Model: {device.model}</div>
                <div>Android: {device.androidVersion}</div>
                <div>Resolution: {device.resolution.width}x{device.resolution.height}</div>
                {isRunning && (
                  <div className="text-cyan-400 pt-1">
                    CPU: {device.cpuUsage}% | RAM: {device.ramUsage}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Batch Install APK */}
      {isBatchInstallOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800 rounded-2xl max-w-md w-full p-6 text-xs text-slate-200 shadow-2xl space-y-4">
            <h2 className="font-tech text-base font-bold text-white">
              Batch Install APK to {selectedDeviceIds.length} Devices
            </h2>
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center space-y-2">
              <Upload className="w-8 h-8 text-cyan-400 mx-auto" />
              <div className="font-semibold text-slate-300">
                {batchFile ? batchFile.name : 'Choose APK Package'}
              </div>
              <input
                type="file"
                accept=".apk"
                onChange={(e) => {
                  if (e.target.files?.[0]) setBatchFile(e.target.files[0]);
                }}
                className="text-xs text-slate-500 font-mono-code"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsBatchInstallOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-400"
              >
                Cancel
              </button>
              <button
                disabled={!batchFile}
                onClick={() => {
                  if (batchFile) {
                    onBatchInstallApk(selectedDeviceIds, batchFile);
                    setIsBatchInstallOpen(false);
                    setBatchFile(null);
                  }
                }}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-tech font-bold"
              >
                Start Deployment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
