/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Real Android Device & Emulator Management Types
 */

export interface DeviceNode {
  id: string;
  name: string;
  type: 'local' | 'remote_agent' | 'cloud_provider';
  host: string;
  port: number;
  status: 'online' | 'offline' | 'degraded';
  activeDevices: number;
  maxCapacity: number;
  cpuUsagePercent: number;
  ramUsagePercent: number;
  pingMs: number;
  authToken?: string;
  registeredAt: string;
  location?: string;
  lastError?: string;
  adbAvailable?: boolean;
  emulatorAvailable?: boolean;
}

export interface GooglePlayStatus {
  supported: boolean;
  playServicesVersion?: string;
  playStoreInstalled: boolean;
  youtubeInstalled: boolean;
  chromeInstalled: boolean;
  accountSignedIn?: boolean;
  accountEmail?: string;
  certified?: boolean;
  systemImageTag?: string;
  protectStatus: 'verified' | 'unverified' | 'unavailable';
}

export interface DeviceSessionState {
  activeAppPackage?: string;
  activeAppTitle?: string;
  backgroundTasksCount: number;
  lastInteractedAt: string;
  keepAliveInBackground: boolean;
  processPid?: number;
}

export type DeviceCategoryType =
  | 'physical'
  | 'emulator_playstore'
  | 'emulator_aosp'
  | 'remote_agent'
  | 'cloud_device';

export interface DeviceVerificationCheck {
  id: string;
  label: string;
  command: string;
  exitCode: number;
  passed: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface DeviceVerificationReport {
  deviceId: string;
  adbSerial: string;
  verifiedAt: string;
  overallPassed: boolean;
  androidRelease?: string;
  apiLevel?: number;
  deviceModel?: string;
  manufacturer?: string;
  bootCompleted: boolean;
  isEmulator: boolean;
  hasPlayStore: boolean;
  hasYouTube: boolean;
  hasChrome: boolean;
  networkConnected: boolean;
  checks: DeviceVerificationCheck[];
}

export interface AdbCommandProbeResult {
  command: string;
  exitCode: number;
  passed: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface LiveDeviceDiagnosticsResult {
  deviceId: string | null;
  adbSerial: string | null;
  adbAvailable: boolean;
  adbPath: string;
  checkedAt: string;
  adbDevices: AdbCommandProbeResult & {
    attachedCount: number;
    devices: Array<{
      id: string;
      state: string;
      model?: string;
      product?: string;
      device?: string;
      transportId?: string;
    }>;
  };
  getprop: AdbCommandProbeResult & {
    properties: Record<string, string>;
    propertyCount: number;
    highlights: {
      model?: string;
      manufacturer?: string;
      brand?: string;
      androidRelease?: string;
      apiLevel?: string;
      abi?: string;
      fingerprint?: string;
      bootCompleted?: string;
      isEmulator?: boolean;
    };
  };
  packages: {
    playStore: AdbCommandProbeResult & {
      packageName: 'com.android.vending';
      installed: boolean;
      apkPaths: string[];
    };
    youtube: AdbCommandProbeResult & {
      packageName: 'com.google.android.youtube';
      installed: boolean;
      apkPaths: string[];
    };
  };
}

export interface VirtualDevice {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  androidVersion: string;
  apiLevel: number;
  abi: string;
  resolution: { width: number; height: number; densityDpi: number };
  ramMb: number;
  storageMb: number;
  storageUsedMb: number;
  status: 'running' | 'stopped' | 'booting' | 'error' | 'offline' | 'unauthorized';
  orientation: 'portrait' | 'landscape';
  batteryLevel: number;
  isCharging: boolean;
  networkType: 'WiFi' | '5G' | 'LTE' | 'Offline' | 'Unknown';
  wifiSsid: string;
  ipAddress: string;
  isRealAdbDevice: boolean;
  adbSerial?: string;
  avdName?: string;
  emulatorPort?: number;
  emulatorPid?: number;
  connectionType?: 'usb' | 'tcpip' | 'emulator' | 'remote_node';
  activeAppPackage?: string;
  activeAppTitle?: string;
  cpuUsage: number;
  ramUsage: number;
  temperatureC: number;
  screenUnlocked: boolean;
  volumeLevel: number;
  uptimeSeconds: number;
  createdAt: string;
  lastBootedAt?: string;
  lastError?: string;

  // Enterprise Multi-Device Fields
  nodeId: string;
  deviceCategory: DeviceCategoryType;
  googlePlay: GooglePlayStatus;
  sessionState: DeviceSessionState;
  verificationReport?: DeviceVerificationReport;
  tags?: string[];
}

export interface EmulatorAvdInfo {
  name: string;
  device?: string;
  path?: string;
  target?: string;
  basedOn?: string;
  tagAbi?: string;
  hasGooglePlay: boolean;
  apiLevel?: number;
  runningPort?: number;
}

export interface HostEnvironmentDiagnostics {
  platform: string;
  arch: string;
  adbInstalled: boolean;
  adbPath: string;
  adbVersion: string;
  emulatorInstalled: boolean;
  emulatorPath: string;
  emulatorVersion: string;
  avdmanagerInstalled: boolean;
  avdmanagerPath: string;
  sdkmanagerInstalled: boolean;
  sdkmanagerPath: string;
  scrcpyInstalled: boolean;
  scrcpyPath: string;
  appiumInstalled: boolean;
  appiumPath: string;
  appiumVersion: string;
  sdkPath: string;
  kvmAvailable: boolean;
  kvmMessage: string;
  availableAvds: EmulatorAvdInfo[];
  blockers: string[];
  checkedAt: string;
}

export interface DeviceProfile {
  id: string;
  name: string;
  category: 'Phone' | 'Tablet' | 'Foldable' | 'Automotive' | 'Wear' | 'Low-RAM';
  model: string;
  manufacturer: string;
  androidVersion: string;
  apiLevel: number;
  resolution: { width: number; height: number; densityDpi: number };
  ramMb: number;
  storageMb: number;
  description: string;
  skin: string;
  hasGooglePlay: boolean;
  systemImagePackage?: string;
}

export interface InstalledApp {
  id: string;
  deviceId: string;
  packageName: string;
  appName: string;
  versionName: string;
  versionCode: number;
  sizeMb: number;
  isSystem: boolean;
  iconType: string;
  installDate: string;
  permissions: string[];
  apkPath?: string;
  googlePlayInstalled?: boolean;
}

export interface AutomationStep {
  id: string;
  type:
    | 'launch_app'
    | 'tap_coords'
    | 'enter_text'
    | 'swipe'
    | 'wait'
    | 'press_key'
    | 'screenshot'
    | 'assert_text'
    | 'shell_cmd'
    | 'open_url'
    | 'close_app';
  label: string;
  params: Record<string, any>;
  timeoutMs?: number;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  category: 'Smoke' | 'Performance' | 'UI Regression' | 'Forms' | 'Custom' | 'Google Apps';
  steps: AutomationStep[];
  targetDeviceIds: string[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: 'passed' | 'failed' | 'aborted' | 'running';
}

export interface TestExecutionReport {
  id: string;
  workflowId: string;
  workflowName: string;
  deviceId: string;
  deviceName: string;
  status: 'passed' | 'failed' | 'running' | 'cancelled';
  startTime: string;
  endTime?: string;
  durationMs: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  stepLogs: Array<{
    stepId: string;
    stepLabel: string;
    status: 'passed' | 'failed' | 'running';
    durationMs: number;
    log: string;
    screenshotUrl?: string;
  }>;
  errorMessage?: string;
}

export interface LabTask {
  id: string;
  title: string;
  type:
    | 'boot'
    | 'stop'
    | 'install_apk'
    | 'uninstall'
    | 'file_push'
    | 'file_pull'
    | 'automation'
    | 'batch_action'
    | 'verification'
    | 'node_sync';
  targetDeviceIds: string[];
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface MediaItem {
  id: string;
  deviceId: string;
  deviceName: string;
  type: 'screenshot' | 'recording';
  filePath: string;
  url: string;
  capturedAt: string;
  resolution: string;
  fileSizeBytes: number;
}

export interface DeviceFileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  permissions: string;
  owner: string;
  group: string;
  modifiedAt: string;
}

export interface CapacityStatus {
  totalHostRamMb: number;
  freeHostRamMb: number;
  safeMaxConcurrentDevices: number;
  currentlyRunningDevices: number;
  availableSlots: number;
  cpuLoadPercent: number;
  warningMessage?: string;
  allowEmergencyOverride: boolean;
}

export interface LabSettings {
  androidSdkPath: string;
  adbPath: string;
  emulatorPath: string;
  sdkDetected: boolean;
  sdkDetectionMessage: string;
  labMode: 'real_adb_and_emulator' | 'strict_physical_only';
  theme: 'cyber_blue' | 'neon_violet' | 'matrix_emerald' | 'solar_amber';
  logRetentionDays: number;
  autoRefreshIntervalMs: number;
  defaultRamMb: number;
  defaultStorageMb: number;
  soundEnabled: boolean;
  hapticSimulation: boolean;
  maxConcurrentRunningDevices: number;
  autoManageCapacity: boolean;
  enableDistributedNodes: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  deviceId?: string;
  level: 'V' | 'D' | 'I' | 'W' | 'E';
  tag: string;
  message: string;
  pid?: number;
}

export interface SystemStatusResponse {
  appName: string;
  version: string;
  platform: string;
  arch: string;
  totalDevices: number;
  runningDevices: number;
  stoppedDevices: number;
  errorDevices: number;
  activeTasks: number;
  hostMetrics: {
    totalMemMb: number;
    usedMemMb: number;
    freeMemMb: number;
    ramUsagePercent: number;
    deviceAvgCpu: number;
    deviceAvgRam: number;
  };
  capacity: CapacityStatus;
  nodesCount: number;
  adb: {
    isAdbAvailable: boolean;
    adbPath: string;
    sdkPath: string;
    adbVersion: string;
  };
  diagnostics: HostEnvironmentDiagnostics;
  settings: LabSettings;
}
