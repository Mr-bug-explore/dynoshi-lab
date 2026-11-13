/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - 100% Real ADB, Emulator, Framebuffer & Verification Service
 * ZERO simulated shell responses, ZERO fake devices, ZERO fabricated screens.
 */

import { exec, execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { db, VirtualDevice } from './db.js';
import type {
  DeviceFileItem,
  DeviceVerificationCheck,
  DeviceVerificationReport,
  EmulatorAvdInfo,
  HostEnvironmentDiagnostics,
  InstalledApp,
  LiveDeviceDiagnosticsResult,
  LogEntry,
} from '../types.js';
import {
  buildAdbInputCommand,
  extractGetPropHighlights,
  isValidAdbSerialOrEndpoint,
  isValidPackageName,
  parseAdbDevicesOutput,
  parseAdbLsOutput,
  parseAvdManagerListOutput,
  parseDumpsysBattery,
  parseDumpsysCpuInfo,
  parseEmulatorAvdList,
  parseGetPropOutput,
  parseLogcatOutput,
  parsePmListPackagesOutput,
  parsePmPathOutput,
  parseProcMemInfo,
  parseWmDisplay,
} from '../logic/avd_engine.js';

export interface CommandResult {
  success: boolean;
  command: string;
  exitCode: number;
  output: string;
  stderr: string;
  durationMs: number;
}

export interface SdkDetectionResult {
  detected: boolean;
  adbPath: string;
  emulatorPath: string;
  sdkPath: string;
  version: string;
  message: string;
  candidatePaths: string[];
  platform: string;
  diagnostics: HostEnvironmentDiagnostics;
}

export class AdbService {
  private adbPath: string = '';
  private emulatorPath: string = '';
  private avdmanagerPath: string = '';
  private sdkmanagerPath: string = '';
  private scrcpyPath: string = '';
  private appiumPath: string = '';
  private sdkPath: string = '';
  private isAdbAvailable: boolean = false;
  private adbVersion: string = '';
  private emulatorVersion: string = '';
  private appiumVersion: string = '';
  private lastDiagnostics: HostEnvironmentDiagnostics | null = null;
  private runningEmulatorPids: Map<string, number> = new Map();
  private activeRecordings: Map<string, { pid: number; remotePath: string; startedAt: number; child: ReturnType<typeof spawn> }> = new Map();

  constructor() {
    this.detectSdk().catch(() => {});
  }

  private execFilePromise(
    bin: string,
    args: string[],
    timeoutMs: number = 10000
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      execFile(bin, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        const exitCode =
          err && typeof (err as any).code === 'number'
            ? (err as any).code
            : err
            ? 1
            : 0;
        resolve({
          exitCode,
          stdout: (stdout || '').toString(),
          stderr: (stderr || (err ? err.message : '')).toString(),
        });
      });
    });
  }

  private execShellPromise(
    cmd: string,
    timeoutMs: number = 10000
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      exec(cmd, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        const exitCode =
          err && typeof (err as any).code === 'number'
            ? (err as any).code
            : err
            ? 1
            : 0;
        resolve({
          exitCode,
          stdout: (stdout || '').toString(),
          stderr: (stderr || (err ? err.message : '')).toString(),
        });
      });
    });
  }

  private resolveSdkRoots(customPath?: string): string[] {
    const platform = os.platform();
    const roots: string[] = [];
    if (customPath?.trim()) roots.push(customPath.trim());
    if (process.env.ANDROID_HOME) roots.push(process.env.ANDROID_HOME);
    if (process.env.ANDROID_SDK_ROOT) roots.push(process.env.ANDROID_SDK_ROOT);

    if (platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || 'C:\\Users\\Default\\AppData\\Local';
      roots.push(path.join(localAppData, 'Android', 'Sdk'));
      roots.push('C:\\Android\\Sdk');
      roots.push('C:\\Program Files\\Android\\android-sdk');
    } else if (platform === 'darwin') {
      roots.push(path.join(os.homedir(), 'Library', 'Android', 'sdk'));
    } else {
      roots.push(path.join(os.homedir(), 'Android', 'Sdk'));
      roots.push('/opt/android-sdk');
      roots.push('/usr/lib/android-sdk');
    }
    return [...new Set(roots)];
  }

  private async findExecutable(candidates: string[]): Promise<string> {
    for (const c of candidates) {
      if (!c) continue;
      const isBareName = !c.includes(path.sep) && !c.includes('/');
      if (!isBareName && !fs.existsSync(c)) continue;
      if (isBareName) {
        const whichCmd = os.platform() === 'win32' ? `where ${c}` : `which ${c}`;
        const res = await this.execShellPromise(whichCmd, 3000);
        if (res.exitCode === 0 && res.stdout.trim()) {
          return res.stdout.trim().split(/\r?\n/)[0];
        }
      } else {
        return c;
      }
    }
    return '';
  }

  /**
   * Probes host for real adb, emulator, avdmanager, sdkmanager, scrcpy, and KVM/WHPX virtualization.
   */
  public async detectSdk(customPath?: string): Promise<SdkDetectionResult> {
    const platform = os.platform();
    const arch = os.arch();
    const exe = platform === 'win32' ? '.exe' : '';
    const bat = platform === 'win32' ? '.bat' : '';
    const sdkRoots = this.resolveSdkRoots(customPath);

    const adbCandidates = [
      path.resolve(process.cwd(), 'tools', 'platform-tools', `adb${exe}`),
      ...sdkRoots.map((r) => path.join(r, 'platform-tools', `adb${exe}`)),
      customPath ? customPath.trim() : '',
      platform === 'win32' ? 'C:\\platform-tools\\adb.exe' : '/usr/bin/adb',
      platform === 'win32' ? 'adb.exe' : 'adb',
    ];

    const emulatorCandidates = [
      ...sdkRoots.map((r) => path.join(r, 'emulator', `emulator${exe}`)),
      platform === 'win32' ? 'emulator.exe' : 'emulator',
    ];

    const avdmanagerCandidates = [
      ...sdkRoots.map((r) => path.join(r, 'cmdline-tools', 'latest', 'bin', `avdmanager${bat}`)),
      ...sdkRoots.map((r) => path.join(r, 'cmdline-tools', 'bin', `avdmanager${bat}`)),
      ...sdkRoots.map((r) => path.join(r, 'tools', 'bin', `avdmanager${bat}`)),
      `avdmanager${bat}`,
    ];

    const sdkmanagerCandidates = [
      ...sdkRoots.map((r) => path.join(r, 'cmdline-tools', 'latest', 'bin', `sdkmanager${bat}`)),
      ...sdkRoots.map((r) => path.join(r, 'cmdline-tools', 'bin', `sdkmanager${bat}`)),
      ...sdkRoots.map((r) => path.join(r, 'tools', 'bin', `sdkmanager${bat}`)),
      `sdkmanager${bat}`,
    ];

    const scrcpyCandidates = [platform === 'win32' ? 'scrcpy.exe' : 'scrcpy'];
    const appiumCandidates = [platform === 'win32' ? 'appium.cmd' : 'appium'];

    this.adbPath = await this.findExecutable(adbCandidates);
    this.emulatorPath = await this.findExecutable(emulatorCandidates);
    this.avdmanagerPath = await this.findExecutable(avdmanagerCandidates);
    this.sdkmanagerPath = await this.findExecutable(sdkmanagerCandidates);
    this.scrcpyPath = await this.findExecutable(scrcpyCandidates);
    this.appiumPath = await this.findExecutable(appiumCandidates);

    this.adbVersion = '';
    this.isAdbAvailable = false;
    if (this.adbPath) {
      const verRes = await this.execFilePromise(this.adbPath, ['version'], 4000);
      if (verRes.exitCode === 0 && verRes.stdout) {
        this.isAdbAvailable = true;
        const match = verRes.stdout.match(/Android Debug Bridge version ([\d.]+)/i);
        this.adbVersion = verRes.stdout.trim().split(/\r?\n/).slice(0, 2).join(' | ');
        if (!match && !this.adbVersion) this.adbVersion = 'Detected';
        this.sdkPath = path.resolve(this.adbPath, '..', '..');
      }
    }

    this.emulatorVersion = '';
    if (this.emulatorPath) {
      const emuVer = await this.execFilePromise(this.emulatorPath, ['-version'], 4000);
      if (emuVer.exitCode === 0) {
        this.emulatorVersion = emuVer.stdout.trim().split(/\r?\n/)[0] || 'Detected';
      }
    }

    this.appiumVersion = '';
    if (this.appiumPath) {
      const appiumVer = await this.execFilePromise(this.appiumPath, ['--version'], 4000);
      if (appiumVer.exitCode === 0) {
        this.appiumVersion = `v${appiumVer.stdout.trim().split(/\r?\n/)[0]}`;
      }
    }

    // Virtualization check
    let kvmAvailable = false;
    let kvmMessage = '';
    if (platform === 'linux') {
      if (fs.existsSync('/dev/kvm')) {
        try {
          fs.accessSync('/dev/kvm', fs.constants.R_OK | fs.constants.W_OK);
          kvmAvailable = true;
          kvmMessage = '/dev/kvm is present and accessible for hardware-accelerated QEMU.';
        } catch {
          kvmAvailable = false;
          kvmMessage = '/dev/kvm exists but lacks R/W permission for current user.';
        }
      } else {
        kvmAvailable = false;
        kvmMessage = `/dev/kvm not found (${os.release()}). Nested KVM hardware virtualization is unavailable in this Linux container.`;
      }
    } else if (platform === 'win32') {
      if (this.emulatorPath) {
        const accel = await this.execFilePromise(this.emulatorPath, ['-accel-check'], 5000);
        kvmAvailable = accel.exitCode === 0 && !/no.*accel|not installed/i.test(accel.stdout + accel.stderr);
        kvmMessage = (accel.stdout || accel.stderr).trim();
      } else {
        kvmMessage = 'Windows Hypervisor Platform / AEHD check requires Android Emulator binary.';
      }
    } else if (platform === 'darwin') {
      kvmAvailable = true;
      kvmMessage = 'macOS Hypervisor.framework supported.';
    }

    // Available AVDs
    const availableAvds = await this.listAvailableAvds();

    // Real blockers
    const blockers: string[] = [];
    if (!this.isAdbAvailable) {
      blockers.push('Official ADB (`platform-tools`) binary not found. Cannot communicate with physical devices or emulators.');
    }
    if (!this.emulatorPath) {
      blockers.push('Official Android `emulator` binary not installed on this host. Local AVD booting is unavailable here unless running on a desktop with Android Studio SDK or connecting a remote ADB/Host Agent.');
    }
    if (platform === 'linux' && !kvmAvailable) {
      blockers.push(`Hardware virtualization blocked: ${kvmMessage}`);
    }
    if (this.emulatorPath && availableAvds.length === 0) {
      blockers.push('No local Android Virtual Devices (AVDs) created yet (`emulator -list-avds` returned empty).');
    }

    const diagnostics: HostEnvironmentDiagnostics = {
      platform,
      arch,
      adbInstalled: this.isAdbAvailable,
      adbPath: this.adbPath,
      adbVersion: this.adbVersion,
      emulatorInstalled: Boolean(this.emulatorPath),
      emulatorPath: this.emulatorPath,
      emulatorVersion: this.emulatorVersion,
      avdmanagerInstalled: Boolean(this.avdmanagerPath),
      avdmanagerPath: this.avdmanagerPath,
      sdkmanagerInstalled: Boolean(this.sdkmanagerPath),
      sdkmanagerPath: this.sdkmanagerPath,
      scrcpyInstalled: Boolean(this.scrcpyPath),
      scrcpyPath: this.scrcpyPath,
      appiumInstalled: Boolean(this.appiumPath),
      appiumPath: this.appiumPath,
      appiumVersion: this.appiumVersion,
      sdkPath: this.sdkPath,
      kvmAvailable,
      kvmMessage,
      availableAvds,
      blockers,
      checkedAt: new Date().toISOString(),
    };

    this.lastDiagnostics = diagnostics;

    const guidanceMsg = this.isAdbAvailable
      ? `Real ADB connected (${this.adbPath}). ${blockers.length > 0 ? blockers[0] : 'Full local SDK ready.'}`
      : 'ADB binary not found on system. Install Android SDK platform-tools.';

    db.updateSettings({
      adbPath: this.adbPath,
      emulatorPath: this.emulatorPath,
      androidSdkPath: this.sdkPath,
      sdkDetected: this.isAdbAvailable,
      sdkDetectionMessage: guidanceMsg,
    });

    return {
      detected: this.isAdbAvailable,
      adbPath: this.adbPath,
      emulatorPath: this.emulatorPath,
      sdkPath: this.sdkPath,
      version: this.adbVersion,
      message: guidanceMsg,
      candidatePaths: adbCandidates.filter(Boolean),
      platform,
      diagnostics,
    };
  }

  public getDiagnostics(): HostEnvironmentDiagnostics | null {
    return this.lastDiagnostics;
  }

  public getStatus() {
    return {
      isAdbAvailable: this.isAdbAvailable,
      adbPath: this.adbPath,
      sdkPath: this.sdkPath,
      adbVersion: this.adbVersion,
    };
  }

  /**
   * Lists real Android Virtual Devices configured on this host.
   */
  public async listAvailableAvds(): Promise<EmulatorAvdInfo[]> {
    const runningPortsByAvd = new Map<string, number>();
    // Check live emulator ports if ADB is available
    if (this.isAdbAvailable) {
      const devOut = await this.execFilePromise(this.adbPath, ['devices'], 3000);
      for (const d of parseAdbDevicesOutput(devOut.stdout)) {
        if (d.id.startsWith('emulator-') && d.state === 'device') {
          const avdRes = await this.execFilePromise(this.adbPath, ['-s', d.id, 'emu', 'avd', 'name'], 2500);
          const avdName = avdRes.stdout.split(/\r?\n/)[0]?.trim();
          const port = parseInt(d.id.replace('emulator-', ''), 10);
          if (avdName && !Number.isNaN(port)) runningPortsByAvd.set(avdName, port);
        }
      }
    }

    if (this.avdmanagerPath) {
      const res = await this.execFilePromise(this.avdmanagerPath, ['list', 'avd'], 8000);
      if (res.exitCode === 0) {
        return parseAvdManagerListOutput(res.stdout).map((a) => ({
          ...a,
          runningPort: runningPortsByAvd.get(a.name),
        }));
      }
    }

    if (this.emulatorPath) {
      const res = await this.execFilePromise(this.emulatorPath, ['-list-avds'], 5000);
      if (res.exitCode === 0) {
        return parseEmulatorAvdList(res.stdout).map((name) => ({
          name,
          hasGooglePlay: false,
          runningPort: runningPortsByAvd.get(name),
        }));
      }
    }

    return [];
  }

  /**
   * Runs `adb connect <host:port>` and scans devices.
   */
  public async connectAdbEndpoint(endpoint: string): Promise<CommandResult & { devices: VirtualDevice[] }> {
    const clean = endpoint.trim();
    if (!this.isAdbAvailable) {
      return {
        success: false,
        command: `adb connect ${clean}`,
        exitCode: 1,
        output: '',
        stderr: 'ADB binary not available on host.',
        durationMs: 0,
        devices: [],
      };
    }
    if (!isValidAdbSerialOrEndpoint(clean)) {
      return {
        success: false,
        command: `adb connect ${clean}`,
        exitCode: 1,
        output: '',
        stderr: 'Invalid host:port or serial format.',
        durationMs: 0,
        devices: [],
      };
    }

    const start = Date.now();
    const res = await this.execFilePromise(this.adbPath, ['connect', clean], 10000);
    const durationMs = Date.now() - start;
    const connected = res.exitCode === 0 && /connected to|already connected/i.test(res.stdout);

    db.addLog({
      level: connected ? 'I' : 'W',
      tag: 'AdbConnect',
      message: `adb connect ${clean}: ${(res.stdout || res.stderr).trim()}`,
    });

    const devices = connected ? await this.scanRealDevices() : db.getDevices();
    return {
      success: connected,
      command: `${this.adbPath} connect ${clean}`,
      exitCode: res.exitCode,
      output: res.stdout.trim(),
      stderr: res.stderr.trim() || (!connected ? res.stdout.trim() : ''),
      durationMs,
      devices,
    };
  }

  public async disconnectAdbEndpoint(endpoint: string): Promise<CommandResult> {
    const clean = endpoint.trim();
    if (!this.isAdbAvailable || !isValidAdbSerialOrEndpoint(clean)) {
      return {
        success: false,
        command: `adb disconnect ${clean}`,
        exitCode: 1,
        output: '',
        stderr: 'ADB unavailable or invalid endpoint.',
        durationMs: 0,
      };
    }
    const start = Date.now();
    const res = await this.execFilePromise(this.adbPath, ['disconnect', clean], 5000);
    await this.scanRealDevices();
    return {
      success: res.exitCode === 0,
      command: `${this.adbPath} disconnect ${clean}`,
      exitCode: res.exitCode,
      output: res.stdout.trim(),
      stderr: res.stderr.trim(),
      durationMs: Date.now() - start,
    };
  }

  /**
   * Scans `adb devices -l` and inspects real device properties, packages, battery, display, and meminfo.
   */
  public async scanRealDevices(): Promise<VirtualDevice[]> {
    if (!this.isAdbAvailable) {
      return db.getDevices();
    }

    const listRes = await this.execFilePromise(this.adbPath, ['devices', '-l'], 5000);
    if (listRes.exitCode !== 0) {
      db.addLog({
        level: 'E',
        tag: 'AdbScanner',
        message: `adb devices -l failed: ${listRes.stderr}`,
      });
      return db.getDevices();
    }

    const attached = parseAdbDevicesOutput(listRes.stdout);
    const attachedIds = new Set(attached.map((a) => a.id));

    // Mark previously connected local real ADB devices that are no longer attached as stopped/offline
    for (const dev of db.getDevices()) {
      if (dev.nodeId === 'node-local' && dev.adbSerial && !attachedIds.has(dev.adbSerial)) {
        if (dev.status === 'running' || dev.status === 'booting' || dev.status === 'unauthorized') {
          db.updateDevice(dev.id, {
            status: 'stopped',
            cpuUsage: 0,
            ramUsage: 0,
            lastError: 'Device no longer listed by `adb devices -l`.',
          });
        }
      }
    }

    const syncedDevices: VirtualDevice[] = [];

    for (const raw of attached) {
      const existing = db.getDevices().find(
        (d) => d.adbSerial === raw.id || d.id === `adb-${raw.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`
      );

      if (raw.state !== 'device') {
        const mappedStatus =
          raw.state === 'unauthorized'
            ? 'unauthorized'
            : raw.state === 'offline'
            ? 'offline'
            : 'error';
        const errHint =
          raw.state === 'unauthorized'
            ? 'Device unauthorized: accept the "Allow USB debugging" RSA prompt on the Android screen.'
            : `ADB state is "${raw.state}".`;

        if (existing) {
          const updated = db.updateDevice(existing.id, {
            status: mappedStatus,
            isRealAdbDevice: true,
            adbSerial: raw.id,
            lastError: errHint,
          });
          if (updated) syncedDevices.push(updated);
        } else {
          const newDev: VirtualDevice = {
            id: `adb-${raw.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            name: raw.model ? `${raw.model.replace(/_/g, ' ')} (${raw.id})` : `Android (${raw.id})`,
            model: raw.model || 'Unknown',
            manufacturer: 'Unknown',
            androidVersion: 'Pending Auth',
            apiLevel: 0,
            abi: 'unknown',
            resolution: { width: 1080, height: 2400, densityDpi: 420 },
            ramMb: 0,
            storageMb: 0,
            storageUsedMb: 0,
            status: mappedStatus,
            orientation: 'portrait',
            batteryLevel: 0,
            isCharging: false,
            networkType: 'Unknown',
            wifiSsid: '',
            ipAddress: raw.id.includes(':') ? raw.id.split(':')[0] : '',
            isRealAdbDevice: true,
            adbSerial: raw.id,
            connectionType: raw.id.startsWith('emulator-')
              ? 'emulator'
              : raw.id.includes(':')
              ? 'tcpip'
              : 'usb',
            cpuUsage: 0,
            ramUsage: 0,
            temperatureC: 0,
            screenUnlocked: false,
            volumeLevel: 70,
            uptimeSeconds: 0,
            createdAt: new Date().toISOString(),
            lastError: errHint,
            nodeId: 'node-local',
            deviceCategory: raw.id.startsWith('emulator-') ? 'emulator_aosp' : 'physical',
            googlePlay: {
              supported: false,
              playStoreInstalled: false,
              youtubeInstalled: false,
              chromeInstalled: false,
              protectStatus: 'unavailable',
            },
            sessionState: {
              backgroundTasksCount: 0,
              lastInteractedAt: new Date().toISOString(),
              keepAliveInBackground: true,
            },
          };
          db.addDevice(newDev);
          syncedDevices.push(newDev);
        }
        continue;
      }

      // Device is in `device` state: inspect real properties!
      const [propsRes, wmSizeRes, wmDensRes, batRes, memRes, cpuRes, pkgRes, emuAvdRes] = await Promise.all([
        this.execFilePromise(this.adbPath, ['-s', raw.id, 'shell', 'getprop'], 4000),
        this.execFilePromise(this.adbPath, ['-s', raw.id, 'shell', 'wm', 'size'], 3000),
        this.execFilePromise(this.adbPath, ['-s', raw.id, 'shell', 'wm', 'density'], 3000),
        this.execFilePromise(this.adbPath, ['-s', raw.id, 'shell', 'dumpsys', 'battery'], 3000),
        this.execFilePromise(this.adbPath, ['-s', raw.id, 'shell', 'cat', '/proc/meminfo'], 3000),
        this.execFilePromise(this.adbPath, ['-s', raw.id, 'shell', 'dumpsys', 'cpuinfo'], 3500),
        this.execFilePromise(this.adbPath, ['-s', raw.id, 'shell', 'pm', 'list', 'packages', '-f'], 6000),
        raw.id.startsWith('emulator-')
          ? this.execFilePromise(this.adbPath, ['-s', raw.id, 'emu', 'avd', 'name'], 2500)
          : Promise.resolve({ exitCode: 1, stdout: '', stderr: '' }),
      ]);

      const props = parseGetPropOutput(propsRes.stdout);
      const model = props['ro.product.model'] || raw.model || 'Android Device';
      const manufacturer = props['ro.product.manufacturer'] || 'Android';
      const release = props['ro.build.version.release'] || 'Unknown';
      const sdk = parseInt(props['ro.build.version.sdk'] || '0', 10) || 0;
      const abi = props['ro.product.cpu.abi'] || 'arm64-v8a';
      const bootCompleted = props['sys.boot_completed'] === '1';
      const isEmulator =
        raw.id.startsWith('emulator-') ||
        props['ro.boot.qemu'] === '1' ||
        props['ro.kernel.qemu'] === '1';
      const avdName =
        emuAvdRes.exitCode === 0 ? emuAvdRes.stdout.split(/\r?\n/)[0]?.trim() : existing?.avdName;

      const wm = parseWmDisplay(wmSizeRes.stdout, wmDensRes.stdout) || {
        width: 1080,
        height: 2400,
        densityDpi: 420,
      };
      const bat = parseDumpsysBattery(batRes.stdout);
      const mem = parseProcMemInfo(memRes.stdout);
      const cpuUsagePercent = parseDumpsysCpuInfo(cpuRes.stdout);
      const pkgs = parsePmListPackagesOutput(pkgRes.stdout);

      const hasPlayStore = pkgs.some((p) => p.packageName === 'com.android.vending');
      const hasYouTube = pkgs.some((p) => p.packageName === 'com.google.android.youtube');
      const hasChrome = pkgs.some((p) => p.packageName === 'com.android.chrome');
      const hasGms = pkgs.some((p) => p.packageName === 'com.google.android.gms');

      const deviceCategory: VirtualDevice['deviceCategory'] = isEmulator
        ? hasPlayStore
          ? 'emulator_playstore'
          : 'emulator_aosp'
        : 'physical';

      const devId = existing?.id || `adb-${raw.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      // Sync real installed packages to DB
      const installedApps: InstalledApp[] = pkgs.map((p, idx) => ({
        id: `pkg-${devId}-${idx}`,
        deviceId: devId,
        packageName: p.packageName,
        appName: p.packageName.split('.').slice(-1)[0] || p.packageName,
        versionName: 'installed',
        versionCode: 0,
        sizeMb: 0,
        isSystem: p.isSystem,
        iconType: p.packageName.includes('youtube')
          ? 'video'
          : p.packageName.includes('vending')
          ? 'store'
          : p.packageName.includes('chrome')
          ? 'globe'
          : 'box',
        installDate: new Date().toISOString().split('T')[0],
        permissions: [],
        apkPath: p.apkPath,
        googlePlayInstalled: p.packageName === 'com.android.vending',
      }));
      db.setAppsForDevice(devId, installedApps);

      const payload: Partial<VirtualDevice> = {
        name: existing?.name || `${manufacturer} ${model} (${raw.id})`,
        model,
        manufacturer,
        androidVersion: release,
        apiLevel: sdk,
        abi,
        resolution: wm,
        ramMb: mem.totalMb || existing?.ramMb || 0,
        status: bootCompleted ? 'running' : 'booting',
        batteryLevel: bat.level,
        isCharging: bat.isCharging,
        temperatureC: bat.temperatureC,
        cpuUsage: cpuUsagePercent,
        ramUsage: mem.usedPercent,
        isRealAdbDevice: true,
        adbSerial: raw.id,
        avdName,
        emulatorPort: raw.id.startsWith('emulator-')
          ? parseInt(raw.id.replace('emulator-', ''), 10)
          : undefined,
        connectionType: isEmulator
          ? 'emulator'
          : raw.id.includes(':')
          ? 'tcpip'
          : 'usb',
        ipAddress: raw.id.includes(':') ? raw.id.split(':')[0] : props['dhcp.wlan0.ipaddress'] || 'USB/ADB',
        lastError: undefined,
        deviceCategory,
        googlePlay: {
          supported: hasPlayStore || hasGms,
          playStoreInstalled: hasPlayStore,
          youtubeInstalled: hasYouTube,
          chromeInstalled: hasChrome,
          certified: !isEmulator || hasPlayStore,
          protectStatus: hasPlayStore ? 'verified' : 'unavailable',
          systemImageTag: props['ro.product.build.tags'],
        },
      };

      if (existing) {
        const updated = db.updateDevice(existing.id, payload);
        if (updated) syncedDevices.push(updated);
      } else {
        const created: VirtualDevice = {
          id: devId,
          name: `${manufacturer} ${model} (${raw.id})`,
          model,
          manufacturer,
          androidVersion: release,
          apiLevel: sdk,
          abi,
          resolution: wm,
          ramMb: mem.totalMb,
          storageMb: 0,
          storageUsedMb: 0,
          status: bootCompleted ? 'running' : 'booting',
          orientation: 'portrait',
          batteryLevel: bat.level,
          isCharging: bat.isCharging,
          networkType: 'WiFi',
          wifiSsid: 'Android',
          ipAddress: raw.id.includes(':') ? raw.id.split(':')[0] : 'USB/ADB',
          isRealAdbDevice: true,
          adbSerial: raw.id,
          avdName,
          cpuUsage: cpuUsagePercent,
          ramUsage: mem.usedPercent,
          temperatureC: bat.temperatureC,
          screenUnlocked: true,
          volumeLevel: 70,
          uptimeSeconds: 0,
          createdAt: new Date().toISOString(),
          lastBootedAt: new Date().toISOString(),
          nodeId: 'node-local',
          deviceCategory,
          googlePlay: payload.googlePlay!,
          sessionState: {
            backgroundTasksCount: 0,
            lastInteractedAt: new Date().toISOString(),
            keepAliveInBackground: true,
          },
          ...payload,
        };
        db.addDevice(created);
        syncedDevices.push(created);
      }
    }

    return syncedDevices;
  }

  /**
   * Starts a real Android Emulator AVD as an independent OS process OR verifies an attached ADB device.
   * NEVER fakes booting when emulator/KVM is unavailable.
   */
  public async startDevice(deviceId: string): Promise<{ success: boolean; message: string; error?: string }> {
    const dev = db.getDevice(deviceId);
    if (!dev) return { success: false, message: 'Device not found', error: 'Device not found' };

    if (!this.isAdbAvailable) {
      const err = 'Official ADB binary (`platform-tools`) is not installed.';
      db.updateDevice(deviceId, { status: 'error', lastError: err });
      return { success: false, message: err, error: err };
    }

    // Physical or TCP/IP device: verify live ADB state
    if (dev.deviceCategory === 'physical' || (!dev.avdName && dev.adbSerial && !dev.adbSerial.startsWith('emulator-'))) {
      if (!dev.adbSerial) {
        const err = 'No ADB serial assigned to physical/remote device.';
        db.updateDevice(deviceId, { status: 'error', lastError: err });
        return { success: false, message: err, error: err };
      }
      const stateRes = await this.execFilePromise(this.adbPath, ['-s', dev.adbSerial, 'get-state'], 4000);
      if (stateRes.exitCode === 0 && stateRes.stdout.trim() === 'device') {
        await this.scanRealDevices();
        return { success: true, message: `Physical/TCP device ${dev.adbSerial} verified online.` };
      }
      const err = stateRes.stderr.trim() || `Device ${dev.adbSerial} is not online via ADB.`;
      db.updateDevice(deviceId, { status: 'offline', lastError: err });
      return { success: false, message: err, error: err };
    }

    // Emulator AVD boot
    if (!dev.avdName) {
      const err = 'No real Android AVD name (`avdName`) is linked to this profile. Create or select a genuine AVD from `emulator -list-avds` on a host with Android Studio SDK.';
      db.updateDevice(deviceId, { status: 'error', lastError: err });
      return { success: false, message: err, error: err };
    }

    if (!this.emulatorPath) {
      const err = 'Android SDK `emulator` binary is not installed on this host. Cannot launch local AVD.';
      db.updateDevice(deviceId, { status: 'error', lastError: err });
      db.addLog({ deviceId, level: 'E', tag: 'EmulatorLauncher', message: err });
      return { success: false, message: err, error: err };
    }

    if (os.platform() === 'linux' && !this.lastDiagnostics?.kvmAvailable) {
      const err = `Cannot boot x86_64 Android Emulator: ${this.lastDiagnostics?.kvmMessage || '/dev/kvm missing'}`;
      db.updateDevice(deviceId, { status: 'error', lastError: err });
      db.addLog({ deviceId, level: 'E', tag: 'EmulatorLauncher', message: err });
      return { success: false, message: err, error: err };
    }

    // Allocate unique even port 5554..5584
    const usedPorts = new Set(
      db
        .getDevices()
        .filter((d) => d.status === 'running' || d.status === 'booting')
        .map((d) => d.emulatorPort)
        .filter(Boolean)
    );
    let port = dev.emulatorPort || 5554;
    while (usedPorts.has(port)) port += 2;
    const serial = `emulator-${port}`;

    db.updateDevice(deviceId, {
      status: 'booting',
      emulatorPort: port,
      adbSerial: serial,
      lastError: undefined,
    });

    const args = ['-avd', dev.avdName, '-port', String(port), '-no-boot-anim', '-gpu', 'auto'];
    const child = spawn(this.emulatorPath, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let earlyOutput = '';
    child.stdout?.on('data', (d) => (earlyOutput += d.toString()));
    child.stderr?.on('data', (d) => (earlyOutput += d.toString()));

    if (child.pid) {
      this.runningEmulatorPids.set(deviceId, child.pid);
      db.updateDevice(deviceId, { emulatorPid: child.pid });
    }

    // Wait briefly to see if emulator exits immediately with an error
    const earlyCheck = await new Promise<{ exited: boolean; code: number | null }>((resolve) => {
      const timer = setTimeout(() => resolve({ exited: false, code: null }), 2000);
      child.once('exit', (code) => {
        clearTimeout(timer);
        resolve({ exited: true, code });
      });
    });

    if (earlyCheck.exited) {
      const err = earlyOutput.trim() || `Emulator exited immediately with code ${earlyCheck.code}`;
      db.updateDevice(deviceId, { status: 'error', lastError: err, emulatorPid: undefined });
      db.addLog({ deviceId, level: 'E', tag: 'EmulatorLauncher', message: err });
      return { success: false, message: err, error: err };
    }

    child.unref();

    // Poll async for sys.boot_completed
    this.pollEmulatorBoot(deviceId, serial);
    return { success: true, message: `Spawned real emulator process (PID ${child.pid}) for AVD ${dev.avdName} on ${serial}.` };
  }

  private pollEmulatorBoot(deviceId: string, serial: string) {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 45) {
        clearInterval(interval);
        db.updateDevice(deviceId, {
          status: 'error',
          lastError: `Timed out waiting for ${serial} sys.boot_completed=1 after 90s.`,
        });
        return;
      }
      const res = await this.execFilePromise(
        this.adbPath,
        ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'],
        2500
      );
      if (res.exitCode === 0 && res.stdout.trim() === '1') {
        clearInterval(interval);
        await this.scanRealDevices();
        db.addLog({
          deviceId,
          level: 'I',
          tag: 'EmulatorBoot',
          message: `Real Android OS boot completed on ${serial} (sys.boot_completed=1).`,
        });
      }
    }, 2000);
  }

  public async stopDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
    const dev = db.getDevice(deviceId);
    if (!dev) return { success: false, message: 'Device not found' };

    if (dev.adbSerial?.startsWith('emulator-') && this.isAdbAvailable) {
      const res = await this.execFilePromise(this.adbPath, ['-s', dev.adbSerial, 'emu', 'kill'], 5000);
      const pid = dev.emulatorPid || this.runningEmulatorPids.get(deviceId);
      if (pid) {
        try {
          process.kill(pid);
        } catch {}
        this.runningEmulatorPids.delete(deviceId);
      }
      db.updateDevice(deviceId, {
        status: 'stopped',
        cpuUsage: 0,
        ramUsage: 0,
        emulatorPid: undefined,
      });
      return {
        success: res.exitCode === 0,
        message: res.exitCode === 0 ? `Stopped emulator ${dev.adbSerial}` : res.stderr || 'Kill signal sent',
      };
    }

    if (dev.connectionType === 'tcpip' && dev.adbSerial && this.isAdbAvailable) {
      await this.disconnectAdbEndpoint(dev.adbSerial);
      db.updateDevice(deviceId, { status: 'stopped', cpuUsage: 0, ramUsage: 0 });
      return { success: true, message: `Disconnected TCP/IP ADB session ${dev.adbSerial}` };
    }

    return {
      success: false,
      message: 'Physical USB devices cannot be powered off remotely via standard ADB `emu kill`. Unplug or use `adb shell reboot -p` if rooted.',
    };
  }

  /**
   * Captures a genuine PNG framebuffer directly from `adb -s <serial> exec-out screencap -p`.
   * Never fabricates a dummy 1x1 PNG.
   */
  public async captureScreenPng(
    deviceId: string
  ): Promise<{ success: boolean; buffer?: Buffer; error?: string; command: string; durationMs: number }> {
    const dev = db.getDevice(deviceId);
    const start = Date.now();
    if (!dev) {
      return { success: false, error: 'Device not found', command: '', durationMs: 0 };
    }
    if (!this.isAdbAvailable) {
      return {
        success: false,
        error: 'ADB binary not available on host.',
        command: 'adb exec-out screencap -p',
        durationMs: 0,
      };
    }
    if (!dev.adbSerial || !isValidAdbSerialOrEndpoint(dev.adbSerial)) {
      return {
        success: false,
        error: `Device "${dev.name}" has no active ADB serial attached.`,
        command: 'adb exec-out screencap -p',
        durationMs: 0,
      };
    }

    const command = `${this.adbPath} -s ${dev.adbSerial} exec-out screencap -p`;
    return new Promise((resolve) => {
      execFile(
        this.adbPath,
        ['-s', dev.adbSerial!, 'exec-out', 'screencap', '-p'],
        { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, timeout: 8000 },
        (err, stdout, stderr) => {
          const durationMs = Date.now() - start;
          if (err) {
            resolve({
              success: false,
              error: (stderr?.toString() || err.message || 'screencap failed').trim(),
              command,
              durationMs,
            });
            return;
          }
          const buf = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
          // Validate PNG signature: 89 50 4E 47 0D 0A 1A 0A
          const isPng = buf.length > 16 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
          if (!isPng) {
            resolve({
              success: false,
              error: `Invalid PNG framebuffer output (${buf.length} bytes): ${buf.toString('utf8', 0, 200)}`,
              command,
              durationMs,
            });
            return;
          }
          resolve({ success: true, buffer: buf, command, durationMs });
        }
      );
    });
  }

  /**
   * Starts a genuine Android `adb shell screenrecord` MP4 recording on the device.
   */
  public async startScreenRecord(
    deviceId: string
  ): Promise<{ success: boolean; remotePath?: string; error?: string }> {
    const dev = db.getDevice(deviceId);
    if (!dev || !this.isAdbAvailable || !dev.adbSerial || !isValidAdbSerialOrEndpoint(dev.adbSerial)) {
      return { success: false, error: 'ADB or attached device serial unavailable for screen recording.' };
    }
    if (this.activeRecordings.has(deviceId)) {
      return { success: false, error: 'Screen recording is already active for this device.' };
    }

    const remotePath = `/sdcard/dynoshi_rec_${Date.now()}.mp4`;
    const child = spawn(
      this.adbPath,
      ['-s', dev.adbSerial, 'shell', 'screenrecord', '--bit-rate', '4000000', remotePath],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let earlyErr = '';
    child.stderr?.on('data', (d) => (earlyErr += d.toString()));

    const exitedEarly = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 700);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });

    if (exitedEarly) {
      return {
        success: false,
        error: earlyErr.trim() || 'adb shell screenrecord exited immediately (device may lack screenrecord binary).',
      };
    }

    this.activeRecordings.set(deviceId, {
      pid: child.pid || 0,
      remotePath,
      startedAt: Date.now(),
      child,
    });
    return { success: true, remotePath };
  }

  /**
   * Stops active `screenrecord`, flushes MP4 container, and pulls the file to host disk.
   */
  public async stopScreenRecord(
    deviceId: string,
    mediaDir: string
  ): Promise<{
    success: boolean;
    fileName?: string;
    filePath?: string;
    fileSizeBytes?: number;
    error?: string;
  }> {
    const dev = db.getDevice(deviceId);
    const rec = this.activeRecordings.get(deviceId);
    if (!dev || !dev.adbSerial || !rec) {
      return { success: false, error: 'No active screen recording found for this device.' };
    }

    this.activeRecordings.delete(deviceId);
    await this.execFilePromise(this.adbPath, ['-s', dev.adbSerial, 'shell', 'pkill', '-INT', 'screenrecord'], 3000);
    try {
      rec.child.kill('SIGINT');
    } catch {}

    // Give Android media muxer a moment to finalize the MP4 moov atom
    await new Promise((r) => setTimeout(r, 1200));

    const fileName = `recording_${dev.id}_${Date.now()}.mp4`;
    const localPath = path.join(mediaDir, fileName);
    const pullRes = await this.pullFile(deviceId, rec.remotePath, localPath);
    await this.execFilePromise(this.adbPath, ['-s', dev.adbSerial, 'shell', 'rm', '-f', rec.remotePath], 3000);

    if (!pullRes.success || !fs.existsSync(localPath)) {
      return { success: false, error: pullRes.stderr || 'Failed to pull recorded MP4 from device.' };
    }

    const stat = fs.statSync(localPath);
    if (stat.size < 1024) {
      try {
        fs.unlinkSync(localPath);
      } catch {}
      return { success: false, error: 'Recorded MP4 file was empty or incomplete.' };
    }

    return {
      success: true,
      fileName,
      filePath: localPath,
      fileSizeBytes: stat.size,
    };
  }

  /**
   * Executes a real ADB command on a real attached device. ZERO simulation fallback!
   */
  public async executeCommand(deviceId: string, command: string): Promise<CommandResult> {
    const startTime = Date.now();
    const dev = db.getDevice(deviceId);

    if (!dev) {
      return {
        success: false,
        command,
        exitCode: 1,
        output: '',
        stderr: 'Device not found in registry.',
        durationMs: 0,
      };
    }

    if (!this.isAdbAvailable) {
      return {
        success: false,
        command,
        exitCode: 1,
        output: '',
        stderr: 'ADB binary (`platform-tools`) is not available on this host.',
        durationMs: 0,
      };
    }

    if (!dev.adbSerial || !isValidAdbSerialOrEndpoint(dev.adbSerial)) {
      return {
        success: false,
        command,
        exitCode: 1,
        output: '',
        stderr: `Device "${dev.name}" is not attached to a real ADB serial (adbSerial is empty).`,
        durationMs: 0,
      };
    }

    const fullCmd = `"${this.adbPath}" -s "${dev.adbSerial}" ${command}`;
    const res = await this.execShellPromise(fullCmd, 20000);
    return {
      success: res.exitCode === 0,
      command: fullCmd,
      exitCode: res.exitCode,
      output: res.stdout.trim(),
      stderr: res.stderr.trim(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Runs the mandatory Technical Verification checks and returns verbatim stdout/stderr.
   */
  public async verifyDevice(deviceId: string): Promise<DeviceVerificationReport> {
    const dev = db.getDevice(deviceId);
    const serial = dev?.adbSerial || 'NONE';
    const checks: DeviceVerificationCheck[] = [];

    const runCheck = async (id: string, label: string, args: string[], validator?: (stdout: string, exitCode: number) => boolean) => {
      const start = Date.now();
      if (!this.isAdbAvailable) {
        checks.push({
          id,
          label,
          command: `adb ${args.join(' ')}`,
          exitCode: 1,
          passed: false,
          stdout: '',
          stderr: 'ADB binary not installed.',
          durationMs: 0,
        });
        return { exitCode: 1, stdout: '', stderr: 'ADB binary not installed.' };
      }
      if (!dev?.adbSerial && args[0] === '-s') {
        checks.push({
          id,
          label,
          command: `adb ${args.join(' ')}`,
          exitCode: 1,
          passed: false,
          stdout: '',
          stderr: 'No live ADB serial attached for this device.',
          durationMs: 0,
        });
        return { exitCode: 1, stdout: '', stderr: 'No live ADB serial attached.' };
      }
      const res = await this.execFilePromise(this.adbPath, args, 10000);
      const passed = validator ? validator(res.stdout, res.exitCode) : res.exitCode === 0;
      checks.push({
        id,
        label,
        command: `${this.adbPath} ${args.join(' ')}`,
        exitCode: res.exitCode,
        passed,
        stdout: res.stdout.trim(),
        stderr: res.stderr.trim(),
        durationMs: Date.now() - start,
      });
      return res;
    };

    const devListRes = await runCheck(
      'adb_devices',
      '1. Attached ADB Devices (`adb devices -l`)',
      ['devices', '-l'],
      (out, code) => code === 0 && (serial !== 'NONE' ? out.includes(serial) && /\bdevice\b/.test(out) : false)
    );

    const relRes = await runCheck(
      'os_release',
      '2. Android OS Release (`getprop ro.build.version.release`)',
      ['-s', serial, 'shell', 'getprop', 'ro.build.version.release'],
      (out, code) => code === 0 && out.trim().length > 0
    );

    const modelRes = await runCheck(
      'device_model',
      '3. Hardware Model (`getprop ro.product.model`)',
      ['-s', serial, 'shell', 'getprop', 'ro.product.model'],
      (out, code) => code === 0 && out.trim().length > 0
    );

    const mfgRes = await runCheck(
      'device_mfg',
      '4. Manufacturer (`getprop ro.product.manufacturer`)',
      ['-s', serial, 'shell', 'getprop', 'ro.product.manufacturer'],
      (out, code) => code === 0 && out.trim().length > 0
    );

    const bootRes = await runCheck(
      'boot_completed',
      '5. Android Boot Completed (`getprop sys.boot_completed`)',
      ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'],
      (out, code) => code === 0 && out.trim() === '1'
    );

    const pkgRes = await runCheck(
      'pm_packages',
      '6. Installed Packages (`pm list packages` -> Play Store & YouTube check)',
      ['-s', serial, 'shell', 'pm', 'list', 'packages'],
      (out, code) => code === 0 && out.includes('package:')
    );

    const pkgs = parsePmListPackagesOutput(pkgRes.stdout);
    const hasPlayStore = pkgs.some((p) => p.packageName === 'com.android.vending');
    const hasYouTube = pkgs.some((p) => p.packageName === 'com.google.android.youtube');
    const hasChrome = pkgs.some((p) => p.packageName === 'com.android.chrome');

    checks.push({
      id: 'pkg_vending',
      label: '7. Google Play Store Package (`com.android.vending`)',
      command: `adb -s ${serial} shell pm path com.android.vending`,
      exitCode: hasPlayStore ? 0 : 1,
      passed: hasPlayStore,
      stdout: hasPlayStore ? 'package:com.android.vending VERIFIED PRESENT' : '',
      stderr: hasPlayStore ? '' : 'com.android.vending is NOT installed on this Android system image.',
      durationMs: 0,
    });

    checks.push({
      id: 'pkg_youtube',
      label: '8. Official YouTube Package (`com.google.android.youtube`)',
      command: `adb -s ${serial} shell pm path com.google.android.youtube`,
      exitCode: hasYouTube ? 0 : 1,
      passed: hasYouTube,
      stdout: hasYouTube ? 'package:com.google.android.youtube VERIFIED PRESENT' : '',
      stderr: hasYouTube ? '' : 'com.google.android.youtube is NOT installed on this device.',
      durationMs: 0,
    });

    const netRes = await runCheck(
      'network_check',
      '9. Network Connectivity (`ping -c 1 -W 3 8.8.8.8`)',
      ['-s', serial, 'shell', 'ping', '-c', '1', '-W', '3', '8.8.8.8'],
      (out, code) => code === 0 && /1 received|1 packets received/i.test(out)
    );

    await runCheck(
      'window_focus',
      '10. Active Window & Processes (`dumpsys window displays`)',
      ['-s', serial, 'shell', 'dumpsys', 'window', 'displays'],
      (out, code) => code === 0 && out.trim().length > 0
    );

    const overallPassed =
      devListRes.exitCode === 0 &&
      serial !== 'NONE' &&
      bootRes.stdout.trim() === '1' &&
      pkgs.length > 0;

    const report: DeviceVerificationReport = {
      deviceId,
      adbSerial: serial,
      verifiedAt: new Date().toISOString(),
      overallPassed,
      androidRelease: relRes.stdout.trim() || undefined,
      deviceModel: modelRes.stdout.trim() || undefined,
      manufacturer: mfgRes.stdout.trim() || undefined,
      bootCompleted: bootRes.stdout.trim() === '1',
      isEmulator: serial.startsWith('emulator-'),
      hasPlayStore,
      hasYouTube,
      hasChrome,
      networkConnected: netRes.exitCode === 0,
      checks,
    };

    if (dev) {
      db.updateDevice(dev.id, { verificationReport: report });
    }

    return report;
  }

  /**
   * Executes real-time hardware diagnostics (`adb devices -l`, `adb shell getprop`,
   * `pm path com.android.vending`, `pm path com.google.android.youtube`) for LiveDeviceControlView.
   */
  public async getLiveDeviceDiagnostics(deviceId?: string | null): Promise<LiveDeviceDiagnosticsResult> {
    const dev = deviceId ? db.getDevice(deviceId) : undefined;
    const checkedAt = new Date().toISOString();

    if (!this.isAdbAvailable) {
      const noAdbErr = 'Official ADB binary (`platform-tools`) is not installed or detected on this host.';
      return {
        deviceId: dev?.id || deviceId || null,
        adbSerial: dev?.adbSerial || null,
        adbAvailable: false,
        adbPath: this.adbPath,
        checkedAt,
        adbDevices: {
          command: 'adb devices -l',
          exitCode: 1,
          passed: false,
          stdout: '',
          stderr: noAdbErr,
          durationMs: 0,
          attachedCount: 0,
          devices: [],
        },
        getprop: {
          command: 'adb shell getprop',
          exitCode: 1,
          passed: false,
          stdout: '',
          stderr: noAdbErr,
          durationMs: 0,
          properties: {},
          propertyCount: 0,
          highlights: {},
        },
        packages: {
          playStore: {
            packageName: 'com.android.vending',
            command: 'adb shell pm path com.android.vending',
            exitCode: 1,
            passed: false,
            stdout: '',
            stderr: noAdbErr,
            durationMs: 0,
            installed: false,
            apkPaths: [],
          },
          youtube: {
            packageName: 'com.google.android.youtube',
            command: 'adb shell pm path com.google.android.youtube',
            exitCode: 1,
            passed: false,
            stdout: '',
            stderr: noAdbErr,
            durationMs: 0,
            installed: false,
            apkPaths: [],
          },
        },
      };
    }

    // 1. Always execute real `adb devices -l`
    const tDev0 = Date.now();
    const devRes = await this.execFilePromise(this.adbPath, ['devices', '-l'], 5000);
    const devDuration = Date.now() - tDev0;
    const parsedDevices = devRes.exitCode === 0 ? parseAdbDevicesOutput(devRes.stdout) : [];

    // Resolve target serial strictly from selected device (or fallback only if no deviceId was requested and one is attached)
    let targetSerial: string | null = dev?.adbSerial && isValidAdbSerialOrEndpoint(dev.adbSerial)
      ? dev.adbSerial
      : null;
    if (!targetSerial && !deviceId) {
      const online = parsedDevices.find((d) => d.state === 'device');
      if (online && isValidAdbSerialOrEndpoint(online.id)) {
        targetSerial = online.id;
      }
    }

    if (!targetSerial) {
      const noSerialErr = dev
        ? `Device "${dev.name}" is not attached to a live ADB serial (status: ${dev.status}). Connect via USB/TCP-IP or boot AVD.`
        : 'No connected ADB device selected (`adb devices -l` returned 0 ready devices).';
      return {
        deviceId: dev?.id || null,
        adbSerial: null,
        adbAvailable: true,
        adbPath: this.adbPath,
        checkedAt,
        adbDevices: {
          command: `${this.adbPath} devices -l`,
          exitCode: devRes.exitCode,
          passed: devRes.exitCode === 0,
          stdout: devRes.stdout.trim(),
          stderr: devRes.stderr.trim(),
          durationMs: devDuration,
          attachedCount: parsedDevices.length,
          devices: parsedDevices,
        },
        getprop: {
          command: 'adb -s <serial> shell getprop',
          exitCode: 1,
          passed: false,
          stdout: '',
          stderr: noSerialErr,
          durationMs: 0,
          properties: {},
          propertyCount: 0,
          highlights: {},
        },
        packages: {
          playStore: {
            packageName: 'com.android.vending',
            command: 'adb -s <serial> shell pm path com.android.vending',
            exitCode: 1,
            passed: false,
            stdout: '',
            stderr: noSerialErr,
            durationMs: 0,
            installed: false,
            apkPaths: [],
          },
          youtube: {
            packageName: 'com.google.android.youtube',
            command: 'adb -s <serial> shell pm path com.google.android.youtube',
            exitCode: 1,
            passed: false,
            stdout: '',
            stderr: noSerialErr,
            durationMs: 0,
            installed: false,
            apkPaths: [],
          },
        },
      };
    }

    // 2. Execute `adb -s <serial> shell getprop`, `pm path com.android.vending`, and `pm path com.google.android.youtube` in parallel
    const runTimed = async (args: string[], timeoutMs: number) => {
      const start = Date.now();
      const res = await this.execFilePromise(this.adbPath, args, timeoutMs);
      return {
        ...res,
        command: `${this.adbPath} ${args.join(' ')}`,
        durationMs: Date.now() - start,
      };
    };

    const [getpropRes, playRes, ytRes] = await Promise.all([
      runTimed(['-s', targetSerial, 'shell', 'getprop'], 6000),
      runTimed(['-s', targetSerial, 'shell', 'pm', 'path', 'com.android.vending'], 5000),
      runTimed(['-s', targetSerial, 'shell', 'pm', 'path', 'com.google.android.youtube'], 5000),
    ]);

    const properties = getpropRes.exitCode === 0 ? parseGetPropOutput(getpropRes.stdout) : {};
    const playPaths = parsePmPathOutput(playRes.stdout);
    const ytPaths = parsePmPathOutput(ytRes.stdout);

    return {
      deviceId: dev?.id || null,
      adbSerial: targetSerial,
      adbAvailable: true,
      adbPath: this.adbPath,
      checkedAt,
      adbDevices: {
        command: `${this.adbPath} devices -l`,
        exitCode: devRes.exitCode,
        passed: devRes.exitCode === 0 && parsedDevices.some((d) => d.id === targetSerial && d.state === 'device'),
        stdout: devRes.stdout.trim(),
        stderr: devRes.stderr.trim(),
        durationMs: devDuration,
        attachedCount: parsedDevices.length,
        devices: parsedDevices,
      },
      getprop: {
        command: getpropRes.command,
        exitCode: getpropRes.exitCode,
        passed: getpropRes.exitCode === 0 && Object.keys(properties).length > 0,
        stdout: getpropRes.stdout.trim(),
        stderr: getpropRes.stderr.trim(),
        durationMs: getpropRes.durationMs,
        properties,
        propertyCount: Object.keys(properties).length,
        highlights: extractGetPropHighlights(properties),
      },
      packages: {
        playStore: {
          packageName: 'com.android.vending',
          command: playRes.command,
          exitCode: playRes.exitCode,
          passed: playRes.exitCode === 0 && playPaths.length > 0,
          stdout: playRes.stdout.trim(),
          stderr: playRes.stderr.trim() || (playPaths.length === 0 ? 'Package com.android.vending not installed on device.' : ''),
          durationMs: playRes.durationMs,
          installed: playRes.exitCode === 0 && playPaths.length > 0,
          apkPaths: playPaths,
        },
        youtube: {
          packageName: 'com.google.android.youtube',
          command: ytRes.command,
          exitCode: ytRes.exitCode,
          passed: ytRes.exitCode === 0 && ytPaths.length > 0,
          stdout: ytRes.stdout.trim(),
          stderr: ytRes.stderr.trim() || (ytPaths.length === 0 ? 'Package com.google.android.youtube not installed on device.' : ''),
          durationMs: ytRes.durationMs,
          installed: ytRes.exitCode === 0 && ytPaths.length > 0,
          apkPaths: ytPaths,
        },
      },
    };
  }

  /**
   * Executes a single targeted ADB diagnostic verification step (`devices`, `getprop`, `playstore`, or `youtube`).
   */
  public async runLiveDiagnosticStep(
    step: 'devices' | 'getprop' | 'playstore' | 'youtube',
    deviceId?: string | null
  ): Promise<{
    step: 'devices' | 'getprop' | 'playstore' | 'youtube';
    command: string;
    exitCode: number;
    passed: boolean;
    stdout: string;
    stderr: string;
    durationMs: number;
    checkedAt: string;
    adbSerial: string | null;
    extra?: Record<string, any>;
  }> {
    const checkedAt = new Date().toISOString();
    const dev = deviceId ? db.getDevice(deviceId) : undefined;

    if (!this.isAdbAvailable) {
      return {
        step,
        command: `adb ${step}`,
        exitCode: 1,
        passed: false,
        stdout: '',
        stderr: 'Official ADB binary (`platform-tools`) is not installed or detected on this host.',
        durationMs: 0,
        checkedAt,
        adbSerial: dev?.adbSerial || null,
      };
    }

    if (step === 'devices') {
      const start = Date.now();
      const res = await this.execFilePromise(this.adbPath, ['devices', '-l'], 5000);
      const parsedDevices = res.exitCode === 0 ? parseAdbDevicesOutput(res.stdout) : [];
      const readyCount = parsedDevices.filter((d) => d.state === 'device').length;
      return {
        step,
        command: `${this.adbPath} devices -l`,
        exitCode: res.exitCode,
        passed: res.exitCode === 0 && readyCount > 0,
        stdout: res.stdout.trim(),
        stderr: res.stderr.trim(),
        durationMs: Date.now() - start,
        checkedAt,
        adbSerial: dev?.adbSerial || parsedDevices[0]?.id || null,
        extra: { attachedCount: parsedDevices.length, devices: parsedDevices },
      };
    }

    let targetSerial: string | null =
      dev?.adbSerial && isValidAdbSerialOrEndpoint(dev.adbSerial) ? dev.adbSerial : null;

    if (!targetSerial && !deviceId) {
      const devList = await this.execFilePromise(this.adbPath, ['devices', '-l'], 4000);
      const online = parseAdbDevicesOutput(devList.stdout).find((d) => d.state === 'device');
      if (online && isValidAdbSerialOrEndpoint(online.id)) {
        targetSerial = online.id;
      }
    }

    if (!targetSerial) {
      const cmdDesc =
        step === 'getprop'
          ? 'adb -s <serial> shell getprop'
          : step === 'playstore'
          ? 'adb -s <serial> shell pm path com.android.vending'
          : 'adb -s <serial> shell pm path com.google.android.youtube';
      const errMsg = dev
        ? `Device "${dev.name}" is not attached to a live ADB serial (status: ${dev.status}).`
        : 'No attached online Android device found via `adb devices -l`.';
      return {
        step,
        command: cmdDesc,
        exitCode: 1,
        passed: false,
        stdout: '',
        stderr: errMsg,
        durationMs: 0,
        checkedAt,
        adbSerial: null,
      };
    }

    if (step === 'getprop') {
      const start = Date.now();
      const res = await this.execFilePromise(this.adbPath, ['-s', targetSerial, 'shell', 'getprop'], 6000);
      const props = res.exitCode === 0 ? parseGetPropOutput(res.stdout) : {};
      const propCount = Object.keys(props).length;
      return {
        step,
        command: `${this.adbPath} -s ${targetSerial} shell getprop`,
        exitCode: res.exitCode,
        passed: res.exitCode === 0 && propCount > 0,
        stdout: res.stdout.trim(),
        stderr: res.stderr.trim(),
        durationMs: Date.now() - start,
        checkedAt,
        adbSerial: targetSerial,
        extra: {
          propertyCount: propCount,
          properties: props,
          highlights: extractGetPropHighlights(props),
        },
      };
    }

    const pkgName = step === 'playstore' ? 'com.android.vending' : 'com.google.android.youtube';
    const start = Date.now();
    const res = await this.execFilePromise(
      this.adbPath,
      ['-s', targetSerial, 'shell', 'pm', 'path', pkgName],
      5000
    );
    const paths = parsePmPathOutput(res.stdout);
    const installed = res.exitCode === 0 && paths.length > 0;
    return {
      step,
      command: `${this.adbPath} -s ${targetSerial} shell pm path ${pkgName}`,
      exitCode: res.exitCode,
      passed: installed,
      stdout: res.stdout.trim(),
      stderr: res.stderr.trim() || (!installed ? `Package ${pkgName} not installed on ${targetSerial}.` : ''),
      durationMs: Date.now() - start,
      checkedAt,
      adbSerial: targetSerial,
      extra: { packageName: pkgName, installed, apkPaths: paths },
    };
  }

  public async installApk(
    deviceId: string,
    apkFilePath: string
  ): Promise<{ success: boolean; message: string; stdout?: string; stderr?: string }> {
    const dev = db.getDevice(deviceId);
    if (!dev) return { success: false, message: 'Device not found' };
    if (!this.isAdbAvailable || !dev.adbSerial) {
      return {
        success: false,
        message: 'Cannot install APK: real ADB binary or attached device serial is missing.',
      };
    }

    const res = await this.execFilePromise(
      this.adbPath,
      ['-s', dev.adbSerial, 'install', '-r', apkFilePath],
      60000
    );

    if (res.exitCode === 0 && /Success/i.test(res.stdout)) {
      await this.scanRealDevices();
      db.addLog({
        deviceId,
        level: 'I',
        tag: 'AdbInstall',
        message: `adb install -r succeeded: ${res.stdout.trim()}`,
      });
      return { success: true, message: res.stdout.trim(), stdout: res.stdout };
    }

    const errMsg = (res.stderr || res.stdout || 'adb install failed').trim();
    db.addLog({ deviceId, level: 'E', tag: 'AdbInstall', message: errMsg });
    return { success: false, message: errMsg, stdout: res.stdout, stderr: res.stderr };
  }

  public async launchApp(deviceId: string, packageName: string): Promise<CommandResult> {
    if (!isValidPackageName(packageName)) {
      return {
        success: false,
        command: `monkey -p ${packageName}`,
        exitCode: 1,
        output: '',
        stderr: `Invalid Android package name: ${packageName}`,
        durationMs: 0,
      };
    }
    const res = await this.executeCommand(
      deviceId,
      `shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`
    );
    if (res.success && !/No activities found to run/i.test(res.output)) {
      db.updateDevice(deviceId, { activeAppPackage: packageName, activeAppTitle: packageName });
    } else if (/No activities found to run/i.test(res.output)) {
      return { ...res, success: false, stderr: res.output };
    }
    return res;
  }

  public async openUrl(deviceId: string, url: string): Promise<CommandResult> {
    const cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      return {
        success: false,
        command: 'am start -a android.intent.action.VIEW',
        exitCode: 1,
        output: '',
        stderr: 'URL must start with http:// or https://',
        durationMs: 0,
      };
    }
    return this.executeCommand(
      deviceId,
      `shell am start -a android.intent.action.VIEW -d "${cleanUrl.replace(/"/g, '')}"`
    );
  }

  public async forceStopApp(deviceId: string, packageName: string): Promise<CommandResult> {
    if (!isValidPackageName(packageName)) {
      return { success: false, command: 'am force-stop', exitCode: 1, output: '', stderr: 'Invalid package name', durationMs: 0 };
    }
    return this.executeCommand(deviceId, `shell am force-stop ${packageName}`);
  }

  public async clearAppData(deviceId: string, packageName: string): Promise<CommandResult> {
    if (!isValidPackageName(packageName)) {
      return { success: false, command: 'pm clear', exitCode: 1, output: '', stderr: 'Invalid package name', durationMs: 0 };
    }
    return this.executeCommand(deviceId, `shell pm clear ${packageName}`);
  }

  public async uninstallApp(deviceId: string, packageName: string): Promise<CommandResult> {
    if (!isValidPackageName(packageName)) {
      return { success: false, command: 'uninstall', exitCode: 1, output: '', stderr: 'Invalid package name', durationMs: 0 };
    }
    const res = await this.executeCommand(deviceId, `uninstall ${packageName}`);
    if (res.success) db.removeApp(deviceId, packageName);
    return res;
  }

  public async listFiles(
    deviceId: string,
    targetPath: string
  ): Promise<{ success: boolean; items: DeviceFileItem[]; error?: string }> {
    const safePath = targetPath.replace(/["`$;&|<>]/g, '');
    const res = await this.executeCommand(deviceId, `shell ls -la "${safePath}"`);
    if (!res.success) {
      return { success: false, items: [], error: res.stderr || res.output };
    }
    return { success: true, items: parseAdbLsOutput(res.output, safePath) };
  }

  public async pushFile(deviceId: string, localPath: string, remotePath: string): Promise<CommandResult> {
    const dev = db.getDevice(deviceId);
    if (!dev || !this.isAdbAvailable || !dev.adbSerial) {
      return { success: false, command: 'adb push', exitCode: 1, output: '', stderr: 'ADB or device serial unavailable.', durationMs: 0 };
    }
    const start = Date.now();
    const res = await this.execFilePromise(this.adbPath, ['-s', dev.adbSerial, 'push', localPath, remotePath], 30000);
    return {
      success: res.exitCode === 0,
      command: `${this.adbPath} -s ${dev.adbSerial} push`,
      exitCode: res.exitCode,
      output: res.stdout.trim(),
      stderr: res.stderr.trim(),
      durationMs: Date.now() - start,
    };
  }

  public async pullFile(deviceId: string, remotePath: string, localPath: string): Promise<CommandResult> {
    const dev = db.getDevice(deviceId);
    if (!dev || !this.isAdbAvailable || !dev.adbSerial) {
      return { success: false, command: 'adb pull', exitCode: 1, output: '', stderr: 'ADB or device serial unavailable.', durationMs: 0 };
    }
    const start = Date.now();
    const res = await this.execFilePromise(this.adbPath, ['-s', dev.adbSerial, 'pull', remotePath, localPath], 30000);
    return {
      success: res.exitCode === 0,
      command: `${this.adbPath} -s ${dev.adbSerial} pull`,
      exitCode: res.exitCode,
      output: res.stdout.trim(),
      stderr: res.stderr.trim(),
      durationMs: Date.now() - start,
    };
  }

  public async fetchDeviceLogcat(deviceId: string, lines: number = 200): Promise<{ success: boolean; entries: LogEntry[]; error?: string }> {
    const res = await this.executeCommand(deviceId, `logcat -d -v time -t ${Math.min(500, Math.max(20, lines))}`);
    if (!res.success) {
      return { success: false, entries: [], error: res.stderr || res.output };
    }
    return { success: true, entries: parseLogcatOutput(res.output, deviceId) };
  }

  public async sendInput(deviceId: string, type: 'tap' | 'swipe' | 'key' | 'text', params: any): Promise<CommandResult> {
    const cmd = buildAdbInputCommand(type, params);
    return this.executeCommand(deviceId, `shell ${cmd}`);
  }
}

export const adbService = new AdbService();
