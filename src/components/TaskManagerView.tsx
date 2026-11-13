/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Task Queue Manager View
 */

import React from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Smartphone,
  Layers,
  Activity,
  X,
} from 'lucide-react';
import { LabTask } from '../types';

interface TaskManagerViewProps {
  tasks: LabTask[];
  onCancelTask: (id: string) => void;
}

export const TaskManagerView: React.FC<TaskManagerViewProps> = ({ tasks, onCancelTask }) => {
  const running = tasks.filter((t) => t.status === 'running');
  const completed = tasks.filter((t) => t.status === 'completed');
  const failed = tasks.filter((t) => t.status === 'failed' || t.status === 'cancelled');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              TASK MANAGER & JOB QUEUE
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60">
              ORCHESTRATOR
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track asynchronous emulator launches, background APK deployments, and batch automation test queues.
          </p>
        </div>

        {/* Task Counter Badges */}
        <div className="flex items-center gap-2 font-mono-code text-xs">
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
            Total: {tasks.length}
          </span>
          <span className="px-2.5 py-1 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
            Running: {running.length}
          </span>
          <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
            Done: {completed.length}
          </span>
        </div>
      </div>

      {/* Task Queue Table */}
      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 font-mono-code text-[11px] text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Task Title</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Progress</th>
              <th className="py-3 px-4">Target Devices</th>
              <th className="py-3 px-4">Started At</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono-code text-[11px]">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-semibold text-slate-200">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{task.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 uppercase text-[10px]">
                    {task.type.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        task.status === 'running'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-600/50 animate-pulse'
                          : task.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40'
                          : 'bg-rose-950 text-rose-400'
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 w-40">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{task.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            task.status === 'completed'
                              ? 'bg-emerald-400'
                              : task.status === 'failed'
                              ? 'bg-rose-500'
                              : 'bg-cyan-400'
                          }`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {task.targetDeviceIds.join(', ')}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(task.startedAt).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {task.status === 'running' && (
                      <button
                        onClick={() => onCancelTask(task.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950 text-rose-300 text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 font-mono-code">
                  No active or completed tasks in queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
