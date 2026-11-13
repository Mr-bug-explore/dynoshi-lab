/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real ADB Automation Studio
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  Smartphone,
  FileCode,
} from 'lucide-react';
import { AutomationWorkflow, AutomationStep, VirtualDevice, TestExecutionReport } from '../types';

interface AutomationStudioViewProps {
  workflows: AutomationWorkflow[];
  devices: VirtualDevice[];
  onSaveWorkflow: (wf: AutomationWorkflow) => void;
  onDeleteWorkflow: (id: string) => void;
  onRunWorkflow: (workflowId: string, targetDeviceIds: string[]) => Promise<any>;
  reports: TestExecutionReport[];
}

export const AutomationStudioView: React.FC<AutomationStudioViewProps> = ({
  workflows,
  devices,
  onSaveWorkflow,
  onRunWorkflow,
  reports,
}) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflows[0]?.id || '');
  const [isRunning, setIsRunning] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<Array<{ ok: boolean; text: string }>>([]);
  const [lastRunReport, setLastRunReport] = useState<TestExecutionReport | null>(null);
  const [targetDeviceIds, setTargetDeviceIds] = useState<string[]>(
    devices.length > 0 ? [devices[0].id] : []
  );
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [newStepType, setNewStepType] = useState<AutomationStep['type']>('launch_app');
  const [newStepLabel, setNewStepLabel] = useState('');
  const [newStepParams, setNewStepParams] = useState<Record<string, any>>({});

  useEffect(() => {
    if (devices.length > 0 && targetDeviceIds.length === 0) {
      setTargetDeviceIds([devices[0].id]);
    }
  }, [devices]);

  const activeWorkflow = workflows.find((w) => w.id === selectedWorkflowId) || workflows[0];

  const handleToggleTargetDevice = (devId: string) => {
    setTargetDeviceIds((prev) =>
      prev.includes(devId) ? prev.filter((id) => id !== devId) : [...prev, devId]
    );
  };

  const handleAddStep = () => {
    if (!activeWorkflow) return;
    const step: AutomationStep = {
      id: `s-${Date.now().toString(36)}`,
      type: newStepType,
      label: newStepLabel || `Step: ${newStepType.replace('_', ' ').toUpperCase()}`,
      params: newStepParams,
      timeoutMs: 3000,
    };

    const updated = {
      ...activeWorkflow,
      steps: [...activeWorkflow.steps, step],
      updatedAt: new Date().toISOString(),
    };
    onSaveWorkflow(updated);
    setIsAddStepModalOpen(false);
    setNewStepLabel('');
    setNewStepParams({});
  };

  const handleDeleteStep = (stepId: string) => {
    if (!activeWorkflow) return;
    const updated = {
      ...activeWorkflow,
      steps: activeWorkflow.steps.filter((s) => s.id !== stepId),
      updatedAt: new Date().toISOString(),
    };
    onSaveWorkflow(updated);
  };

  const handleExecute = async () => {
    if (!activeWorkflow || targetDeviceIds.length === 0) return;
    setIsRunning(true);
    setLastRunReport(null);
    setExecutionLogs([
      {
        ok: true,
        text: `[${new Date().toLocaleTimeString()}] Dispatching "${activeWorkflow.name}" to ${targetDeviceIds.length} ADB target(s)...`,
      },
    ]);

    try {
      const result = await onRunWorkflow(activeWorkflow.id, targetDeviceIds);
      const runReports: TestExecutionReport[] = result?.reports || [];
      if (runReports.length > 0) {
        setLastRunReport(runReports[0]);
        const lines: Array<{ ok: boolean; text: string }> = [];
        for (const rep of runReports) {
          lines.push({
            ok: rep.status === 'passed',
            text: `Device "${rep.deviceName}": ${rep.status.toUpperCase()} (${rep.passedSteps}/${rep.totalSteps} passed, ${rep.failedSteps} failed, ${rep.durationMs}ms)`,
          });
          for (const sl of rep.stepLogs) {
            lines.push({
              ok: sl.status === 'passed',
              text: `  [${sl.status.toUpperCase()}] ${sl.stepLabel} (${sl.durationMs}ms) -> ${sl.log}`,
            });
          }
        }
        setExecutionLogs((prev) => [...prev, ...lines]);
      } else {
        setExecutionLogs((prev) => [
          ...prev,
          { ok: false, text: result?.error || 'Workflow execution returned no device reports.' },
        ]);
      }
    } catch (err: any) {
      setExecutionLogs((prev) => [
        ...prev,
        { ok: false, text: `[ERROR] Execution failed: ${err?.message || String(err)}` },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              AUTOMATION STUDIO
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-800/60">
              REAL ADB RUNNER
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Execute genuine ADB commands (`monkey`, `input tap/swipe/keyevent`, `am start`, `screencap -p`) across live Android devices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newWf: AutomationWorkflow = {
                id: `wf-${Date.now().toString(36)}`,
                name: `Custom ADB Suite ${workflows.length + 1}`,
                description: 'Real ADB action sequence',
                category: 'Custom',
                steps: [
                  { id: 's1', type: 'launch_app', label: 'Launch Android Settings', params: { packageName: 'com.android.settings' } },
                  { id: 's2', type: 'wait', label: 'Wait 1000ms', params: { durationMs: 1000 } },
                  { id: 's3', type: 'screenshot', label: 'Capture PNG Checkpoint', params: { tag: 'checkpoint' } },
                ],
                targetDeviceIds: devices.length > 0 ? [devices[0].id] : [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              onSaveWorkflow(newWf);
              setSelectedWorkflowId(newWf.id);
            }}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>New Workflow</span>
          </button>

          <button
            onClick={handleExecute}
            disabled={isRunning || !activeWorkflow || targetDeviceIds.length === 0}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-40 text-white text-xs font-tech font-bold tracking-wider flex items-center gap-1.5 shadow-lg shadow-violet-600/30 transition"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isRunning ? 'Executing ADB Steps...' : 'Run Automation Suite'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Workflow Selector & Target Devices */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="text-xs font-mono-code text-slate-400 font-semibold uppercase tracking-wider">
              Test Workflows ({workflows.length})
            </div>

            <div className="space-y-2">
              {workflows.map((wf) => {
                const isSelected = wf.id === activeWorkflow?.id;
                return (
                  <div
                    key={wf.id}
                    onClick={() => setSelectedWorkflowId(wf.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-500/80 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-tech font-bold text-sm text-slate-100 truncate">
                        {wf.name}
                      </div>
                      <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {wf.steps.length} steps
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 font-mono-code">
                      {wf.description || 'No description provided'}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[10px] font-mono-code text-slate-500">
                      <span>Category: {wf.category}</span>
                      <span
                        className={
                          wf.lastRunStatus === 'passed'
                            ? 'text-emerald-400'
                            : wf.lastRunStatus === 'failed'
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }
                      >
                        {wf.lastRunStatus ? wf.lastRunStatus.toUpperCase() : 'IDLE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 font-mono-code text-xs">
            <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              Target Execution Devices ({targetDeviceIds.length})
            </div>
            <div className="space-y-1.5">
              {devices.length === 0 ? (
                <div className="text-[11px] text-slate-500">No Android devices attached.</div>
              ) : (
                devices.map((d) => {
                  const isSelected = targetDeviceIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => handleToggleTargetDevice(d.id)}
                      className={`w-full flex items-center justify-between p-2 rounded border text-left transition ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-600 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="truncate">{d.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{d.status}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Action Sequence & Real Output */}
        <div className="lg:col-span-8 space-y-4">
          {activeWorkflow ? (
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="font-tech text-lg font-bold text-white">{activeWorkflow.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{activeWorkflow.description}</p>
                </div>
                <button
                  onClick={() => setIsAddStepModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-tech font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Action Step</span>
                </button>
              </div>

              <div className="space-y-2">
                {activeWorkflow.steps.map((step, idx) => {
                  const stepResult = lastRunReport?.stepLogs.find((s) => s.stepId === step.id);
                  const passed = stepResult?.status === 'passed';
                  const failed = stepResult?.status === 'failed';

                  return (
                    <div
                      key={step.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        passed
                          ? 'bg-emerald-950/20 border-emerald-800/60'
                          : failed
                          ? 'bg-rose-950/20 border-rose-800/60'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono-code font-bold shrink-0 ${
                            passed
                              ? 'bg-emerald-500 text-black'
                              : failed
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <div className="min-w-0">
                          <div className="text-xs font-tech font-bold text-slate-100 flex items-center gap-2">
                            <span>{step.label}</span>
                            <span className="text-[10px] font-mono-code px-1.5 rounded bg-slate-800 text-cyan-400 uppercase">
                              {step.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono-code mt-0.5 truncate">
                            Params: {JSON.stringify(step.params)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {passed && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {failed && <XCircle className="w-4 h-4 text-rose-400" />}
                        <button
                          onClick={() => handleDeleteStep(step.id)}
                          className="p-1 rounded hover:bg-rose-950 hover:text-rose-400 text-slate-500 transition"
                          title="Remove Step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {executionLogs.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-black/80 border border-slate-800 font-mono-code text-[11px] space-y-1 max-h-56 overflow-y-auto">
                  <div className="text-cyan-400 font-semibold mb-1 pb-1 border-b border-slate-800 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>ADB Execution Output ({reports.length} historical reports)</span>
                  </div>
                  {executionLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`leading-relaxed break-all ${log.ok ? 'text-emerald-300' : 'text-rose-300'}`}
                    >
                      {log.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 font-mono-code">Select a workflow</div>
          )}
        </div>
      </div>

      {/* MODAL: Add Action Step */}
      {isAddStepModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800 rounded-2xl max-w-md w-full p-6 text-xs text-slate-200 shadow-2xl space-y-4">
            <h2 className="font-tech text-base font-bold text-white">Add ADB Automation Step</h2>

            <div className="space-y-3 font-mono-code">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Action Type:</label>
                <select
                  value={newStepType}
                  onChange={(e) => {
                    setNewStepType(e.target.value as any);
                    setNewStepParams({});
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                >
                  <option value="launch_app">Launch Android Package (`monkey`)</option>
                  <option value="open_url">Open Browser URL (`am start -a VIEW`)</option>
                  <option value="tap_coords">Tap Coordinates (`input tap`)</option>
                  <option value="enter_text">Enter Text (`input text`)</option>
                  <option value="swipe">Swipe (`input swipe`)</option>
                  <option value="wait">Wait Delay (ms)</option>
                  <option value="press_key">Press Hardware Key (`input keyevent`)</option>
                  <option value="screenshot">Capture Real PNG (`screencap -p`)</option>
                  <option value="shell_cmd">Execute ADB Command (`adb ...`)</option>
                  <option value="close_app">Force-Stop Package (`am force-stop`)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Step Label:</label>
                <input
                  type="text"
                  value={newStepLabel}
                  onChange={(e) => setNewStepLabel(e.target.value)}
                  placeholder="e.g. Launch Play Store"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                />
              </div>

              {(newStepType === 'launch_app' || newStepType === 'close_app') && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Package Name:</label>
                  <input
                    type="text"
                    onChange={(e) => setNewStepParams({ packageName: e.target.value })}
                    placeholder="e.g. com.android.vending"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              )}

              {newStepType === 'open_url' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Target URL:</label>
                  <input
                    type="text"
                    onChange={(e) => setNewStepParams({ url: e.target.value })}
                    placeholder="https://play.google.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              )}

              {newStepType === 'shell_cmd' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ADB Arguments (after -s serial):</label>
                  <input
                    type="text"
                    onChange={(e) => setNewStepParams({ command: e.target.value })}
                    placeholder="shell getprop ro.build.version.release"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              )}

              {newStepType === 'tap_coords' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">X Coordinate:</label>
                    <input
                      type="number"
                      onChange={(e) =>
                        setNewStepParams((p) => ({ ...p, x: Number(e.target.value) }))
                      }
                      placeholder="540"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Y Coordinate:</label>
                    <input
                      type="number"
                      onChange={(e) =>
                        setNewStepParams((p) => ({ ...p, y: Number(e.target.value) }))
                      }
                      placeholder="960"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                </div>
              )}

              {newStepType === 'enter_text' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Text to Type:</label>
                  <input
                    type="text"
                    onChange={(e) => setNewStepParams({ text: e.target.value })}
                    placeholder="Hello Android"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              )}

              {newStepType === 'wait' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Duration (ms):</label>
                  <input
                    type="number"
                    onChange={(e) => setNewStepParams({ durationMs: Number(e.target.value) })}
                    placeholder="1000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              )}

              {newStepType === 'press_key' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Keycode:</label>
                  <select
                    onChange={(e) => setNewStepParams({ keyCode: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="3">3 - Home Key</option>
                    <option value="4">4 - Back Key</option>
                    <option value="26">26 - Power Button</option>
                    <option value="187">187 - Recent Apps</option>
                    <option value="66">66 - Enter Key</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddStepModalOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStep}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold"
              >
                Add Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
