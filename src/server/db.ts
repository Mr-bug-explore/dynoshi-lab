/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Honest Persistent State Database (Zero Fake Device Seeds)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  VirtualDevice,
  DeviceProfile,
  InstalledApp,
  AutomationWorkflow,
  TestExecutionReport,
  LabTask,
  MediaItem,
  LabSettings,
  LogEntry,
  DeviceNode,
  CapacityStatus,
} from '../types.js';
import { calculateSafeCapacity } from '../logic/avd_engine.js';

export type {
  VirtualDevice,
  DeviceProfile,
  InstalledApp,
  AutomationWorkflow,
  TestExecutionReport,
  LabTask,
  MediaItem,
  LabSettings,
  LogEntry,
  DeviceNode,
  CapacityStatus,
};

export interface LabDatabaseState {
  schemaVersion: number;
  devices: VirtualDevice[];
  profiles: DeviceProfile[];
  installedApps: InstalledApp[];
  workflows: AutomationWorkflow[];
  reports: TestExecutionReport[];
  tasks: LabTask[];
  media: MediaItem[];
  settings: LabSettings;
  logs: LogEntry[];
  nodes: DeviceNode[];
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'dynoshi_lab.json');
const CURRENT_SCHEMA_VERSION = 3;

function getLocalHostNode(): DeviceNode {
  const totalMem = os.totalmem() || 1;
  const freeMem = os.freemem() || 0;
  const ramPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
  const load = os.loadavg()[0] || 0;
  const cpus = os.cpus().length || 1;
  const cpuPct = Math.min(100, Math.round((load / cpus) * 100));

  return {
    id: 'node-local',
    name: `Local Host (${os.hostname()})`,
    type: 'local',
    host: '127.0.0.1',
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    status: 'online',
    activeDevices: 0,
    maxCapacity: calculateSafeCapacity(
      Math.round(totalMem / (1024 * 1024)),
      Math.round(freeMem / (1024 * 1024)),
      cpus,
      0
    ).safeMaxConcurrent,
    cpuUsagePercent: cpuPct,
    ramUsagePercent: ramPct,
    pingMs: 0,
    registeredAt: new Date().toISOString(),
    location: `${os.platform()} (${os.arch()}) Local Workstation`,
  };
}

const INITIAL_PROFILES: DeviceProfile[] = [
  {
    id: 'prof-pixel8pro-play',
    name: 'Google Pixel 8 Pro (Google Play AVD Template)',
    category: 'Phone',
    model: 'Pixel 8 Pro',
    manufacturer: 'Google',
    androidVersion: 'Android 14 (API 34)',
    apiLevel: 34,
    resolution: { width: 1080, height: 2400, densityDpi: 420 },
    ramMb: 4096,
    storageMb: 16384,
    description: 'Official Google Play Store AVD hardware template (`google_apis_playstore`). Requires local Android SDK emulator + KVM/WHPX.',
    skin: 'pixel_8_pro',
    hasGooglePlay: true,
    systemImagePackage: 'system-images;android-34;google_apis_playstore;x86_64',
  },
  {
    id: 'prof-pixel7-aosp',
    name: 'Medium Phone (AOSP / Default AVD Template)',
    category: 'Phone',
    model: 'sdk_gphone64_x86_64',
    manufacturer: 'Google',
    androidVersion: 'Android 14 (API 34)',
    apiLevel: 34,
    resolution: { width: 1080, height: 2400, densityDpi: 420 },
    ramMb: 2048,
    storageMb: 8192,
    description: 'Standard AOSP Android Emulator hardware template (no certified Google Play Store unless `google_apis_playstore` image is selected).',
    skin: 'pixel_7',
    hasGooglePlay: false,
    systemImagePackage: 'system-images;android-34;google_apis;x86_64',
  },
  {
    id: 'prof-tablet-play',
    name: 'Pixel Tablet 11" (Google Play AVD Template)',
    category: 'Tablet',
    model: 'Pixel Tablet',
    manufacturer: 'Google',
    androidVersion: 'Android 14 (API 34)',
    apiLevel: 34,
    resolution: { width: 1600, height: 2560, densityDpi: 280 },
    ramMb: 4096,
    storageMb: 16384,
    description: 'Tablet form-factor AVD hardware template for large-screen testing via Android SDK Emulator.',
    skin: 'pixel_tablet',
    hasGooglePlay: true,
    systemImagePackage: 'system-images;android-34;google_apis_playstore;x86_64',
  },
];

const INITIAL_WORKFLOWS: AutomationWorkflow[] = [
  {
    id: 'wf-real-settings-check',
    name: 'Real Android Settings & Chrome Verification',
    description: 'Wakes device, opens Android Settings, opens Chrome URL, captures real ADB framebuffer screenshot, and returns Home.',
    category: 'Smoke',
    targetDeviceIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      { id: 's1', type: 'press_key', label: 'Press Home Key (KEYCODE_HOME = 3)', params: { keyCode: 3 }, timeoutMs: 3000 },
      { id: 's2', type: 'launch_app', label: 'Launch Android Settings', params: { packageName: 'com.android.settings' }, timeoutMs: 5000 },
      { id: 's3', type: 'wait', label: 'Wait 1500ms for Settings Activity', params: { durationMs: 1500 }, timeoutMs: 3000 },
      { id: 's4', type: 'screenshot', label: 'Capture Real ADB Framebuffer', params: { tag: 'settings_verified' }, timeoutMs: 6000 },
      { id: 's5', type: 'open_url', label: 'Open Example.com in Android Browser', params: { url: 'https://example.com' }, timeoutMs: 5000 },
      { id: 's6', type: 'wait', label: 'Wait 2000ms for Page Load', params: { durationMs: 2000 }, timeoutMs: 4000 },
      { id: 's7', type: 'screenshot', label: 'Capture Browser Framebuffer', params: { tag: 'browser_verified' }, timeoutMs: 6000 },
    ],
  },
  {
    id: 'wf-real-playstore-youtube',
    name: 'Google Play Store & YouTube Package Launch',
    description: 'Launches genuine com.android.vending (Google Play Store) and com.google.android.youtube via ADB and captures framebuffer evidence.',
    category: 'Google Apps',
    targetDeviceIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      { id: 'gp1', type: 'launch_app', label: 'Launch Google Play Store (com.android.vending)', params: { packageName: 'com.android.vending' }, timeoutMs: 6000 },
      { id: 'gp2', type: 'wait', label: 'Wait 2500ms for Play Store Render', params: { durationMs: 2500 }, timeoutMs: 5000 },
      { id: 'gp3', type: 'screenshot', label: 'Capture Play Store Framebuffer', params: { tag: 'playstore_live' }, timeoutMs: 6000 },
      { id: 'yt1', type: 'launch_app', label: 'Launch YouTube (com.google.android.youtube)', params: { packageName: 'com.google.android.youtube' }, timeoutMs: 6000 },
      { id: 'yt2', type: 'wait', label: 'Wait 2500ms for YouTube Render', params: { durationMs: 2500 }, timeoutMs: 5000 },
      { id: 'yt3', type: 'screenshot', label: 'Capture YouTube Framebuffer', params: { tag: 'youtube_live' }, timeoutMs: 6000 },
    ],
  },
];

const INITIAL_SETTINGS: LabSettings = {
  androidSdkPath: process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '',
  adbPath: '',
  emulatorPath: '',
  sdkDetected: false,
  sdkDetectionMessage: 'Probing host system for official Android SDK platform-tools and emulator binaries...',
  labMode: 'real_adb_and_emulator',
  theme: 'cyber_blue',
  logRetentionDays: 14,
  autoRefreshIntervalMs: 3000,
  defaultRamMb: 4096,
  defaultStorageMb: 16384,
  soundEnabled: false,
  hapticSimulation: false,
  maxConcurrentRunningDevices: 4,
  autoManageCapacity: true,
  enableDistributedNodes: true,
};

export class DatabaseService {
  private state: LabDatabaseState;

  constructor() {
    this.ensureDir();
    this.state = this.load();
  }

  private ensureDir() {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const mediaDir = path.resolve(process.cwd(), 'media');
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  }

  private load(): LabDatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        // Migrate / purge all legacy fake/simulated seed data if schemaVersion < CURRENT_SCHEMA_VERSION
        if (!parsed.schemaVersion || parsed.schemaVersion < CURRENT_SCHEMA_VERSION) {
          const fresh: LabDatabaseState = {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            devices: [],
            profiles: INITIAL_PROFILES,
            installedApps: [],
            workflows: INITIAL_WORKFLOWS,
            reports: [],
            tasks: [],
            media: [],
            settings: INITIAL_SETTINGS,
            logs: [],
            nodes: [getLocalHostNode()],
          };
          this.save(fresh);
          return fresh;
        }

        // On startup, local devices cannot be assumed running until live `adb devices -l` verifies them
        const sanitizedDevices: VirtualDevice[] = Array.isArray(parsed.devices)
          ? parsed.devices
              .filter((d: VirtualDevice) => (d.deviceCategory as string) !== 'virtual_sandbox')
              .map((d: VirtualDevice) =>
                d.nodeId === 'node-local' && (d.status === 'running' || d.status === 'booting')
                  ? { ...d, status: 'stopped' as const, cpuUsage: 0, ramUsage: 0, uptimeSeconds: 0 }
                  : d
              )
          : [];

        const nodes: DeviceNode[] = Array.isArray(parsed.nodes)
          ? parsed.nodes.map((n: DeviceNode) => (n.id === 'node-local' ? getLocalHostNode() : n))
          : [getLocalHostNode()];

        return {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          devices: sanitizedDevices,
          profiles: Array.isArray(parsed.profiles) && parsed.profiles.length > 0 ? parsed.profiles : INITIAL_PROFILES,
          installedApps: Array.isArray(parsed.installedApps) ? parsed.installedApps : [],
          workflows: Array.isArray(parsed.workflows) && parsed.workflows.length > 0 ? parsed.workflows : INITIAL_WORKFLOWS,
          reports: Array.isArray(parsed.reports) ? parsed.reports : [],
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          media: Array.isArray(parsed.media) ? parsed.media : [],
          settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}), labMode: 'real_adb_and_emulator' },
          logs: Array.isArray(parsed.logs) ? parsed.logs : [],
          nodes: nodes.length > 0 ? nodes : [getLocalHostNode()],
        };
      }
    } catch (err) {
      console.warn('Could not read existing db, initializing clean real-device state:', err);
    }

    const fresh: LabDatabaseState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      devices: [],
      profiles: INITIAL_PROFILES,
      installedApps: [],
      workflows: INITIAL_WORKFLOWS,
      reports: [],
      tasks: [],
      media: [],
      settings: INITIAL_SETTINGS,
      logs: [],
      nodes: [getLocalHostNode()],
    };
    this.save(fresh);
    return fresh;
  }

  public save(data?: LabDatabaseState) {
    if (data) this.state = data;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // --- Devices ---
  public getDevices(): VirtualDevice[] {
    return this.state.devices;
  }

  public getDevice(id: string): VirtualDevice | undefined {
    return this.state.devices.find((d) => d.id === id);
  }

  public addDevice(device: VirtualDevice): VirtualDevice {
    this.state.devices.push(device);
    this.save();
    return device;
  }

  public updateDevice(id: string, updates: Partial<VirtualDevice>): VirtualDevice | undefined {
    const idx = this.state.devices.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;
    this.state.devices[idx] = { ...this.state.devices[idx], ...updates };
    this.save();
    return this.state.devices[idx];
  }

  public deleteDevice(id: string): boolean {
    const prevLen = this.state.devices.length;
    this.state.devices = this.state.devices.filter((d) => d.id !== id);
    this.state.installedApps = this.state.installedApps.filter((a) => a.deviceId !== id);
    this.save();
    return this.state.devices.length < prevLen;
  }

  // --- Nodes ---
  public getNodes(): DeviceNode[] {
    const local = getLocalHostNode();
    local.activeDevices = this.state.devices.filter(
      (d) => d.nodeId === 'node-local' && d.status === 'running'
    ).length;
    const remotes = (this.state.nodes || []).filter((n) => n.id !== 'node-local').map((n) => ({
      ...n,
      activeDevices: this.state.devices.filter((d) => d.nodeId === n.id && d.status === 'running').length,
    }));
    return [local, ...remotes];
  }

  public addNode(node: DeviceNode): DeviceNode {
    if (!this.state.nodes) this.state.nodes = [getLocalHostNode()];
    this.state.nodes = this.state.nodes.filter((n) => n.id !== node.id);
    this.state.nodes.push(node);
    this.save();
    return node;
  }

  public updateNode(id: string, updates: Partial<DeviceNode>): DeviceNode | undefined {
    if (!this.state.nodes) return undefined;
    const idx = this.state.nodes.findIndex((n) => n.id === id);
    if (idx === -1) return undefined;
    this.state.nodes[idx] = { ...this.state.nodes[idx], ...updates };
    this.save();
    return this.state.nodes[idx];
  }

  public deleteNode(id: string): boolean {
    if (!this.state.nodes || id === 'node-local') return false;
    const prev = this.state.nodes.length;
    this.state.nodes = this.state.nodes.filter((n) => n.id !== id);
    this.save();
    return this.state.nodes.length < prev;
  }

  // --- Capacity Governor ---
  public getCapacityStatus(): CapacityStatus {
    const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
    const cpuCores = os.cpus().length || 4;
    const running = this.state.devices.filter((d) => d.status === 'running' && d.nodeId === 'node-local').length;

    const calc = calculateSafeCapacity(totalMemMb, freeMemMb, cpuCores, running, 2048, 3072);
    const configuredMax = this.state.settings.maxConcurrentRunningDevices || calc.safeMaxConcurrent;

    const load = os.loadavg()[0] || 0;
    const cpuLoadPercent = Math.min(100, Math.round((load / cpuCores) * 100));

    return {
      totalHostRamMb: totalMemMb,
      freeHostRamMb: freeMemMb,
      safeMaxConcurrentDevices: configuredMax,
      currentlyRunningDevices: running,
      availableSlots: Math.max(0, configuredMax - running),
      cpuLoadPercent,
      warningMessage: calc.warningMessage,
      allowEmergencyOverride: false,
    };
  }

  // --- Profiles ---
  public getProfiles(): DeviceProfile[] {
    return this.state.profiles;
  }

  public addProfile(profile: DeviceProfile): DeviceProfile {
    this.state.profiles.push(profile);
    this.save();
    return profile;
  }

  public deleteProfile(id: string): boolean {
    const prev = this.state.profiles.length;
    this.state.profiles = this.state.profiles.filter((p) => p.id !== id);
    this.save();
    return this.state.profiles.length < prev;
  }

  // --- Apps (Only populated from real `pm list packages` or real APK installs) ---
  public getAppsForDevice(deviceId: string): InstalledApp[] {
    return this.state.installedApps.filter((a) => a.deviceId === deviceId);
  }

  public setAppsForDevice(deviceId: string, apps: InstalledApp[]): void {
    this.state.installedApps = [
      ...this.state.installedApps.filter((a) => a.deviceId !== deviceId),
      ...apps,
    ];
    this.save();
  }

  public addApp(app: InstalledApp): InstalledApp {
    this.state.installedApps = this.state.installedApps.filter(
      (a) => !(a.deviceId === app.deviceId && a.packageName === app.packageName)
    );
    this.state.installedApps.push(app);
    this.save();
    return app;
  }

  public removeApp(deviceId: string, packageName: string): boolean {
    const prev = this.state.installedApps.length;
    this.state.installedApps = this.state.installedApps.filter(
      (a) => !(a.deviceId === deviceId && a.packageName === packageName)
    );
    this.save();
    return this.state.installedApps.length < prev;
  }

  // --- Workflows ---
  public getWorkflows(): AutomationWorkflow[] {
    return this.state.workflows;
  }

  public getWorkflow(id: string): AutomationWorkflow | undefined {
    return this.state.workflows.find((w) => w.id === id);
  }

  public saveWorkflow(wf: AutomationWorkflow): AutomationWorkflow {
    const idx = this.state.workflows.findIndex((w) => w.id === wf.id);
    if (idx >= 0) this.state.workflows[idx] = wf;
    else this.state.workflows.push(wf);
    this.save();
    return wf;
  }

  public deleteWorkflow(id: string): boolean {
    const prev = this.state.workflows.length;
    this.state.workflows = this.state.workflows.filter((w) => w.id !== id);
    this.save();
    return this.state.workflows.length < prev;
  }

  // --- Reports ---
  public getReports(): TestExecutionReport[] {
    return this.state.reports;
  }

  public addReport(rep: TestExecutionReport): TestExecutionReport {
    this.state.reports.unshift(rep);
    if (this.state.reports.length > 50) this.state.reports.pop();
    this.save();
    return rep;
  }

  // --- Tasks ---
  public getTasks(): LabTask[] {
    return this.state.tasks;
  }

  public addTask(task: LabTask): LabTask {
    this.state.tasks.unshift(task);
    if (this.state.tasks.length > 30) this.state.tasks.pop();
    this.save();
    return task;
  }

  public updateTask(id: string, updates: Partial<LabTask>): LabTask | undefined {
    const t = this.state.tasks.find((task) => task.id === id);
    if (t) {
      Object.assign(t, updates);
      this.save();
    }
    return t;
  }

  // --- Media ---
  public getMedia(): MediaItem[] {
    return this.state.media;
  }

  public addMedia(m: MediaItem): MediaItem {
    this.state.media.unshift(m);
    this.save();
    return m;
  }

  public deleteMedia(id: string): boolean {
    const target = this.state.media.find((item) => item.id === id);
    if (target && target.filePath && fs.existsSync(target.filePath)) {
      try {
        fs.unlinkSync(target.filePath);
      } catch {}
    }
    const prev = this.state.media.length;
    this.state.media = this.state.media.filter((item) => item.id !== id);
    this.save();
    return this.state.media.length < prev;
  }

  // --- Logs ---
  public getLogs(limit: number = 200, deviceId?: string, minLevel?: string): LogEntry[] {
    let result = this.state.logs;
    if (deviceId) {
      result = result.filter((l) => !l.deviceId || l.deviceId === deviceId);
    }
    if (minLevel) {
      const order = ['V', 'D', 'I', 'W', 'E'];
      const minIdx = order.indexOf(minLevel);
      if (minIdx !== -1) {
        result = result.filter((l) => order.indexOf(l.level) >= minIdx);
      }
    }
    return result.slice(-limit);
  }

  public addLog(entry: Omit<LogEntry, 'id' | 'timestamp'> & { timestamp?: string }): LogEntry {
    const log: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      ...entry,
    };
    this.state.logs.push(log);
    if (this.state.logs.length > 1000) {
      this.state.logs = this.state.logs.slice(-800);
    }
    this.save();
    return log;
  }

  // --- Settings ---
  public getSettings(): LabSettings {
    return this.state.settings;
  }

  public updateSettings(updates: Partial<LabSettings>): LabSettings {
    this.state.settings = { ...this.state.settings, ...updates };
    this.save();
    return this.state.settings;
  }

  public generateSqliteDump(): string {
    const lines: string[] = [
      '-- DYNOSHI ANDROID LAB - SQLITE DUMP (REAL DEVICES ONLY)',
      `-- Generated at ${new Date().toISOString()}`,
      'PRAGMA foreign_keys = ON;',
      '',
      'CREATE TABLE IF NOT EXISTS device_nodes (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, host TEXT NOT NULL, port INTEGER NOT NULL, status TEXT NOT NULL, max_capacity INTEGER NOT NULL);',
      'CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, adb_serial TEXT, avd_name TEXT, model TEXT NOT NULL, manufacturer TEXT NOT NULL, android_version TEXT NOT NULL, api_level INTEGER NOT NULL, status TEXT NOT NULL, node_id TEXT NOT NULL, category TEXT NOT NULL, has_play_store INTEGER NOT NULL);',
      '',
    ];

    for (const n of this.getNodes()) {
      lines.push(
        `INSERT OR REPLACE INTO device_nodes (id, name, type, host, port, status, max_capacity) VALUES ('${n.id}', '${n.name.replace(/'/g, "''")}', '${n.type}', '${n.host}', ${n.port}, '${n.status}', ${n.maxCapacity});`
      );
    }

    for (const d of this.state.devices) {
      lines.push(
        `INSERT OR REPLACE INTO devices (id, name, adb_serial, avd_name, model, manufacturer, android_version, api_level, status, node_id, category, has_play_store) VALUES ('${d.id}', '${d.name.replace(/'/g, "''")}', '${d.adbSerial || ''}', '${d.avdName || ''}', '${d.model}', '${d.manufacturer}', '${d.androidVersion}', ${d.apiLevel}, '${d.status}', '${d.nodeId}', '${d.deviceCategory}', ${d.googlePlay.playStoreInstalled ? 1 : 0});`
      );
    }

    return lines.join('\n');
  }
}

export const db = new DatabaseService();
