/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real Screenshot & Media Vault
 */

import React, { useState } from 'react';
import {
  Camera,
  Download,
  Trash2,
  Eye,
  Calendar,
  X,
  Video,
} from 'lucide-react';
import { MediaItem, VirtualDevice } from '../types';

interface MediaCenterViewProps {
  media: MediaItem[];
  devices: VirtualDevice[];
  onTakeScreenshot: (deviceId: string) => void;
  onDeleteMedia: (id: string) => void;
}

export const MediaCenterView: React.FC<MediaCenterViewProps> = ({
  media,
  devices,
  onTakeScreenshot,
  onDeleteMedia,
}) => {
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState<string>('all');
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);

  const filteredMedia = media.filter((item) => {
    if (selectedDeviceFilter === 'all') return true;
    return item.deviceId === selectedDeviceFilter;
  });

  const handleDownload = (item: MediaItem) => {
    const a = document.createElement('a');
    a.href = item.url;
    const ext = item.type === 'recording' ? 'mp4' : 'png';
    a.download = `dynoshi_${item.deviceName.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
    a.click();
  };

  const runningDevices = devices.filter((d) => d.status === 'running' && d.adbSerial);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              SCREENSHOT & MEDIA CENTER
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              REAL PNG & MP4 CAPTURES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            View genuine PNG screenshots (`adb exec-out screencap -p`) and MP4 recordings (`adb shell screenrecord`) from running Android devices.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {runningDevices.length > 0 && (
            <button
              onClick={() => onTakeScreenshot(runningDevices[0].id)}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-tech font-bold flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture {runningDevices[0].name}</span>
            </button>
          )}
          <span className="text-xs font-mono-code text-slate-400">Filter Device:</span>
          <select
            value={selectedDeviceFilter}
            onChange={(e) => setSelectedDeviceFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono-code"
          >
            <option value="all">All Devices ({media.length})</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Media Grid */}
      {filteredMedia.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMedia.map((item) => (
            <div
              key={item.id}
              className="rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-600/50 transition overflow-hidden group flex flex-col justify-between"
            >
              {/* Real Captured PNG or MP4 Thumbnail */}
              <div
                onClick={() => setLightboxItem(item)}
                className="h-48 bg-black flex items-center justify-center relative cursor-pointer overflow-hidden"
              >
                {item.type === 'recording' ? (
                  <video
                    src={item.url}
                    muted
                    playsInline
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={`Screenshot of ${item.deviceName}`}
                    className="max-h-full max-w-full object-contain"
                  />
                )}

                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono-code text-cyan-300 border border-slate-700 flex items-center gap-1">
                  {item.type === 'recording' ? <Video className="w-3 h-3 text-rose-400" /> : <Camera className="w-3 h-3" />}
                  {item.type === 'recording' ? 'MP4' : 'PNG'}
                </span>

                <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="px-3 py-1 rounded bg-cyan-600 text-white text-xs font-tech font-bold flex items-center gap-1 shadow-lg">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{item.type === 'recording' ? 'Play MP4' : 'Inspect PNG'}</span>
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 space-y-2">
                <div>
                  <div className="font-tech font-bold text-xs text-slate-200 truncate">
                    {item.deviceName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono-code flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(item.capturedAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                  <span className="text-[10px] text-slate-500 font-mono-code">
                    {item.resolution} • {(item.fileSizeBytes / 1024).toFixed(0)} KB
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDownload(item)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"
                      title="Download PNG"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteMedia(item.id)}
                      className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                      title="Delete Screenshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <Camera className="w-12 h-12 text-slate-700 mx-auto" />
          <div className="font-tech font-bold text-base text-slate-400">No Real Screenshots Captured Yet</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-mono-code">
            Attach a running Android device or emulator and capture genuine PNG framebuffers from Live Device Control or Automation Studio.
          </p>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxItem && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-cyan-800 rounded-2xl max-w-2xl w-full p-6 text-xs text-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-tech font-bold text-base text-white">
                {lightboxItem.type === 'recording' ? 'Recorded MP4:' : 'Captured PNG:'} {lightboxItem.deviceName} ({lightboxItem.resolution})
              </span>
              <button onClick={() => setLightboxItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-[60vh] bg-black rounded-xl border border-slate-800 flex items-center justify-center p-3 overflow-hidden">
              {lightboxItem.type === 'recording' ? (
                <video src={lightboxItem.url} controls autoPlay className="max-h-full max-w-full" />
              ) : (
                <img
                  src={lightboxItem.url}
                  alt={lightboxItem.deviceName}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] font-mono-code text-slate-400">
                Captured {new Date(lightboxItem.capturedAt).toLocaleString()} • {(lightboxItem.fileSizeBytes / 1024).toFixed(1)} KB
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setLightboxItem(null)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300"
                >
                  Close
                </button>
                <button
                  onClick={() => handleDownload(lightboxItem)}
                  className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Save {lightboxItem.type === 'recording' ? 'MP4' : 'PNG'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
