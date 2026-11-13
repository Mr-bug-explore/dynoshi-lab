/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Pure Logic & Real Android Output Parsers
 * Tested via node:test and tsx
 */

import type { DeviceFileItem, EmulatorAvdInfo, LogEntry } from '../types.js';

export interface DeviceResolution {
  width: number;
  height: number;
  densityDpi: number;
}

export interface TouchCoordinate {
  x: number;
  y: number;
}

export type Orientation = 'portrait' | 'landscape';

/**
 * Normalizes and translates client mouse/touch clicks from viewport bounding box
 * to physical device coordinates, taking orientation and scaling into account.
 */
export function translateCoordinates(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  deviceRes: DeviceResolution,
  orientation: Orientation = 'portrait'
): TouchCoordinate {
  const safeW = rect.width > 0 ? rect.width : 1;
  const safeH = rect.height > 0 ? rect.height : 1;
  const normX = Math.max(0, Math.min(1, (clientX - rect.left) / safeW));
  const normY = Math.max(0, Math.min(1, (clientY - rect.top) / safeH));

  const targetWidth = orientation === 'portrait' ? deviceRes.width : deviceRes.height;
  const targetHeight = orientation === 'portrait' ? deviceRes.height : deviceRes.width;

  return {
    x: Math.round(normX * targetWidth),
    y: Math.round(normY * targetHeight),
  };
}

/**
 * Validates Android package name according to Android OS specifications
 * e.g., com.example.myapp
 */
export function isValidPackageName(packageName: string): boolean {
  if (!packageName || packageName.length > 255) return false;
  const regex = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
  return regex.test(packageName);
}

/**
 * Validates APK filename and sanitized output
 */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Validates an ADB TCP/IP endpoint or USB serial string to prevent shell injection.
 */
export function isValidAdbSerialOrEndpoint(serial: string): boolean {
  if (!serial || serial.length > 128) return false;
  return /^[a-zA-Z0-9._:-]+$/.test(serial.trim());
}

/**
 * Calculate Swipe parameters from start and end points
 */
export interface SwipeParams {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
}

export function calculateSwipe(
  direction: 'up' | 'down' | 'left' | 'right',
  res: DeviceResolution,
  orientation: Orientation = 'portrait',
  distancePercent: number = 0.5,
  durationMs: number = 300
): SwipeParams {
  const w = orientation === 'portrait' ? res.width : res.height;
  const h = orientation === 'portrait' ? res.height : res.width;

  const centerX = Math.round(w / 2);
  const centerY = Math.round(h / 2);
  const deltaX = Math.round(w * distancePercent * 0.5);
  const deltaY = Math.round(h * distancePercent * 0.5);

  switch (direction) {
    case 'up':
      return { startX: centerX, startY: centerY + deltaY, endX: centerX, endY: centerY - deltaY, durationMs };
    case 'down':
      return { startX: centerX, startY: centerY - deltaY, endX: centerX, endY: centerY + deltaY, durationMs };
    case 'left':
      return { startX: centerX + deltaX, startY: centerY, endX: centerX - deltaX, endY: centerY, durationMs };
    case 'right':
      return { startX: centerX - deltaX, startY: centerY, endX: centerX + deltaX, endY: centerY, durationMs };
  }
}

/**
 * Builds safe ADB shell input command
 */
export function buildAdbInputCommand(type: 'tap' | 'swipe' | 'key' | 'text', params: any): string {
  switch (type) {
    case 'tap':
      return `input tap ${Math.round(Number(params.x) || 0)} ${Math.round(Number(params.y) || 0)}`;
    case 'swipe':
      return `input swipe ${Math.round(Number(params.startX) || 0)} ${Math.round(Number(params.startY) || 0)} ${Math.round(Number(params.endX) || 0)} ${Math.round(Number(params.endY) || 0)} ${Math.round(Number(params.durationMs) || 300)}`;
    case 'key':
      return `input keyevent ${Math.round(Number(params.keyCode) || 0)}`;
    case 'text': {
      // Android `input text` expects %s for spaces and escaped shell metacharacters
      const raw = String(params.text ?? '');
      const escaped = raw
        .replace(/\\/g, '\\\\')
        .replace(/ /g, '%s')
        .replace(/(['"$`!*()&|;<>{}[\]?~])/g, '\\$1');
      return `input text "${escaped}"`;
    }
    default:
      throw new Error(`Unsupported input type: ${type}`);
  }
}

/**
 * Parses `adb devices -l` standard output into structured device list
 */
export interface AdbDeviceOutput {
  id: string;
  state: 'device' | 'offline' | 'unauthorized' | 'recovery' | 'unknown';
  model?: string;
  product?: string;
  device?: string;
  transportId?: string;
}

export function parseAdbDevicesOutput(output: string): AdbDeviceOutput[] {
  const lines = output.trim().split('\n');
  const devices: AdbDeviceOutput[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('List of devices attached') || line.startsWith('* daemon')) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    const id = parts[0];
    const stateStr = parts[1].toLowerCase();
    const state = ['device', 'offline', 'unauthorized', 'recovery'].includes(stateStr)
      ? (stateStr as AdbDeviceOutput['state'])
      : 'unknown';

    const info: AdbDeviceOutput = { id, state };

    for (let i = 2; i < parts.length; i++) {
      const colonIdx = parts[i].indexOf(':');
      if (colonIdx > 0) {
        const key = parts[i].slice(0, colonIdx);
        const val = parts[i].slice(colonIdx + 1);
        if (key === 'model') info.model = val;
        if (key === 'product') info.product = val;
        if (key === 'device') info.device = val;
        if (key === 'transport_id') info.transportId = val;
      }
    }

    devices.push(info);
  }

  return devices;
}

/**
 * Parses `adb shell getprop` output (`[ro.product.model]: [Pixel 8]`) into key-value map.
 */
export function parseGetPropOutput(output: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*\[([^\]]+)\]:\s*\[([^\]]*)\]\s*$/);
    if (match) {
      props[match[1].trim()] = match[2].trim();
    }
  }
  return props;
}

/**
 * Parses `adb shell pm list packages` or `pm list packages -f` output.
 */
export function parsePmListPackagesOutput(
  output: string
): Array<{ packageName: string; apkPath?: string; isSystem: boolean }> {
  const result: Array<{ packageName: string; apkPath?: string; isSystem: boolean }> = [];
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('package:')) continue;
    const body = line.slice('package:'.length);
    const eqIdx = body.lastIndexOf('=');
    if (eqIdx > 0) {
      const apkPath = body.slice(0, eqIdx).trim();
      const packageName = body.slice(eqIdx + 1).trim();
      const isSystem =
        apkPath.startsWith('/system/') ||
        apkPath.startsWith('/product/') ||
        apkPath.startsWith('/vendor/') ||
        apkPath.startsWith('/apex/') ||
        apkPath.startsWith('/system_ext/');
      result.push({ packageName, apkPath, isSystem });
    } else if (body) {
      result.push({ packageName: body, isSystem: false });
    }
  }
  return result;
}

/**
 * Parses `adb shell pm path <package>` output (`package:/system/priv-app/.../base.apk`) into APK paths.
 */
export function parsePmPathOutput(output: string): string[] {
  const paths: string[] = [];
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('package:')) continue;
    const apkPath = line.slice('package:'.length).trim();
    if (apkPath) paths.push(apkPath);
  }
  return paths;
}

/**
 * Extracts key hardware and OS identity fields from parsed `adb shell getprop` output.
 */
export function extractGetPropHighlights(props: Record<string, string>) {
  const qemuVal = props['ro.kernel.qemu'] || props['ro.boot.qemu'];
  return {
    model: props['ro.product.model'] || undefined,
    manufacturer: props['ro.product.manufacturer'] || undefined,
    brand: props['ro.product.brand'] || undefined,
    androidRelease: props['ro.build.version.release'] || undefined,
    apiLevel: props['ro.build.version.sdk'] || undefined,
    abi: props['ro.product.cpu.abi'] || undefined,
    fingerprint: props['ro.build.fingerprint'] || undefined,
    bootCompleted: props['sys.boot_completed'] || undefined,
    isEmulator: qemuVal === '1' ? true : Object.keys(props).length > 0 ? false : undefined,
  };
}

/**
 * Parses `emulator -list-avds` output into AVD names.
 */
export function parseEmulatorAvdList(output: string): string[] {
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('INFO') && !l.startsWith('WARNING') && !l.startsWith('ERROR'));
}

/**
 * Determines whether an AVD system image tag genuinely includes Google Play Store (`google_apis_playstore`).
 * Note: `google_apis` has Play Services/APIs WITHOUT Google Play Store; only `google_apis_playstore` includes certified Play Store.
 */
export function isGenuinePlayStoreTag(tagOrTarget: string): boolean {
  const lower = tagOrTarget.toLowerCase();
  return lower.includes('google_apis_playstore') || lower.includes('google play');
}

/**
 * Parses `avdmanager list avd` output into structured EmulatorAvdInfo entries.
 */
export function parseAvdManagerListOutput(output: string): EmulatorAvdInfo[] {
  const avds: EmulatorAvdInfo[] = [];
  let current: Partial<EmulatorAvdInfo> | null = null;

  const commitCurrent = () => {
    if (current && current.name) {
      const combined = `${current.target || ''} ${current.tagAbi || ''} ${current.basedOn || ''}`;
      const apiMatch = combined.match(/API level\s+(\d+)|android-(\d+)/i);
      const apiLevel = apiMatch ? parseInt(apiMatch[1] || apiMatch[2], 10) : undefined;
      avds.push({
        name: current.name,
        device: current.device,
        path: current.path,
        target: current.target,
        basedOn: current.basedOn,
        tagAbi: current.tagAbi,
        hasGooglePlay: isGenuinePlayStoreTag(combined),
        apiLevel,
      });
    }
  };

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('Available Android Virtual Devices:') || line.startsWith('---')) {
      if (line.startsWith('---')) {
        commitCurrent();
        current = null;
      }
      continue;
    }
    if (line.startsWith('The following Android Virtual Devices could not be loaded:')) {
      break;
    }

    const nameMatch = line.match(/^Name:\s*(.+)$/);
    if (nameMatch) {
      commitCurrent();
      current = { name: nameMatch[1].trim() };
      continue;
    }
    if (!current) continue;

    if (line.startsWith('Device:')) current.device = line.slice('Device:'.length).trim();
    else if (line.startsWith('Path:')) current.path = line.slice('Path:'.length).trim();
    else if (line.startsWith('Target:')) current.target = line.slice('Target:'.length).trim();
    else if (line.startsWith('Based on:')) current.basedOn = line.slice('Based on:'.length).trim();
    else if (line.startsWith('Tag/ABI:')) current.tagAbi = line.slice('Tag/ABI:'.length).trim();
  }
  commitCurrent();
  return avds;
}

/**
 * Parses `adb shell cat /proc/meminfo` output.
 */
export function parseProcMemInfo(output: string): { totalMb: number; availableMb: number; usedPercent: number } {
  const totalMatch = output.match(/MemTotal:\s+(\d+)\s+kB/i);
  const availMatch = output.match(/MemAvailable:\s+(\d+)\s+kB/i) || output.match(/MemFree:\s+(\d+)\s+kB/i);
  const totalKb = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  const availKb = availMatch ? parseInt(availMatch[1], 10) : 0;
  const totalMb = Math.round(totalKb / 1024);
  const availableMb = Math.round(availKb / 1024);
  const usedPercent = totalKb > 0 ? Math.max(0, Math.min(100, Math.round(((totalKb - availKb) / totalKb) * 100))) : 0;
  return { totalMb, availableMb, usedPercent };
}

/**
 * Parses `adb shell dumpsys battery` output.
 */
export function parseDumpsysBattery(output: string): { level: number; temperatureC: number; isCharging: boolean } {
  const levelMatch = output.match(/level:\s*(\d+)/i);
  const tempMatch = output.match(/temperature:\s*(\d+)/i);
  const acPowered = /AC powered:\s*true/i.test(output);
  const usbPowered = /USB powered:\s*true/i.test(output);
  const wirelessPowered = /Wireless powered:\s*true/i.test(output);

  return {
    level: levelMatch ? parseInt(levelMatch[1], 10) : 0,
    temperatureC: tempMatch ? Math.round((parseInt(tempMatch[1], 10) / 10) * 10) / 10 : 0,
    isCharging: acPowered || usbPowered || wirelessPowered,
  };
}

/**
 * Parses `adb shell dumpsys cpuinfo` output to extract real overall CPU percentage.
 */
export function parseDumpsysCpuInfo(output: string): number {
  const totalMatch = output.match(/([\d.]+)%\s+TOTAL:/i);
  if (totalMatch) {
    const val = Math.round(parseFloat(totalMatch[1]));
    return Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0;
  }
  return 0;
}

/**
 * Parses `adb shell wm size` and `wm density` outputs.
 */
export function parseWmDisplay(sizeOutput: string, densityOutput: string): DeviceResolution | null {
  const sizeMatch = sizeOutput.match(/(?:Override|Physical)\s+size:\s*(\d+)x(\d+)/i);
  const densityMatch = densityOutput.match(/(?:Override|Physical)\s+density:\s*(\d+)/i);
  if (!sizeMatch) return null;
  return {
    width: parseInt(sizeMatch[1], 10),
    height: parseInt(sizeMatch[2], 10),
    densityDpi: densityMatch ? parseInt(densityMatch[1], 10) : 420,
  };
}

/**
 * Parses `adb shell ls -la <dir>` output into DeviceFileItem records.
 */
export function parseAdbLsOutput(output: string, basePath: string): DeviceFileItem[] {
  const cleanBase = basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  const items: DeviceFileItem[] = [];

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('total ')) continue;

    // Example toybox ls -la:
    // drwxrwx--x 11 root sdcard_rw 4096 2026-11-01 12:00 Download
    // -rw-rw---- 1 u0_a12 media_rw 15420 2026-11-10 14:10 file name.json
    const match = line.match(
      /^([dlbcsp-][rwxstST-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/
    );
    if (!match) continue;

    const [, permissions, owner, group, sizeStr, modifiedAt, rawName] = match;
    const isSymlink = permissions.startsWith('l');
    const namePart = isSymlink && rawName.includes(' -> ') ? rawName.split(' -> ')[0] : rawName;
    const name = namePart.trim();
    if (name === '.' || name === '..') continue;

    const isDirectory = permissions.startsWith('d') || isSymlink;
    items.push({
      name,
      path: `${cleanBase}/${name}` || `/${name}`,
      isDirectory,
      sizeBytes: parseInt(sizeStr, 10) || 0,
      permissions,
      owner,
      group,
      modifiedAt,
    });
  }

  return items;
}

/**
 * Parses `adb logcat -d -v time` lines into structured LogEntry items.
 */
export function parseLogcatOutput(output: string, deviceId?: string): LogEntry[] {
  const entries: LogEntry[] = [];
  let idx = 0;

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('--------- beginning of')) continue;

    // Standard `-v time` format: MM-DD HH:MM:SS.mmm V/Tag( 1234): message
    const match = line.match(/^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+([VDIWEF])\/([^(]+)\(\s*(\d+)\):\s*(.*)$/);
    if (match) {
      const [, ts, lvl, tag, pidStr, message] = match;
      const normalizedLevel: LogEntry['level'] =
        lvl === 'F' ? 'E' : (['V', 'D', 'I', 'W', 'E'].includes(lvl) ? (lvl as LogEntry['level']) : 'I');
      entries.push({
        id: `logcat-${Date.now()}-${idx++}`,
        timestamp: ts,
        deviceId,
        level: normalizedLevel,
        tag: tag.trim(),
        pid: parseInt(pidStr, 10),
        message,
      });
    } else {
      entries.push({
        id: `logcat-${Date.now()}-${idx++}`,
        timestamp: new Date().toISOString(),
        deviceId,
        level: 'I',
        tag: 'logcat',
        message: line,
      });
    }
  }
  return entries;
}

/**
 * Filters devices in real-time by search query (matching name, status, Android version, or model)
 * and optional status, manufacturer, or node filters.
 */
export function filterDevices<
  T extends {
    name: string;
    status: string;
    androidVersion: string;
    model?: string;
    manufacturer?: string;
    nodeId?: string;
  }
>(
  devices: T[],
  query: string,
  statusFilter: string = 'all',
  manufacturerFilter: string = 'all',
  nodeFilter: string = 'all'
): T[] {
  const q = query.trim().toLowerCase();
  return devices.filter((d) => {
    const matchesStatus =
      statusFilter === 'all' || d.status.toLowerCase() === statusFilter.toLowerCase();
    if (!matchesStatus) return false;

    const matchesManufacturer =
      manufacturerFilter === 'all' ||
      (d.manufacturer && d.manufacturer.toLowerCase() === manufacturerFilter.toLowerCase());
    if (!matchesManufacturer) return false;

    const matchesNode =
      nodeFilter === 'all' || (d.nodeId && d.nodeId.toLowerCase() === nodeFilter.toLowerCase());
    if (!matchesNode) return false;

    if (!q) return true;

    return (
      d.name.toLowerCase().includes(q) ||
      d.status.toLowerCase().includes(q) ||
      d.androidVersion.toLowerCase().includes(q) ||
      (d.model && d.model.toLowerCase().includes(q)) ||
      (d.manufacturer && d.manufacturer.toLowerCase().includes(q))
    );
  });
}

/**
 * Paginates an array of items for high-performance rendering of 100+ items
 */
export function paginateItems<T>(items: T[], page: number, pageSize: number): {
  items: T[];
  total: number;
  totalPages: number;
  currentPage: number;
} {
  const safePage = Math.max(1, page);
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = (safePage - 1) * pageSize;
  const paginated = items.slice(startIndex, startIndex + pageSize);

  return {
    items: paginated,
    total,
    totalPages,
    currentPage: safePage,
  };
}

/**
 * Resource Capacity Calculator
 * Determines the safe maximum number of concurrent emulators a host can support
 * based on total RAM, free RAM, and CPU headroom to protect host stability.
 */
export interface CapacityCalculationResult {
  safeMaxConcurrent: number;
  availableSlots: number;
  memoryConstrained: boolean;
  cpuConstrained: boolean;
  recommendedPerDeviceRamMb: number;
  warningMessage?: string;
}

export function calculateSafeCapacity(
  totalRamMb: number,
  freeRamMb: number,
  cpuCores: number = 8,
  currentRunningCount: number = 0,
  perDeviceRamMb: number = 2048,
  reservedHostRamMb: number = 3072
): CapacityCalculationResult {
  const usableTotalRam = Math.max(0, totalRamMb - reservedHostRamMb);
  const maxByTotalRam = Math.floor(usableTotalRam / perDeviceRamMb);

  const usableFreeRam = Math.max(0, freeRamMb - 1024);
  const maxByFreeRam = currentRunningCount + Math.floor(usableFreeRam / perDeviceRamMb);

  const maxByCpu = Math.max(1, Math.floor(cpuCores * 1.5));

  const safeMaxConcurrent = Math.max(1, Math.min(maxByTotalRam, maxByCpu));
  const availableSlots = Math.max(0, safeMaxConcurrent - currentRunningCount);

  const memoryConstrained = freeRamMb < 2048 || maxByFreeRam <= currentRunningCount;
  const cpuConstrained = currentRunningCount >= cpuCores;

  let warningMessage: string | undefined;
  if (availableSlots <= 0) {
    warningMessage = `Host capacity threshold reached (${currentRunningCount}/${safeMaxConcurrent} AVDs running). Starting more emulators may exhaust host RAM.`;
  } else if (memoryConstrained) {
    warningMessage = `Low host memory available (${Math.round(freeRamMb)}MB free). Safe capacity is restricted.`;
  }

  return {
    safeMaxConcurrent,
    availableSlots,
    memoryConstrained,
    cpuConstrained,
    recommendedPerDeviceRamMb: perDeviceRamMb,
    warningMessage,
  };
}

/**
 * Checks whether an Android system image profile supports Google Play Store
 */
export function checkGooglePlayEligibility(
  _androidVersion: string,
  apiLevel: number,
  abi: string
): boolean {
  return apiLevel >= 24 && (abi === 'x86_64' || abi === 'arm64-v8a');
}
