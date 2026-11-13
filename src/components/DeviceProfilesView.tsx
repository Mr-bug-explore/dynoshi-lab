/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Device Profiles View
 */

import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Copy,
  Trash2,
  Smartphone,
  Tablet,
  Tv,
  Watch,
  CheckCircle2,
  X,
  Play,
} from 'lucide-react';
import { DeviceProfile, VirtualDevice } from '../types';

interface DeviceProfilesViewProps {
  profiles: DeviceProfile[];
  onAddProfile: (profile: DeviceProfile) => void;
  onDeleteProfile: (id: string) => void;
  onCreateDeviceFromProfile: (profile: DeviceProfile) => void;
}

export const DeviceProfilesView: React.FC<DeviceProfilesViewProps> = ({
  profiles,
  onAddProfile,
  onDeleteProfile,
  onCreateDeviceFromProfile,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DeviceProfile['category']>('Phone');
  const [model, setModel] = useState('Pixel 8 Pro');
  const [androidVer, setAndroidVer] = useState('Android 14 (UpsideDownCake)');
  const [apiLevel, setApiLevel] = useState(34);
  const [ramMb, setRamMb] = useState(8192);
  const [storageMb, setStorageMb] = useState(128000);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(2400);
  const [dpi, setDpi] = useState(420);
  const [desc, setDesc] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newProf: DeviceProfile = {
      id: `prof-${Date.now().toString(36)}`,
      name: name || `${model} Preset`,
      category,
      model,
      manufacturer: 'Custom',
      androidVersion: androidVer,
      apiLevel: Number(apiLevel),
      ramMb: Number(ramMb),
      storageMb: Number(storageMb),
      resolution: { width: Number(width), height: Number(height), densityDpi: Number(dpi) },
      description: desc || 'Custom user profile configuration',
      skin: 'generic',
      hasGooglePlay: true,
    };
    onAddProfile(newProf);
    setIsModalOpen(false);
    setName('');
    setDesc('');
  };

  const handleDuplicate = (p: DeviceProfile) => {
    const dupe: DeviceProfile = {
      ...p,
      id: `prof-${Date.now().toString(36)}`,
      name: `${p.name} (Copy)`,
    };
    onAddProfile(dupe);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              DEVICE PROFILES & HARDWARE TEMPLATES
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-800/60">
              OEM SPEC PRESETS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Hardware specification templates for configuring Android Emulator targets. Certified Google Play requires an official Google Play system image or physical device.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold font-tech tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-600/25 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Profile Preset</span>
        </button>
      </div>

      {/* Profile Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {p.category === 'Tablet' ? (
                      <Tablet className="w-4 h-4 text-violet-400" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                    )}
                    <h3 className="font-tech font-bold text-base text-slate-100 truncate">{p.name}</h3>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-code mt-0.5">
                    {p.model} • {p.androidVersion}
                  </div>
                </div>

                <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                  {p.category}
                </span>
              </div>

              <p className="text-xs text-slate-400 mt-3 leading-relaxed">{p.description}</p>

              {/* Hardware Spec Box */}
              <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono-code text-[11px] space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span className="text-slate-500">Resolution:</span>
                  <span className="text-slate-200">
                    {p.resolution.width}x{p.resolution.height} ({p.resolution.densityDpi} DPI)
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="text-slate-500">RAM Allocation:</span>
                  <span className="text-cyan-400 font-semibold">{Math.round(p.ramMb / 1024)} GB</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="text-slate-500">Storage:</span>
                  <span className="text-slate-200">{Math.round(p.storageMb / 1024)} GB</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="text-slate-500">API Level:</span>
                  <span className="text-slate-200">API {p.apiLevel}</span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => onCreateDeviceFromProfile(p)}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-tech font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Register Profile Entry</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDuplicate(p)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400"
                  title="Duplicate Profile"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteProfile(p.id)}
                  className="p-1.5 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                  title="Delete Profile"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: New Profile */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800 rounded-2xl max-w-md w-full p-6 text-xs text-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="font-tech text-base font-bold text-white">Create Custom Device Profile</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 font-mono-code">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Profile Name:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Pixel 8 Ultra Testbed"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Category:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
                  >
                    <option value="Phone">Phone</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Foldable">Foldable</option>
                    <option value="Low-RAM">Low-RAM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">RAM (MB):</label>
                  <input
                    type="number"
                    value={ramMb}
                    onChange={(e) => setRamMb(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Description:</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Profile description and testing objectives..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-tech font-bold"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
