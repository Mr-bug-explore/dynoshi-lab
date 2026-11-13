/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real ADB File Explorer View
 */

import React, { useState, useEffect } from 'react';
import {
  Folder,
  Upload,
  Download,
  ChevronRight,
  RefreshCw,
  FileText,
  FileCode,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { VirtualDevice, DeviceFileItem } from '../types';

interface FileManagerViewProps {
  devices: VirtualDevice[];
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({ devices }) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || '');
  const [currentPath, setCurrentPath] = useState<string>('/sdcard');
  const [files, setFiles] = useState<DeviceFileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (devices.length > 0 && (!selectedDeviceId || !devices.some((d) => d.id === selectedDeviceId))) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  const fetchFiles = async (devId: string, pathUrl: string) => {
    if (!devId) {
      setFiles([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/devices/${devId}/files?path=${encodeURIComponent(pathUrl)}`);
      const data = await res.json();
      if (!res.ok) {
        setFiles([]);
        setFeedback({ ok: false, msg: data.error || 'Failed to list files via ADB.' });
      } else {
        setFiles(data.items || []);
        setCurrentPath(data.currentPath || pathUrl);
        setFeedback(null);
      }
    } catch (e: any) {
      setFiles([]);
      setFeedback({ ok: false, msg: `ADB ls failed: ${e.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDeviceId) {
      fetchFiles(selectedDeviceId, currentPath);
    }
  }, [selectedDeviceId]);

  const handleNavigate = (newPath: string) => {
    fetchFiles(selectedDeviceId, newPath);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDeviceId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetDir', currentPath);

    try {
      const res = await fetch(`/api/devices/${selectedDeviceId}/files/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ ok: false, msg: data.error || `adb push failed for ${file.name}` });
      } else {
        setFeedback({ ok: true, msg: `Pushed ${file.name} -> ${data.targetPath}` });
        fetchFiles(selectedDeviceId, currentPath);
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: `Upload error: ${err.message}` });
    }
  };

  const handleDownload = async (item: DeviceFileItem) => {
    if (!selectedDeviceId) return;
    try {
      const url = `/api/devices/${selectedDeviceId}/files/download?path=${encodeURIComponent(item.path)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setFeedback({ ok: false, msg: errData.error || `adb pull failed for ${item.path}` });
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(objUrl);
      setFeedback({ ok: true, msg: `Pulled ${item.path} (${blob.size} bytes) via adb pull` });
    } catch (err: any) {
      setFeedback({ ok: false, msg: `Pull error: ${err.message}` });
    }
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              DEVICE FILE EXPLORER
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              REAL ADB PUSH / PULL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse real Android internal storage via `adb shell ls -la`, push files with `adb push`, and download with `adb pull`.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono-code text-slate-400">Target Device:</span>
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              setCurrentPath('/sdcard');
            }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono-code"
          >
            {devices.length === 0 ? (
              <option value="">No Devices Attached</option>
            ) : (
              devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.adbSerial || d.status})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Status Alert */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-mono-code flex items-center gap-2 border ${
            feedback.ok
              ? 'bg-emerald-950/70 border-emerald-600/60 text-emerald-300'
              : 'bg-rose-950/70 border-rose-600/60 text-rose-300'
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Navigation Toolbar */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-mono-code text-slate-300 overflow-x-auto">
          <button
            onClick={() => handleNavigate('/')}
            className="hover:text-cyan-400 font-semibold px-1 rounded hover:bg-slate-800"
          >
            /root
          </button>
          {pathParts.map((part, idx) => {
            const full = '/' + pathParts.slice(0, idx + 1).join('/');
            return (
              <React.Fragment key={full}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <button
                  onClick={() => handleNavigate(full)}
                  className="hover:text-cyan-400 font-semibold px-1 rounded hover:bg-slate-800 shrink-0"
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchFiles(selectedDeviceId, currentPath)}
            disabled={!selectedDeviceId}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <label className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-tech font-bold flex items-center gap-1.5 cursor-pointer shadow-md">
            <Upload className="w-3.5 h-3.5" />
            <span>Push File to Device</span>
            <input type="file" onChange={handleUpload} className="hidden" disabled={!selectedDeviceId} />
          </label>
        </div>
      </div>

      {/* File List Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        {files.length === 0 ? (
          <div className="p-10 text-center text-xs font-mono-code text-slate-500">
            {selectedDeviceId
              ? 'Directory empty or device not attached via ADB.'
              : 'Attach a running Android device to browse its filesystem.'}
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 font-mono-code text-[11px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Permissions</th>
                <th className="py-3 px-4">Owner / Group</th>
                <th className="py-3 px-4">Modified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-code text-[11px]">
              {files.map((file) => (
                <tr key={file.path} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-semibold text-slate-200">
                    {file.isDirectory ? (
                      <button
                        onClick={() => handleNavigate(file.path)}
                        className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-bold"
                      >
                        <Folder className="w-4 h-4 fill-cyan-950 text-cyan-400" />
                        <span>{file.name}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {file.name.endsWith('.png') || file.name.endsWith('.jpg') ? (
                          <ImageIcon className="w-4 h-4 text-violet-400" />
                        ) : file.name.endsWith('.json') || file.name.endsWith('.csv') ? (
                          <FileCode className="w-4 h-4 text-amber-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400" />
                        )}
                        <span>{file.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {file.isDirectory ? '-' : `${(file.sizeBytes / 1024).toFixed(1)} KB`}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{file.permissions}</td>
                  <td className="py-3 px-4 text-slate-500">
                    {file.owner}:{file.group}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{file.modifiedAt}</td>
                  <td className="py-3 px-4 text-right">
                    {!file.isDirectory && (
                      <button
                        onClick={() => handleDownload(file)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-300 flex items-center gap-1 ml-auto"
                        title="Pull File to Desktop"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Pull</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
