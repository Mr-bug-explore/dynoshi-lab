/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Distributed Host Nodes & Remote ADB Agents
 */

import React, { useState, useEffect } from 'react';
import {
  Network,
  Server,
  Cloud,
  Laptop,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Terminal,
  Activity,
} from 'lucide-react';
import { DeviceNode, VirtualDevice } from '../types';

interface NodeManagerViewProps {
  devices: VirtualDevice[];
  onRefresh: () => void;
}

export const NodeManagerView: React.FC<NodeManagerViewProps> = ({ devices, onRefresh }) => {
  const [nodes, setNodes] = useState<DeviceNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // Form state
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState<'remote_agent' | 'cloud_provider'>('remote_agent');
  const [nodeHost, setNodeHost] = useState('192.168.1.150');
  const [nodePort, setNodePort] = useState('5055');
  const [nodeMaxCapacity, setNodeMaxCapacity] = useState('16');
  const [nodeAuthToken, setNodeAuthToken] = useState('');
  const [nodeLocation, setNodeLocation] = useState('LAN Lab Workstation');

  const loadNodes = () => {
    setLoading(true);
    fetch('/api/nodes')
      .then((r) => r.json())
      .then((data) => {
        setNodes(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadNodes();
  }, []);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4500);
  };

  const handleAddNode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nodeName || 'Distributed Host Agent',
          type: nodeType,
          host: nodeHost,
          port: parseInt(nodePort, 10) || 5055,
          maxCapacity: parseInt(nodeMaxCapacity, 10) || 16,
          authToken: nodeAuthToken || undefined,
          location: nodeLocation,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'online') {
          showToast(true, `Connected to ${data.name} (${data.pingMs}ms)`);
        } else {
          showToast(false, `Registered ${data.name} as OFFLINE: ${data.lastError || 'Unreachable'}`);
        }
        setShowAddModal(false);
        setNodeName('');
        loadNodes();
        onRefresh();
      } else {
        showToast(false, data.error || 'Failed to register node');
      }
    } catch (err: any) {
      showToast(false, `Error: ${err.message}`);
    }
  };

  const handleProbeNode = async (node: DeviceNode) => {
    setProbingId(node.id);
    try {
      const res = await fetch(`/api/nodes/${node.id}/probe`, { method: 'POST' });
      const updated = await res.json();
      if (updated.status === 'online') {
        showToast(true, `${updated.name} is ONLINE (${updated.pingMs}ms)`);
      } else {
        showToast(false, `${updated.name} is OFFLINE: ${updated.lastError || 'Unreachable'}`);
      }
      loadNodes();
    } catch (err: any) {
      showToast(false, `Probe error: ${err.message}`);
    } finally {
      setProbingId(null);
    }
  };

  const handleDeleteNode = async (id: string) => {
    if (id === 'node-local') {
      showToast(false, 'Cannot delete primary local node');
      return;
    }
    try {
      const res = await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(true, 'Node removed from cluster');
        loadNodes();
        onRefresh();
      }
    } catch (err: any) {
      showToast(false, `Delete failed: ${err.message}`);
    }
  };

  const getNodeDeviceCount = (nodeId: string) => {
    return devices.filter((d) => d.nodeId === nodeId).length;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070a11] overflow-hidden text-slate-200">
      {toast && (
        <div
          className={`m-4 mb-0 px-4 py-2 rounded-xl text-xs font-mono-code flex items-center gap-2 border ${
            toast.ok
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="px-6 py-4 bg-[#0a0e17] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
              Distributed Host Nodes & Remote Agents
              <span className="text-[10px] font-mono-code px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {nodes.filter((n) => n.status === 'online').length} / {nodes.length} Online
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Scale across real Windows/Linux host workstations running `scripts/dynoshi_node_agent.ts` with live HTTP `/health` verification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-950 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Remote Host Agent
          </button>
          <button
            onClick={loadNodes}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
            title="Refresh Nodes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Nodes List */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono-code flex items-start gap-3">
          <Terminal className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-slate-200 font-semibold">Launch Companion Host Agent on Remote PCs:</div>
            <div className="text-cyan-300">npx tsx scripts/dynoshi_node_agent.ts --port 5055</div>
            <div className="text-[11px] text-slate-400">
              Each remote workstation reports genuine `adb devices -l`, host CPU/RAM load, and hardware acceleration status over `/health`. Unreachable hosts are honestly marked OFFLINE.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nodes.map((node) => {
            const assignedDevices = getNodeDeviceCount(node.id);
            const isLocal = node.type === 'local';
            const isCloud = node.type === 'cloud_provider';
            const isOnline = node.status === 'online';

            return (
              <div
                key={node.id}
                className="p-5 rounded-xl bg-[#0c101b] border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl border ${
                          isLocal
                            ? 'bg-cyan-950/60 border-cyan-500/30 text-cyan-400'
                            : isCloud
                            ? 'bg-indigo-950/60 border-indigo-500/30 text-indigo-400'
                            : 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        {isLocal ? (
                          <Laptop className="w-5 h-5" />
                        ) : isCloud ? (
                          <Cloud className="w-5 h-5" />
                        ) : (
                          <Server className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{node.name}</h3>
                        <span className="text-[10px] font-mono-code text-slate-500">
                          {node.host}:{node.port}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`flex items-center gap-1 text-[10px] font-mono-code px-2 py-0.5 rounded-full border ${
                        isOnline
                          ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30'
                          : 'text-rose-400 bg-rose-950/60 border-rose-500/30'
                      }`}
                    >
                      {isOnline ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {isOnline ? `${node.pingMs}ms` : 'OFFLINE'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-3">{node.location || 'Distributed Lab Host'}</p>
                  {node.lastError && (
                    <div className="mt-2 p-2 rounded bg-rose-950/30 border border-rose-800/40 text-[10px] font-mono-code text-rose-300 break-words">
                      {node.lastError}
                    </div>
                  )}
                </div>

                {/* Node Metrics */}
                <div className="space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-900 font-mono-code text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Assigned Devices:</span>
                    <span className="text-white font-bold">{assignedDevices} devices</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Max Capacity:</span>
                    <span className="text-cyan-300">{node.maxCapacity} slots</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Node Load:</span>
                    <span className="text-slate-300">
                      {isOnline ? `CPU ${node.cpuUsagePercent}% • RAM ${node.ramUsagePercent}%` : 'Unavailable'}
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono-code">
                  <span className="text-[10px] text-slate-500 capitalize">{node.type.replace('_', ' ')}</span>
                  <div className="flex items-center gap-1.5">
                    {!isLocal && (
                      <button
                        onClick={() => handleProbeNode(node)}
                        disabled={probingId === node.id}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-950 text-cyan-300 text-[10px]"
                      >
                        {probingId === node.id ? 'Probing...' : 'Probe Health'}
                      </button>
                    )}
                    {!isLocal && (
                      <button
                        onClick={() => handleDeleteNode(node.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                        title="Remove Node"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Remote Host Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddNode}
            className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Register Distributed Host Agent
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono-code text-xs">
              <div>
                <label className="text-slate-400">Node Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab PC Workstation 02"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400">Node Type</label>
                  <select
                    value={nodeType}
                    onChange={(e: any) => setNodeType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white mt-1"
                  >
                    <option value="remote_agent">Remote LAN Agent</option>
                    <option value="cloud_provider">Cloud Android Pool</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400">Max Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="128"
                    value={nodeMaxCapacity}
                    onChange={(e) => setNodeMaxCapacity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-400">Host / IP</label>
                  <input
                    type="text"
                    required
                    value={nodeHost}
                    onChange={(e) => setNodeHost(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Port</label>
                  <input
                    type="number"
                    value={nodePort}
                    onChange={(e) => setNodePort(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400">Bearer Token (optional)</label>
                <input
                  type="text"
                  value={nodeAuthToken}
                  onChange={(e) => setNodeAuthToken(e.target.value)}
                  placeholder="Optional agent auth token"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400">Location</label>
                <input
                  type="text"
                  value={nodeLocation}
                  onChange={(e) => setNodeLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Probe & Register
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
