/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Main Application Root
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { DesktopTitlebar } from './components/DesktopTitlebar';
import { SplashScreen } from './components/SplashScreen';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { VirtualDeviceManagerView } from './components/VirtualDeviceManagerView';
import { LiveDeviceControlView } from './components/LiveDeviceControlView';
import { MultiDeviceFleetView } from './components/MultiDeviceFleetView';
import { ApplicationManagerView } from './components/ApplicationManagerView';
import { AutomationStudioView } from './components/AutomationStudioView';
import { FileManagerView } from './components/FileManagerView';
import { MediaCenterView } from './components/MediaCenterView';
import { DeviceProfilesView } from './components/DeviceProfilesView';
import { TaskManagerView } from './components/TaskManagerView';
import { LogsAndReportsView } from './components/LogsAndReportsView';
import { SettingsView } from './components/SettingsView';
import { WindowsPackagingView } from './components/WindowsPackagingView';
import { ScreenWallView } from './components/ScreenWallView';
import { GoogleTestingView } from './components/GoogleTestingView';
import { ResourceManagerView } from './components/ResourceManagerView';
import { NodeManagerView } from './components/NodeManagerView';
import { AiLabAssistantView } from './components/AiLabAssistantView';
import {
  VirtualDevice,
  SystemStatusResponse,
  LabTask,
  MediaItem,
  DeviceProfile,
  AutomationWorkflow,
  TestExecutionReport,
  LabSettings,
} from './types';

export default function App() {
  const skipSplash =
    typeof window !== 'undefined' && window.location.search.includes('autostart=1');
  const [showSplash, setShowSplash] = useState(!skipSplash);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [devices, setDevices] = useState<VirtualDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<LabTask[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [reports, setReports] = useState<TestExecutionReport[]>([]);
  const [settings, setSettings] = useState<LabSettings | null>(null);
  const [isScanningAdb, setIsScanningAdb] = useState(false);
  const [bannerFeedback, setBannerFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const showFeedback = (ok: boolean, text: string) => {
    setBannerFeedback({ ok, text });
  };

  // Fetch all initial data
  const loadAll = async () => {
    try {
      const [
        statusRes,
        devRes,
        tasksRes,
        mediaRes,
        profRes,
        wfRes,
        repRes,
        setRes,
      ] = await Promise.all([
        fetch('/api/status').then((r) => r.json()),
        fetch('/api/devices').then((r) => r.json()),
        fetch('/api/tasks').then((r) => r.json()),
        fetch('/api/media').then((r) => r.json()),
        fetch('/api/profiles').then((r) => r.json()),
        fetch('/api/automation/workflows').then((r) => r.json()),
        fetch('/api/reports').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ]);

      setStatus(statusRes);
      setDevices(Array.isArray(devRes) ? devRes : []);
      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
      setMedia(Array.isArray(mediaRes) ? mediaRes : []);
      setProfiles(Array.isArray(profRes) ? profRes : []);
      setWorkflows(Array.isArray(wfRes) ? wfRes : []);
      setReports(Array.isArray(repRes) ? repRes : []);
      setSettings(setRes);

      if (Array.isArray(devRes) && devRes.length > 0) {
        setActiveDeviceId((prev) =>
          prev && devRes.some((d: VirtualDevice) => d.id === prev) ? prev : devRes[0].id
        );
      } else {
        setActiveDeviceId(null);
      }
    } catch (err) {
      console.error('Error fetching lab state:', err);
    }
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 4000);
    return () => clearInterval(interval);
  }, []);

  // Device Lifecycle Actions (Honest error reporting, zero silent fake success)
  const handleStartDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/${id}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showFeedback(false, data.error || data.message || `Failed to boot device (${res.status})`);
      } else {
        showFeedback(true, data.message || 'Device booted and verified via ADB.');
      }
    } catch (err: any) {
      showFeedback(false, `Start error: ${err.message}`);
    } finally {
      loadAll();
    }
  };

  const handleStopDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/${id}/stop`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showFeedback(false, data.error || data.message || 'Failed to stop device.');
      } else {
        showFeedback(true, data.message || 'Device stopped.');
      }
    } catch (err: any) {
      showFeedback(false, `Stop error: ${err.message}`);
    } finally {
      loadAll();
    }
  };

  const handleRestartDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/${id}/restart`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showFeedback(false, data.error || data.message || 'Failed to restart device.');
      } else {
        showFeedback(true, data.message || 'Restart command sent via ADB.');
      }
    } catch (err: any) {
      showFeedback(false, `Restart error: ${err.message}`);
    } finally {
      loadAll();
    }
  };

  const handleDeleteDevice = async (id: string) => {
    await fetch(`/api/devices/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const handleCloneDevice = async (id: string) => {
    const res = await fetch(`/api/devices/${id}/clone`, { method: 'POST' });
    if (res.ok) {
      showFeedback(true, 'Device configuration cloned.');
    }
    loadAll();
  };

  const handleStopAllRunning = async () => {
    const running = devices.filter((d) => d.status === 'running');
    await Promise.all(running.map((d) => fetch(`/api/devices/${d.id}/stop`, { method: 'POST' })));
    loadAll();
  };

  const handleCreateDevice = async (data: Partial<VirtualDevice>) => {
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const newDev = await res.json();
    loadAll();
    if (newDev?.id) {
      setActiveDeviceId(newDev.id);
    }
    if (newDev?.lastError) {
      showFeedback(false, newDev.lastError);
    } else if (res.ok) {
      showFeedback(true, `Registered device profile: ${newDev.name}`);
    }
  };

  const handleUpdateDevice = (updated: VirtualDevice) => {
    setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleTakeScreenshot = async (deviceId: string) => {
    try {
      const res = await fetch('/api/media/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback(false, data.error || 'Failed to capture ADB PNG screenshot.');
        return;
      }
      setMedia((prev) => [data, ...prev]);
      showFeedback(true, `Saved real ADB PNG screenshot (${Math.round(data.fileSizeBytes / 1024)} KB).`);
    } catch (err: any) {
      showFeedback(false, `Screenshot error: ${err.message}`);
    }
  };

  const handleScanAdb = async () => {
    setIsScanningAdb(true);
    try {
      const res = await fetch('/api/adb/scan');
      const data = await res.json();
      await loadAll();
      showFeedback(true, `ADB scan complete: ${data.scannedCount ?? 0} live Android device(s) attached.`);
    } catch (err: any) {
      showFeedback(false, `ADB scan failed: ${err.message}`);
    } finally {
      setIsScanningAdb(false);
    }
  };

  const handleConnectAdb = async (endpoint: string) => {
    const res = await fetch('/api/adb/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    const data = await res.json();
    await loadAll();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || data.stderr || `Failed to connect to ${endpoint}` };
    }
    return { success: true, output: data.output || `Connected to ${endpoint}` };
  };

  const handleInstallApk = async (deviceId: string, file: File, appName?: string) => {
    const formData = new FormData();
    formData.append('apk', file);
    if (appName) formData.append('appName', appName);

    const res = await fetch(`/api/devices/${deviceId}/install`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    loadAll();
    if (!res.ok) {
      throw new Error(data.error || data.message || `APK install failed (${res.status})`);
    }
    return data;
  };

  const handleBatchInstallApk = async (deviceIds: string[], file: File) => {
    const formData = new FormData();
    formData.append('apk', file);
    formData.append('deviceIds', JSON.stringify(deviceIds));

    const res = await fetch('/api/batch/install', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    loadAll();
    if (!res.ok || !data.success) {
      showFeedback(false, `Batch APK install: ${data.installedCount || 0}/${deviceIds.length} succeeded.`);
    } else {
      showFeedback(true, `Batch APK install succeeded on ${data.installedCount} device(s).`);
    }
    return data;
  };

  const handleRunWorkflow = async (workflowId: string, targetDeviceIds: string[]) => {
    const res = await fetch('/api/automation/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId, deviceIds: targetDeviceIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback(
        false,
        data.error || `Workflow run failed on ${targetDeviceIds.length} device(s) — verify live ADB connection.`
      );
    } else {
      showFeedback(true, `Workflow passed on ${data.targetCount || targetDeviceIds.length} device(s).`);
    }
    loadAll();
    return { ok: res.ok, ...data };
  };

  const handleSaveWorkflow = async (wf: AutomationWorkflow) => {
    await fetch('/api/automation/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wf),
    });
    loadAll();
  };

  const handleDeleteWorkflow = async (id: string) => {
    await fetch(`/api/automation/workflows/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const handleAddProfile = async (prof: DeviceProfile) => {
    await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prof),
    });
    loadAll();
  };

  const handleDeleteProfile = async (id: string) => {
    await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const handleCreateDeviceFromProfile = async (profile: DeviceProfile) => {
    await handleCreateDevice({
      name: `${profile.name}`,
      model: profile.model,
      manufacturer: profile.manufacturer,
      androidVersion: profile.androidVersion,
      apiLevel: profile.apiLevel,
      ramMb: profile.ramMb,
      storageMb: profile.storageMb,
      resolution: profile.resolution,
      deviceCategory: profile.hasGooglePlay ? 'emulator_playstore' : 'emulator_aosp',
    });
    setActiveTab('devices');
  };

  const handleCancelTask = async (id: string) => {
    await fetch(`/api/tasks/${id}/cancel`, { method: 'POST' });
    loadAll();
  };

  const handleDeleteMedia = async (id: string) => {
    await fetch(`/api/media/${id}`, { method: 'DELETE' });
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSaveSettings = async (updates: Partial<LabSettings>) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const saved = await res.json();
    setSettings(saved);
  };

  const handleDetectSdk = async (customPath?: string) => {
    const q = customPath ? `?customPath=${encodeURIComponent(customPath)}` : '';
    const res = await fetch(`/api/sdk/detect${q}`);
    const data = await res.json();
    loadAll();
    return data;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080B11] text-slate-100 overflow-hidden font-sans">
      {/* Splash Screen */}
      {showSplash && <SplashScreen status={status} onComplete={() => setShowSplash(false)} />}

      {/* Desktop Native Titlebar */}
      <DesktopTitlebar
        status={status}
        onRefresh={loadAll}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Action Feedback Banner (Real ADB/Emulator Errors & Successes) */}
      {bannerFeedback && (
        <div
          className={`px-4 py-2 text-xs font-mono-code flex items-center justify-between gap-3 border-b ${
            bannerFeedback.ok
              ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-200'
              : 'bg-rose-950/90 border-rose-700/60 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {bannerFeedback.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="truncate">{bannerFeedback.text}</span>
          </div>
          <button
            onClick={() => setBannerFeedback(null)}
            className="text-slate-400 hover:text-white shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main App Frame */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} status={status} />

        {/* Primary View Content Container */}
        <main className="flex-1 bg-[#0c101b] overflow-y-auto relative scanline-bg">
          {activeTab === 'dashboard' && (
            <DashboardView
              devices={devices}
              status={status}
              tasks={tasks}
              onStartDevice={handleStartDevice}
              onStopDevice={handleStopDevice}
              onRestartDevice={handleRestartDevice}
              onOpenLiveControl={(dev) => {
                setActiveDeviceId(dev.id);
                setActiveTab('control');
              }}
              onCreateNewDevice={() => setActiveTab('devices')}
              onOpenWorkflows={() => setActiveTab('automation')}
              onOpenResourceManager={() => setActiveTab('resources')}
              onScanAdb={handleScanAdb}
              onConnectAdb={handleConnectAdb}
            />
          )}

          {activeTab === 'screenwall' && (
            <ScreenWallView
              devices={devices}
              onStartDevice={handleStartDevice}
              onStopDevice={handleStopDevice}
              onSelectDeviceForControl={(dev) => {
                setActiveDeviceId(dev.id);
                setActiveTab('control');
              }}
              onRefresh={loadAll}
            />
          )}

          {activeTab === 'googletesting' && (
            <GoogleTestingView
              devices={devices}
              onRefreshDevices={loadAll}
              onSelectDeviceForControl={(dev) => {
                setActiveDeviceId(dev.id);
                setActiveTab('control');
              }}
            />
          )}

          {activeTab === 'resources' && (
            <ResourceManagerView
              status={status}
              devices={devices}
              onRefresh={loadAll}
              onStopAllRunning={handleStopAllRunning}
            />
          )}

          {activeTab === 'nodes' && (
            <NodeManagerView
              devices={devices}
              onRefresh={loadAll}
            />
          )}

          {activeTab === 'devices' && (
            <VirtualDeviceManagerView
              devices={devices}
              profiles={profiles}
              diagnostics={status?.diagnostics}
              onStartDevice={handleStartDevice}
              onStopDevice={handleStopDevice}
              onRestartDevice={handleRestartDevice}
              onDeleteDevice={handleDeleteDevice}
              onCloneDevice={handleCloneDevice}
              onCreateDevice={handleCreateDevice}
              onOpenLiveControl={(dev) => {
                setActiveDeviceId(dev.id);
                setActiveTab('control');
              }}
              onScanAdb={handleScanAdb}
              onConnectAdb={handleConnectAdb}
              isScanningAdb={isScanningAdb}
            />
          )}

          {activeTab === 'control' && (
            <LiveDeviceControlView
              devices={devices}
              activeDeviceId={activeDeviceId}
              onSelectActiveDevice={setActiveDeviceId}
              onUpdateDevice={handleUpdateDevice}
              onTakeScreenshot={handleTakeScreenshot}
              onStartDevice={handleStartDevice}
            />
          )}

          {activeTab === 'fleet' && (
            <MultiDeviceFleetView
              devices={devices}
              workflows={workflows}
              onStartDevice={handleStartDevice}
              onStopDevice={handleStopDevice}
              onRestartDevice={handleRestartDevice}
              onRunWorkflow={handleRunWorkflow}
              onTakeScreenshot={handleTakeScreenshot}
              onBatchInstallApk={handleBatchInstallApk}
            />
          )}

          {activeTab === 'apps' && (
            <ApplicationManagerView
              devices={devices}
              onInstallApk={handleInstallApk}
            />
          )}

          {activeTab === 'automation' && (
            <AutomationStudioView
              workflows={workflows}
              devices={devices}
              onSaveWorkflow={handleSaveWorkflow}
              onDeleteWorkflow={handleDeleteWorkflow}
              onRunWorkflow={handleRunWorkflow}
              reports={reports}
            />
          )}

          {activeTab === 'files' && <FileManagerView devices={devices} />}

          {activeTab === 'media' && (
            <MediaCenterView
              media={media}
              devices={devices}
              onTakeScreenshot={handleTakeScreenshot}
              onDeleteMedia={handleDeleteMedia}
            />
          )}

          {activeTab === 'profiles' && (
            <DeviceProfilesView
              profiles={profiles}
              onAddProfile={handleAddProfile}
              onDeleteProfile={handleDeleteProfile}
              onCreateDeviceFromProfile={handleCreateDeviceFromProfile}
            />
          )}

          {activeTab === 'tasks' && (
            <TaskManagerView tasks={tasks} onCancelTask={handleCancelTask} />
          )}

          {activeTab === 'logs' && (
            <LogsAndReportsView devices={devices} reports={reports} />
          )}

          {activeTab === 'assistant' && (
            <AiLabAssistantView devices={devices} activeDeviceId={activeDeviceId} />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              status={status}
              onSaveSettings={handleSaveSettings}
              onDetectSdk={handleDetectSdk}
            />
          )}

          {activeTab === 'packaging' && <WindowsPackagingView />}
        </main>
      </div>
    </div>
  );
}
