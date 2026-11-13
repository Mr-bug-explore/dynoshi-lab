/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real Logs, ADB Logcat & Test Reports View
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Search,
  Terminal,
  FileCode,
  Printer,
  Database,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { LogEntry, TestExecutionReport, VirtualDevice } from '../types';

interface LogsAndReportsViewProps {
  devices: VirtualDevice[];
  reports: TestExecutionReport[];
}

export const LogsAndReportsView: React.FC<LogsAndReportsViewProps> = ({ devices, reports }) => {
  const [activeTab, setActiveTab] = useState<'logcat' | 'reports'>('logcat');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('all');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<TestExecutionReport | null>(null);
  const [logcatError, setLogcatError] = useState<string | null>(null);
  const [isFetchingLogcat, setIsFetchingLogcat] = useState(false);

  const fetchLogs = async () => {
    try {
      const q = new URLSearchParams();
      if (selectedDeviceId !== 'all') q.set('deviceId', selectedDeviceId);
      if (selectedLogLevel !== 'all') q.set('level', selectedLogLevel);
      const res = await fetch(`/api/logs?${q.toString()}`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch {}
  };

  const handlePullDeviceLogcat = async () => {
    const targetId =
      selectedDeviceId !== 'all'
        ? selectedDeviceId
        : devices.find((d) => d.status === 'running' && d.adbSerial)?.id;
    if (!targetId) {
      setLogcatError('Select an attached running Android device to pull live adb logcat.');
      return;
    }
    setIsFetchingLogcat(true);
    setLogcatError(null);
    try {
      const res = await fetch(`/api/devices/${targetId}/logcat?lines=150`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLogcatError(data.error || 'Failed to pull adb logcat.');
      } else {
        setLogs(data.entries || []);
      }
    } catch (err: any) {
      setLogcatError(err.message);
    } finally {
      setIsFetchingLogcat(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [selectedDeviceId, selectedLogLevel]);

  const handleExportCsv = () => {
    window.location.href = '/api/reports/export?format=csv';
  };

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reports, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `dynoshi_reports_${Date.now()}.json`);
    dlAnchorElem.click();
  };

  const handleExportSql = () => {
    window.location.href = '/api/sql/export';
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const filteredLogs = logs.filter((l) => {
    const text = `${l.tag} ${l.message}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              LOGS, ADB LOGCAT & TEST REPORTS
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              AUDIT TRAIL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Inspect real backend daemon logs, pull live `adb logcat -d` from connected devices, and export test execution reports.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-code text-slate-200 flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-code text-slate-200 flex items-center gap-1.5 transition"
          >
            <FileCode className="w-3.5 h-3.5 text-violet-400" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handleExportSql}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-code text-slate-200 flex items-center gap-1.5 transition"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>SQLite Dump</span>
          </button>
          <button
            onClick={handlePrintPdf}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-tech font-bold flex items-center gap-1.5 shadow-md transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('logcat')}
          className={`px-4 py-2 rounded-lg text-xs font-tech font-bold transition flex items-center gap-2 ${
            activeTab === 'logcat'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Lab Logs & ADB Logcat</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-lg text-xs font-tech font-bold transition flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Test Execution Reports ({reports.length})</span>
        </button>
      </div>

      {activeTab === 'logcat' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter log messages or tags..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono-code"
                />
              </div>

              <select
                value={selectedLogLevel}
                onChange={(e) => setSelectedLogLevel(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono-code"
              >
                <option value="all">All Levels</option>
                <option value="V">V - Verbose</option>
                <option value="D">D - Debug</option>
                <option value="I">I - Info</option>
                <option value="W">W - Warning</option>
                <option value="E">E - Error</option>
              </select>

              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono-code"
              >
                <option value="all">All Lab Logs</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handlePullDeviceLogcat}
                disabled={isFetchingLogcat}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono-code flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingLogcat ? 'animate-spin' : ''}`} />
                <span>Pull Live `adb logcat`</span>
              </button>
            </div>

            <div className="text-xs font-mono-code text-slate-500">
              {filteredLogs.length} entries
            </div>
          </div>

          {logcatError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700/60 text-xs font-mono-code text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{logcatError}</span>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-black border border-slate-800 font-mono-code text-[11px] space-y-1 max-h-[500px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-6">No log entries recorded yet.</div>
            ) : (
              filteredLogs.map((log) => {
                const levelColor =
                  log.level === 'E'
                    ? 'text-rose-400 bg-rose-950/60'
                    : log.level === 'W'
                    ? 'text-amber-400 bg-amber-950/60'
                    : log.level === 'I'
                    ? 'text-emerald-400'
                    : log.level === 'D'
                    ? 'text-sky-400'
                    : 'text-slate-500';

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 leading-relaxed hover:bg-slate-900/60 px-1 rounded"
                  >
                    <span className="text-slate-600 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`px-1.5 rounded font-bold shrink-0 ${levelColor}`}>
                      {log.level}
                    </span>
                    <span className="text-cyan-400 shrink-0 font-semibold truncate max-w-[140px]">
                      {log.tag}:
                    </span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
            {reports.length === 0 ? (
              <div className="p-10 text-center text-xs font-mono-code text-slate-500">
                No automation test reports recorded yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 font-mono-code text-[11px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Workflow Name</th>
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Steps (Passed/Total)</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Executed At</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono-code text-[11px]">
                  {reports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-slate-200">{rep.workflowName}</td>
                      <td className="py-3 px-4 text-slate-400">{rep.deviceName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            rep.status === 'passed'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40'
                              : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {rep.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {rep.passedSteps} / {rep.totalSteps}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {(rep.durationMs / 1000).toFixed(2)}s
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(rep.startTime).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedReport(rep)}
                          className="px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 hover:bg-cyan-900 font-tech font-bold"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selectedReport && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-cyan-800 rounded-2xl max-w-xl w-full p-6 text-xs text-slate-200 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h2 className="font-tech text-base font-bold text-white">
                      Test Report: {selectedReport.workflowName}
                    </h2>
                    <div className="text-[11px] text-slate-400 font-mono-code">
                      Device: {selectedReport.deviceName} • Status: {selectedReport.status.toUpperCase()}
                    </div>
                  </div>
                  <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-white">
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold text-slate-300 font-mono-code text-[11px]">
                    Step Execution Trail ({selectedReport.stepLogs.length} steps):
                  </div>
                  <div className="space-y-1.5 font-mono-code text-[11px]">
                    {selectedReport.stepLogs.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">
                            {idx + 1}. {step.stepLabel}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              step.status === 'passed' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {step.durationMs}ms [{step.status.toUpperCase()}]
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 break-all">{step.log}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="px-4 py-1.5 rounded bg-slate-800 text-slate-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
