/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Full Stack Desktop Application Server (100% Real ADB & Emulator Engine)
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import { db, VirtualDevice, LabTask, TestExecutionReport } from './src/server/db.js';
import { adbService } from './src/server/adb_service.js';
import {
  GeminiApiHttpError,
  runLabChatTurn,
  runWebGroundedSearch,
} from './src/server/gemini_service.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const MEDIA_DIR = path.resolve(process.cwd(), 'media');
const PULL_DIR = path.resolve(process.cwd(), 'uploads', 'pulled');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
if (!fs.existsSync(PULL_DIR)) fs.mkdirSync(PULL_DIR, { recursive: true });

app.use('/media', express.static(MEDIA_DIR));

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 250 * 1024 * 1024 },
});

// ==========================================
// API ROUTES (REAL ADB & EMULATOR ONLY)
// ==========================================

// 1. System Status, Diagnostics & ADB Health
app.get('/api/status', async (_req, res) => {
  const devices = db.getDevices();
  const running = devices.filter((d) => d.status === 'running');
  const stopped = devices.filter((d) => d.status === 'stopped' || d.status === 'offline');
  const error = devices.filter((d) => d.status === 'error' || d.status === 'unauthorized');
  const tasks = db.getTasks();
  const activeTasks = tasks.filter((t) => t.status === 'running');
  const adbStatus = adbService.getStatus();

  let diagnostics = adbService.getDiagnostics();
  if (!diagnostics) {
    const detected = await adbService.detectSdk();
    diagnostics = detected.diagnostics;
  }

  const totalMem = Math.round(os.totalmem() / (1024 * 1024));
  const freeMem = Math.round(os.freemem() / (1024 * 1024));
  const usedMem = totalMem - freeMem;
  const ramUsagePercent = Math.round((usedMem / totalMem) * 100);

  const avgCpu =
    running.length > 0
      ? Math.round(running.reduce((acc, d) => acc + (d.cpuUsage || 0), 0) / running.length)
      : 0;
  const avgRam =
    running.length > 0
      ? Math.round(running.reduce((acc, d) => acc + (d.ramUsage || 0), 0) / running.length)
      : 0;

  const capacity = db.getCapacityStatus();
  const nodes = db.getNodes();

  res.json({
    appName: 'DYNOSHI ANDROID LAB',
    version: '3.0.0-RealADB',
    platform: os.platform(),
    arch: os.arch(),
    totalDevices: devices.length,
    runningDevices: running.length,
    stoppedDevices: stopped.length,
    errorDevices: error.length,
    activeTasks: activeTasks.length,
    hostMetrics: {
      totalMemMb: totalMem,
      usedMemMb: usedMem,
      freeMemMb: freeMem,
      ramUsagePercent,
      deviceAvgCpu: avgCpu,
      deviceAvgRam: avgRam,
    },
    capacity,
    nodesCount: nodes.length,
    adb: adbStatus,
    diagnostics,
    settings: db.getSettings(),
  });
});

// 2. SDK & Virtualization Diagnostics
app.get('/api/sdk/detect', async (req, res) => {
  const custom = req.query.customPath as string | undefined;
  const result = await adbService.detectSdk(custom);
  res.json(result);
});

app.get('/api/diagnostics', async (_req, res) => {
  const result = await adbService.detectSdk();
  res.json(result.diagnostics);
});

app.get('/api/avds', async (_req, res) => {
  const avds = await adbService.listAvailableAvds();
  const diagnostics = adbService.getDiagnostics() || (await adbService.detectSdk()).diagnostics;
  res.json({ avds, diagnostics });
});

// 3. Scan & TCP/IP Connect Real ADB Devices
app.get('/api/adb/scan', async (_req, res) => {
  const realDevices = await adbService.scanRealDevices();
  res.json({
    scannedCount: realDevices.length,
    devices: realDevices,
  });
});

app.post('/api/adb/connect', async (req, res) => {
  const endpoint = String(req.body?.endpoint || '').trim();
  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'Missing ADB host:port endpoint.' });
  }
  const result = await adbService.connectAdbEndpoint(endpoint);
  if (!result.success) {
    return res.status(502).json({
      success: false,
      error: result.stderr || result.output || `Failed to connect to ${endpoint}`,
      command: result.command,
      output: result.output,
      stderr: result.stderr,
      devices: result.devices,
    });
  }
  res.json(result);
});

app.post('/api/adb/disconnect', async (req, res) => {
  const endpoint = String(req.body?.endpoint || '').trim();
  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'Missing endpoint.' });
  }
  const result = await adbService.disconnectAdbEndpoint(endpoint);
  res.status(result.success ? 200 : 400).json(result);
});

// 4. Devices Registry CRUD
app.get('/api/devices', (_req, res) => {
  res.json(db.getDevices());
});

app.post('/api/devices', async (req, res) => {
  const body = req.body || {};
  const diagnostics = adbService.getDiagnostics() || (await adbService.detectSdk()).diagnostics;

  const avdName = typeof body.avdName === 'string' ? body.avdName.trim() : '';
  const adbSerial = typeof body.adbSerial === 'string' ? body.adbSerial.trim() : '';
  const matchedAvd = avdName
    ? diagnostics.availableAvds.find((a) => a.name === avdName)
    : undefined;

  let deviceCategory: VirtualDevice['deviceCategory'] = 'emulator_aosp';
  if (body.deviceCategory && ['physical', 'emulator_playstore', 'emulator_aosp', 'remote_agent', 'cloud_device'].includes(body.deviceCategory)) {
    deviceCategory = body.deviceCategory;
  } else if (matchedAvd?.hasGooglePlay) {
    deviceCategory = 'emulator_playstore';
  }

  const missingAvdNotice =
    !avdName && !adbSerial
      ? 'Profile created without a backing local Android AVD (`avdName`) or ADB serial. Configure an AVD via Android Studio (`avdmanager`) or attach a real device via `adb connect` to boot.'
      : undefined;

  const newDevice: VirtualDevice = {
    id: `dyn-dev-${Date.now().toString(36)}`,
    name: body.name?.trim() || avdName || adbSerial || `Android Device ${db.getDevices().length + 1}`,
    model: body.model || matchedAvd?.device || 'Unattached Profile',
    manufacturer: body.manufacturer || 'Android',
    androidVersion: body.androidVersion || (matchedAvd?.apiLevel ? `API ${matchedAvd.apiLevel}` : 'Unknown'),
    apiLevel: Number(body.apiLevel || matchedAvd?.apiLevel || 0),
    abi: body.abi || 'x86_64',
    resolution: body.resolution || { width: 1080, height: 2400, densityDpi: 420 },
    ramMb: Number(body.ramMb || 4096),
    storageMb: Number(body.storageMb || 16384),
    storageUsedMb: 0,
    status: missingAvdNotice ? 'error' : 'stopped',
    orientation: body.orientation || 'portrait',
    batteryLevel: 0,
    isCharging: false,
    networkType: 'Unknown',
    wifiSsid: '',
    ipAddress: adbSerial && adbSerial.includes(':') ? adbSerial.split(':')[0] : '',
    isRealAdbDevice: Boolean(adbSerial),
    adbSerial: adbSerial || undefined,
    avdName: avdName || undefined,
    connectionType: adbSerial ? (adbSerial.includes(':') ? 'tcpip' : 'usb') : 'emulator',
    cpuUsage: 0,
    ramUsage: 0,
    temperatureC: 0,
    screenUnlocked: false,
    volumeLevel: 70,
    uptimeSeconds: 0,
    createdAt: new Date().toISOString(),
    lastError: missingAvdNotice,
    nodeId: body.nodeId || 'node-local',
    deviceCategory,
    googlePlay: {
      supported: Boolean(matchedAvd?.hasGooglePlay),
      playStoreInstalled: false,
      youtubeInstalled: false,
      chromeInstalled: false,
      certified: false,
      protectStatus: 'unavailable',
    },
    sessionState: {
      backgroundTasksCount: 0,
      lastInteractedAt: new Date().toISOString(),
      keepAliveInBackground: true,
    },
  };

  db.addDevice(newDevice);
  db.addLog({
    deviceId: newDevice.id,
    level: missingAvdNotice ? 'W' : 'I',
    tag: 'DeviceManager',
    message: missingAvdNotice
      ? `Registered unlinked device profile ${newDevice.name}: ${missingAvdNotice}`
      : `Registered real device profile: ${newDevice.name} (AVD: ${newDevice.avdName || 'N/A'}, Serial: ${newDevice.adbSerial || 'N/A'})`,
  });

  res.status(201).json(newDevice);
});

app.put('/api/devices/:id', (req, res) => {
  const updated = db.updateDevice(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Device not found' });
  res.json(updated);
});

app.delete('/api/devices/:id', async (req, res) => {
  const dev = db.getDevice(req.params.id);
  if (dev && dev.status === 'running') {
    await adbService.stopDevice(dev.id);
  }
  const success = db.deleteDevice(req.params.id);
  if (!success) return res.status(404).json({ error: 'Device not found' });
  db.addLog({
    level: 'W',
    tag: 'DeviceManager',
    message: `Device removed from registry: ${req.params.id}`,
  });
  res.json({ success: true, id: req.params.id });
});

app.post('/api/devices/:id/clone', (req, res) => {
  const source = db.getDevice(req.params.id);
  if (!source) return res.status(404).json({ error: 'Source device not found' });

  const clone: VirtualDevice = {
    ...source,
    id: `dyn-dev-${Date.now().toString(36)}`,
    name: `${source.name} (Clone)`,
    status: 'stopped',
    adbSerial: undefined,
    emulatorPort: undefined,
    emulatorPid: undefined,
    isRealAdbDevice: false,
    uptimeSeconds: 0,
    cpuUsage: 0,
    ramUsage: 0,
    verificationReport: undefined,
    createdAt: new Date().toISOString(),
  };

  db.addDevice(clone);
  db.addLog({
    deviceId: clone.id,
    level: 'I',
    tag: 'DeviceManager',
    message: `Cloned device configuration from ${source.id} -> ${clone.id}`,
  });

  res.status(201).json(clone);
});

// Device Control: Start, Stop, Restart (100% Real Emulator / ADB)
app.post('/api/devices/:id/start', async (req, res) => {
  const dev = db.getDevice(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const capacity = db.getCapacityStatus();
  const force = req.body?.force === true;
  if (capacity.availableSlots <= 0 && !force) {
    return res.status(429).json({
      error: 'Host Capacity Limit Reached',
      message: `Safe concurrent capacity limit reached (${capacity.currentlyRunningDevices}/${capacity.safeMaxConcurrentDevices} active).`,
      capacity,
      requiresOverride: true,
    });
  }

  const task: LabTask = {
    id: `task-boot-${Date.now()}`,
    title: `Boot Real Device/AVD: ${dev.name}`,
    type: 'boot',
    targetDeviceIds: [dev.id],
    status: 'running',
    progress: 20,
    startedAt: new Date().toISOString(),
  };
  db.addTask(task);

  const result = await adbService.startDevice(dev.id);
  if (!result.success) {
    db.updateTask(task.id, {
      status: 'failed',
      progress: 0,
      completedAt: new Date().toISOString(),
      error: result.error || result.message,
    });
    return res.status(503).json({
      success: false,
      error: result.error || result.message,
      message: result.message,
      deviceId: dev.id,
    });
  }

  db.updateTask(task.id, {
    status: 'completed',
    progress: 100,
    completedAt: new Date().toISOString(),
  });
  res.json({ success: true, message: result.message, deviceId: dev.id });
});

app.post('/api/devices/:id/stop', async (req, res) => {
  const dev = db.getDevice(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const result = await adbService.stopDevice(dev.id);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.message, deviceId: dev.id });
  }
  res.json({ success: true, message: result.message, deviceId: dev.id });
});

app.post('/api/devices/:id/restart', async (req, res) => {
  const dev = db.getDevice(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  if (dev.adbSerial) {
    const rebootRes = await adbService.executeCommand(dev.id, 'reboot');
    if (!rebootRes.success) {
      return res.status(500).json({
        success: false,
        error: rebootRes.stderr || 'adb reboot failed',
        deviceId: dev.id,
      });
    }
    db.updateDevice(dev.id, { status: 'booting', uptimeSeconds: 0 });
    return res.json({ success: true, message: `Sent adb reboot to ${dev.adbSerial}`, deviceId: dev.id });
  }

  await adbService.stopDevice(dev.id);
  const startRes = await adbService.startDevice(dev.id);
  if (!startRes.success) {
    return res.status(503).json({ success: false, error: startRes.error || startRes.message });
  }
  res.json({ success: true, message: startRes.message, deviceId: dev.id });
});

// Live Framebuffer PNG Stream (`adb exec-out screencap -p`)
app.get('/api/devices/:id/screen', async (req, res) => {
  const result = await adbService.captureScreenPng(req.params.id);
  if (!result.success || !result.buffer) {
    return res.status(503).json({
      success: false,
      error: result.error || 'Unable to capture live Android framebuffer.',
      command: result.command,
    });
  }
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Dynoshi-Capture-Ms', String(result.durationMs));
  res.send(result.buffer);
});

// Real Rotation via Android settings
app.post('/api/devices/:id/rotate', async (req, res) => {
  const dev = db.getDevice(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const newOrientation = dev.orientation === 'portrait' ? 'landscape' : 'portrait';
  const rotVal = newOrientation === 'landscape' ? 1 : 0;

  if (!dev.adbSerial) {
    return res.status(400).json({ error: 'Device is not attached to a live ADB serial.' });
  }

  await adbService.executeCommand(dev.id, 'shell settings put system accelerometer_rotation 0');
  const rotRes = await adbService.executeCommand(
    dev.id,
    `shell settings put system user_rotation ${rotVal}`
  );
  if (!rotRes.success) {
    return res.status(500).json({ error: rotRes.stderr || 'Failed to set device rotation via ADB' });
  }

  db.updateDevice(dev.id, { orientation: newOrientation });
  res.json({ orientation: newOrientation });
});

// Interactive Input (Real ADB input tap/swipe/keyevent/text)
app.post('/api/devices/:id/input', async (req, res) => {
  const { type, params } = req.body;
  if (!type) return res.status(400).json({ error: 'Missing input type' });

  try {
    const result = await adbService.sendInput(req.params.id, type, params || {});
    if (!result.success) {
      return res.status(400).json({ error: result.stderr || 'ADB input command failed', ...result });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Direct ADB Shell Execution
app.post('/api/devices/:id/shell', async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Missing command' });
  const result = await adbService.executeCommand(req.params.id, command);
  res.status(result.success ? 200 : 400).json(result);
});

// Open URL on Real Android Browser
app.post('/api/devices/:id/open-url', async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Missing URL' });
  const result = await adbService.openUrl(req.params.id, url);
  if (!result.success) {
    return res.status(400).json({ error: result.stderr || result.output || 'Failed to open URL', ...result });
  }
  res.json(result);
});

// Mandatory Technical Verification Panel Runner
app.post('/api/devices/:id/verify', async (req, res) => {
  const dev = db.getDevice(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const task: LabTask = {
    id: `task-verify-${Date.now()}`,
    title: `Technical ADB Verification: ${dev.name}`,
    type: 'verification',
    targetDeviceIds: [dev.id],
    status: 'running',
    progress: 30,
    startedAt: new Date().toISOString(),
  };
  db.addTask(task);

  const report = await adbService.verifyDevice(dev.id);
  db.updateTask(task.id, {
    status: report.overallPassed ? 'completed' : 'failed',
    progress: 100,
    completedAt: new Date().toISOString(),
    error: report.overallPassed ? undefined : 'One or more ADB verification checks failed.',
  });

  db.addLog({
    deviceId: dev.id,
    level: report.overallPassed ? 'I' : 'W',
    tag: 'TechnicalVerify',
    message: `Verification ${report.overallPassed ? 'PASSED' : 'FAILED'} for ${dev.name} (${report.adbSerial}). Play Store: ${report.hasPlayStore}, YouTube: ${report.hasYouTube}.`,
  });

  res.json(report);
});

// Real-Time Live Device Control Diagnostics (`adb devices -l`, `getprop`, Play Store & YouTube checks)
app.get('/api/adb/diagnostics', async (req, res) => {
  const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : null;
  const result = await adbService.getLiveDeviceDiagnostics(deviceId);
  res.json(result);
});

app.get('/api/adb/diagnostics/step', async (req, res) => {
  const stepRaw = String(req.query.step || '').trim();
  if (!['devices', 'getprop', 'playstore', 'youtube'].includes(stepRaw)) {
    return res.status(400).json({ error: 'Invalid diagnostic step. Expected devices|getprop|playstore|youtube.' });
  }
  const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : null;
  const result = await adbService.runLiveDiagnosticStep(
    stepRaw as 'devices' | 'getprop' | 'playstore' | 'youtube',
    deviceId
  );
  res.json(result);
});

// Server-Side Gemini Chatbot & Google Search Grounding API
app.post('/api/ai/chat', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runLabChatTurn({
      history: body.history,
      message: body.message,
      model: body.model,
      useSearchGrounding: body.useSearchGrounding,
      deviceContext: body.deviceContext,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof GeminiApiHttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI chat request failed.' });
  }
});

app.post('/api/ai/search', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runWebGroundedSearch(String(body.query || ''), body.deviceContext);
    res.json(result);
  } catch (err) {
    if (err instanceof GeminiApiHttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Google Search grounding request failed.' });
  }
});

// 5. Real Application & Package Management
app.get('/api/devices/:id/apps', async (req, res) => {
  if (req.query.refresh === 'true') {
    await adbService.scanRealDevices();
  }
  res.json(db.getAppsForDevice(req.params.id));
});

app.post('/api/devices/:id/apps/launch', async (req, res) => {
  const { packageName } = req.body;
  const dev = db.getDevice(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const result = await adbService.launchApp(dev.id, packageName);
  if (!result.success) {
    return res.status(400).json({
      ...result,
      success: false,
      error: result.stderr || result.output || `Failed to launch ${packageName}`,
    });
  }
  res.json({ success: true, activeAppPackage: packageName, output: result.output });
});

app.post('/api/devices/:id/apps/stop', async (req, res) => {
  const { packageName } = req.body;
  const result = await adbService.forceStopApp(req.params.id, packageName);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.stderr || 'Force-stop failed' });
  }
  res.json({ success: true, output: result.output });
});

app.post('/api/devices/:id/apps/clear', async (req, res) => {
  const { packageName } = req.body;
  const result = await adbService.clearAppData(req.params.id, packageName);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.stderr || 'pm clear failed' });
  }
  res.json({ success: true, message: `Cleared data for ${packageName}: ${result.output}` });
});

app.post('/api/devices/:id/apps/uninstall', async (req, res) => {
  const { packageName } = req.body;
  const result = await adbService.uninstallApp(req.params.id, packageName);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.stderr || 'adb uninstall failed' });
  }
  res.json({ success: true, output: result.output });
});

app.post('/api/devices/:id/install', upload.single('apk'), async (req, res) => {
  const deviceId = req.params.id;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No APK file uploaded' });

  const appName = req.body.appName || path.basename(file.originalname, '.apk');
  const task: LabTask = {
    id: `task-install-${Date.now()}`,
    title: `adb install -r ${appName}`,
    type: 'install_apk',
    targetDeviceIds: [deviceId],
    status: 'running',
    progress: 30,
    startedAt: new Date().toISOString(),
  };
  db.addTask(task);

  try {
    const installRes = await adbService.installApk(deviceId, file.path);
    try {
      fs.unlinkSync(file.path);
    } catch {}
    if (!installRes.success) {
      db.updateTask(task.id, {
        status: 'failed',
        progress: 0,
        completedAt: new Date().toISOString(),
        error: installRes.message,
      });
      return res.status(400).json({ ...installRes, success: false, error: installRes.message });
    }
    db.updateTask(task.id, { status: 'completed', progress: 100, completedAt: new Date().toISOString() });
    res.json(installRes);
  } catch (err: any) {
    db.updateTask(task.id, { status: 'failed', error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/batch/install', upload.single('apk'), async (req, res) => {
  const file = req.file;
  const deviceIdsRaw = req.body.deviceIds;
  const deviceIds: string[] = typeof deviceIdsRaw === 'string' ? JSON.parse(deviceIdsRaw) : deviceIdsRaw || [];

  if (!file || deviceIds.length === 0) {
    return res.status(400).json({ error: 'Missing file or target device list' });
  }

  const appName = req.body.appName || path.basename(file.originalname, '.apk');
  const task: LabTask = {
    id: `task-batch-install-${Date.now()}`,
    title: `Batch adb install ${appName} on ${deviceIds.length} devices`,
    type: 'batch_action',
    targetDeviceIds: deviceIds,
    status: 'running',
    progress: 10,
    startedAt: new Date().toISOString(),
  };
  db.addTask(task);

  const results: Array<{ deviceId: string; success: boolean; message: string }> = [];
  for (let i = 0; i < deviceIds.length; i++) {
    const devId = deviceIds[i];
    const r = await adbService.installApk(devId, file.path);
    results.push({ deviceId: devId, success: r.success, message: r.message });
    db.updateTask(task.id, { progress: Math.round(((i + 1) / deviceIds.length) * 100) });
  }
  try {
    fs.unlinkSync(file.path);
  } catch {}

  const anySuccess = results.some((r) => r.success);
  db.updateTask(task.id, {
    status: anySuccess ? 'completed' : 'failed',
    completedAt: new Date().toISOString(),
    error: anySuccess ? undefined : results[0]?.message,
  });
  res.status(anySuccess ? 200 : 400).json({
    success: anySuccess,
    installedCount: results.filter((r) => r.success).length,
    results,
  });
});

// 6. Real Device File Explorer (ADB ls / push / pull)
app.get('/api/devices/:id/files', async (req, res) => {
  const targetPath = (req.query.path as string) || '/sdcard';
  const listRes = await adbService.listFiles(req.params.id, targetPath);
  if (!listRes.success) {
    return res.status(400).json({
      currentPath: targetPath,
      items: [],
      error: listRes.error || 'Failed to list files via ADB.',
    });
  }
  res.json({ currentPath: targetPath, items: listRes.items });
});

app.post('/api/devices/:id/files/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const targetDir = String(req.body.targetDir || '/sdcard/Download').replace(/\/+$/, '');
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const remotePath = `${targetDir}/${file.originalname}`;
  const pushRes = await adbService.pushFile(req.params.id, file.path, remotePath);
  try {
    fs.unlinkSync(file.path);
  } catch {}

  if (!pushRes.success) {
    return res.status(400).json({ success: false, error: pushRes.stderr || 'adb push failed' });
  }

  db.addLog({
    deviceId: req.params.id,
    level: 'I',
    tag: 'AdbPush',
    message: `Pushed ${file.originalname} -> ${remotePath}`,
  });

  res.json({
    success: true,
    fileName: file.originalname,
    targetPath: remotePath,
    sizeBytes: file.size,
  });
});

app.get('/api/devices/:id/files/download', async (req, res) => {
  const remotePath = String(req.query.path || '').trim();
  if (!remotePath) return res.status(400).json({ error: 'Missing remote file path' });

  const safeName = path.basename(remotePath).replace(/[^a-zA-Z0-9._-]/g, '_') || 'pulled_file';
  const localTmp = path.join(PULL_DIR, `${Date.now()}_${safeName}`);

  const pullRes = await adbService.pullFile(req.params.id, remotePath, localTmp);
  if (!pullRes.success || !fs.existsSync(localTmp)) {
    return res.status(400).json({
      success: false,
      error: pullRes.stderr || pullRes.output || 'adb pull failed',
    });
  }

  res.download(localTmp, safeName, () => {
    try {
      fs.unlinkSync(localTmp);
    } catch {}
  });
});

// 7. Automation Studio (Real ADB Step Execution)
app.get('/api/automation/workflows', (_req, res) => {
  res.json(db.getWorkflows());
});

app.post('/api/automation/workflows', (req, res) => {
  const body = req.body;
  const workflow = {
    id: body.id || `wf-${Date.now().toString(36)}`,
    name: body.name || 'New Test Workflow',
    description: body.description || '',
    category: body.category || 'Custom',
    steps: body.steps || [],
    targetDeviceIds: body.targetDeviceIds || [],
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunAt: body.lastRunAt,
    lastRunStatus: body.lastRunStatus,
  };
  db.saveWorkflow(workflow);
  res.json(workflow);
});

app.delete('/api/automation/workflows/:id', (req, res) => {
  const success = db.deleteWorkflow(req.params.id);
  res.json({ success });
});

app.post('/api/automation/run', async (req, res) => {
  const { workflowId, deviceIds } = req.body;
  const workflow = db.getWorkflow(workflowId);
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

  const targets: string[] = deviceIds && deviceIds.length > 0 ? deviceIds : workflow.targetDeviceIds;
  if (targets.length === 0) {
    return res.status(400).json({ error: 'No target devices specified for automation run' });
  }

  const reports: TestExecutionReport[] = [];

  for (const devId of targets) {
    const dev = db.getDevice(devId);
    if (!dev) continue;

    const reportId = `rep-${Date.now()}-${devId.slice(-4)}`;
    const startTime = new Date().toISOString();
    const stepLogs: TestExecutionReport['stepLogs'] = [];
    let passedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepStart = Date.now();
      let stepOk = false;
      let logLine = '';

      if (step.type === 'wait') {
        const ms = Math.min(10000, Math.max(50, Number(step.params?.durationMs) || 1000));
        await new Promise((r) => setTimeout(r, ms));
        stepOk = true;
        logLine = `Waited ${ms}ms`;
      } else if (step.type === 'launch_app') {
        const r = await adbService.launchApp(devId, String(step.params?.packageName || ''));
        stepOk = r.success;
        logLine = r.success ? r.output || `Launched ${step.params?.packageName}` : r.stderr || 'Launch failed';
      } else if (step.type === 'close_app') {
        const r = await adbService.forceStopApp(devId, String(step.params?.packageName || ''));
        stepOk = r.success;
        logLine = r.success ? `Stopped ${step.params?.packageName}` : r.stderr || 'Force-stop failed';
      } else if (step.type === 'open_url') {
        const r = await adbService.openUrl(devId, String(step.params?.url || ''));
        stepOk = r.success;
        logLine = r.success ? `Opened URL ${step.params?.url}` : r.stderr || 'Open URL failed';
      } else if (step.type === 'tap_coords') {
        const r = await adbService.sendInput(devId, 'tap', step.params || {});
        stepOk = r.success;
        logLine = r.success ? r.command : r.stderr || 'Tap failed';
      } else if (step.type === 'swipe') {
        const r = await adbService.sendInput(devId, 'swipe', step.params || {});
        stepOk = r.success;
        logLine = r.success ? r.command : r.stderr || 'Swipe failed';
      } else if (step.type === 'press_key') {
        const r = await adbService.sendInput(devId, 'key', step.params || {});
        stepOk = r.success;
        logLine = r.success ? r.command : r.stderr || 'Keyevent failed';
      } else if (step.type === 'enter_text') {
        const r = await adbService.sendInput(devId, 'text', step.params || {});
        stepOk = r.success;
        logLine = r.success ? r.command : r.stderr || 'Text input failed';
      } else if (step.type === 'shell_cmd') {
        const r = await adbService.executeCommand(devId, String(step.params?.command || ''));
        stepOk = r.success;
        logLine = r.success ? r.output : r.stderr || 'Shell command failed';
      } else if (step.type === 'screenshot') {
        const cap = await adbService.captureScreenPng(devId);
        if (cap.success && cap.buffer) {
          const fileName = `auto_${dev.id}_${Date.now()}.png`;
          const filePath = path.join(MEDIA_DIR, fileName);
          fs.writeFileSync(filePath, cap.buffer);
          db.addMedia({
            id: `med-${Date.now()}`,
            deviceId: dev.id,
            deviceName: dev.name,
            type: 'screenshot',
            filePath,
            url: `/media/${fileName}`,
            capturedAt: new Date().toISOString(),
            resolution: `${dev.resolution.width}x${dev.resolution.height}`,
            fileSizeBytes: cap.buffer.length,
          });
          stepOk = true;
          logLine = `Captured real PNG framebuffer (${cap.buffer.length} bytes) -> /media/${fileName}`;
        } else {
          stepOk = false;
          logLine = cap.error || 'Screenshot capture failed';
        }
      } else {
        stepOk = false;
        logLine = `Unsupported or non-ADB step type: ${step.type}`;
      }

      const durationMs = Date.now() - stepStart;
      if (stepOk) passedCount++;
      else failedCount++;

      stepLogs.push({
        stepId: step.id,
        stepLabel: step.label,
        status: stepOk ? 'passed' : 'failed',
        durationMs,
        log: logLine,
      });
    }

    const overallStatus = failedCount === 0 ? 'passed' : 'failed';
    const rep: TestExecutionReport = {
      id: reportId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      deviceId: devId,
      deviceName: dev.name,
      status: overallStatus,
      startTime,
      endTime: new Date().toISOString(),
      durationMs: stepLogs.reduce((acc, s) => acc + s.durationMs, 0),
      totalSteps: workflow.steps.length,
      passedSteps: passedCount,
      failedSteps: failedCount,
      stepLogs,
    };

    db.addReport(rep);
    reports.push(rep);

    db.addLog({
      deviceId: devId,
      level: overallStatus === 'passed' ? 'I' : 'E',
      tag: 'AutomationRunner',
      message: `Workflow "${workflow.name}" finished on ${dev.name}: ${passedCount}/${workflow.steps.length} passed, ${failedCount} failed.`,
    });
  }

  const allPassed = reports.length > 0 && reports.every((r) => r.status === 'passed');
  db.saveWorkflow({
    ...workflow,
    lastRunAt: new Date().toISOString(),
    lastRunStatus: allPassed ? 'passed' : 'failed',
  });

  res.status(allPassed ? 200 : 400).json({
    success: allPassed,
    workflowId: workflow.id,
    targetCount: targets.length,
    reports,
  });
});

// 8. Real Screenshots & Media Center
app.get('/api/media', (_req, res) => {
  res.json(db.getMedia());
});

app.post('/api/media/screenshot', async (req, res) => {
  const { deviceId } = req.body;
  const dev = db.getDevice(deviceId);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const cap = await adbService.captureScreenPng(dev.id);
  if (!cap.success || !cap.buffer) {
    return res.status(503).json({
      error: cap.error || 'Failed to capture real device framebuffer via `adb exec-out screencap -p`.',
      command: cap.command,
    });
  }

  const fileName = `screenshot_${dev.id}_${Date.now()}.png`;
  const filePath = path.join(MEDIA_DIR, fileName);
  fs.writeFileSync(filePath, cap.buffer);

  const mediaItem = {
    id: `med-${Date.now()}`,
    deviceId: dev.id,
    deviceName: dev.name,
    type: 'screenshot' as const,
    filePath,
    url: `/media/${fileName}`,
    capturedAt: new Date().toISOString(),
    resolution: `${dev.resolution.width}x${dev.resolution.height}`,
    fileSizeBytes: cap.buffer.length,
  };

  db.addMedia(mediaItem);
  db.addLog({
    deviceId: dev.id,
    level: 'I',
    tag: 'ScreenCapture',
    message: `Saved genuine ADB PNG screenshot: ${fileName} (${cap.buffer.length} bytes)`,
  });

  res.json(mediaItem);
});

app.post('/api/devices/:id/record/start', async (req, res) => {
  const dev = db.getDevice(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const result = await adbService.startScreenRecord(dev.id);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  db.addLog({
    deviceId: dev.id,
    level: 'I',
    tag: 'ScreenRecord',
    message: `Started ADB screenrecord -> ${result.remotePath}`,
  });
  res.json({ success: true, remotePath: result.remotePath });
});

app.post('/api/devices/:id/record/stop', async (req, res) => {
  const dev = db.getDevice(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Device not found' });

  const result = await adbService.stopScreenRecord(dev.id, MEDIA_DIR);
  if (!result.success || !result.fileName || !result.filePath) {
    return res.status(400).json({ success: false, error: result.error || 'Screen recording stop failed' });
  }

  const mediaItem = {
    id: `med-${Date.now()}`,
    deviceId: dev.id,
    deviceName: dev.name,
    type: 'recording' as const,
    filePath: result.filePath,
    url: `/media/${result.fileName}`,
    capturedAt: new Date().toISOString(),
    resolution: `${dev.resolution.width}x${dev.resolution.height}`,
    fileSizeBytes: result.fileSizeBytes || 0,
  };

  db.addMedia(mediaItem);
  db.addLog({
    deviceId: dev.id,
    level: 'I',
    tag: 'ScreenRecord',
    message: `Saved genuine ADB MP4 screen recording: ${result.fileName} (${mediaItem.fileSizeBytes} bytes)`,
  });

  res.json({ success: true, media: mediaItem });
});

app.delete('/api/media/:id', (req, res) => {
  const success = db.deleteMedia(req.params.id);
  res.json({ success });
});

// 9. Device Profiles
app.get('/api/profiles', (_req, res) => {
  res.json(db.getProfiles());
});

app.post('/api/profiles', (req, res) => {
  const profile = {
    id: req.body.id || `prof-${Date.now()}`,
    name: req.body.name,
    category: req.body.category || 'Phone',
    model: req.body.model,
    manufacturer: req.body.manufacturer || 'Generic',
    androidVersion: req.body.androidVersion || 'Android 14',
    apiLevel: req.body.apiLevel || 34,
    resolution: req.body.resolution || { width: 1080, height: 2400, densityDpi: 420 },
    ramMb: req.body.ramMb || 4096,
    storageMb: req.body.storageMb || 16384,
    description: req.body.description || '',
    skin: req.body.skin || 'custom',
    hasGooglePlay: Boolean(req.body.hasGooglePlay),
    systemImagePackage: req.body.systemImagePackage,
  };
  db.addProfile(profile);
  res.status(201).json(profile);
});

app.delete('/api/profiles/:id', (req, res) => {
  const success = db.deleteProfile(req.params.id);
  res.json({ success });
});

// 10. Reports & Exports
app.get('/api/reports', (_req, res) => {
  res.json(db.getReports());
});

app.get('/api/reports/export', (req, res) => {
  const format = req.query.format || 'json';
  const reports = db.getReports();

  if (format === 'csv') {
    const headers = 'ID,Workflow,Device,Status,TotalSteps,PassedSteps,DurationMs,StartTime\n';
    const rows = reports.map(
      (r) =>
        `"${r.id}","${r.workflowName}","${r.deviceName}","${r.status}",${r.totalSteps},${r.passedSteps},${r.durationMs},"${r.startTime}"`
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dynoshi_test_reports.csv"');
    return res.send(headers + rows.join('\n'));
  }

  res.json(reports);
});

// 11. Tasks Queue
app.get('/api/tasks', (_req, res) => {
  res.json(db.getTasks());
});

app.post('/api/tasks/:id/cancel', (req, res) => {
  const updated = db.updateTask(req.params.id, { status: 'cancelled' });
  res.json({ success: !!updated, task: updated });
});

// 12. Logs & Real ADB Logcat
app.get('/api/logs', (req, res) => {
  const deviceId = req.query.deviceId as string | undefined;
  const level = req.query.level as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
  res.json(db.getLogs(limit, deviceId, level));
});

app.get('/api/devices/:id/logcat', async (req, res) => {
  const lines = req.query.lines ? parseInt(req.query.lines as string, 10) : 200;
  const result = await adbService.fetchDeviceLogcat(req.params.id, lines);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error || 'adb logcat failed', entries: [] });
  }
  res.json(result);
});

// 13. Settings
app.get('/api/settings', (_req, res) => {
  res.json(db.getSettings());
});

app.post('/api/settings', (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json(updated);
});

// 14. SQLite Dump Export
app.get('/api/sql/export', (_req, res) => {
  const sql = db.generateSqliteDump();
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="dynoshi_lab_sqlite_dump.sql"');
  res.send(sql);
});

// 15. Distributed Nodes Management (Real HTTP health probes to Remote DYNOSHI Host Agents)
app.get('/api/nodes', (_req, res) => {
  res.json(db.getNodes());
});

app.post('/api/nodes', async (req, res) => {
  const body = req.body || {};
  const host = String(body.host || '').trim();
  const port = body.port ? parseInt(body.port, 10) : 5055;
  if (!host) {
    return res.status(400).json({ error: 'Host/IP is required to register a remote node.' });
  }

  let status: 'online' | 'offline' = 'offline';
  let pingMs = 0;
  let lastError: string | undefined;
  let adbAvailable = false;
  let emulatorAvailable = false;
  let cpuUsagePercent = 0;
  let ramUsagePercent = 0;
  let activeDevices = 0;

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const healthRes = await fetch(`http://${host}:${port}/health`, {
      signal: controller.signal,
      headers: body.authToken ? { Authorization: `Bearer ${body.authToken}` } : undefined,
    });
    clearTimeout(timer);
    pingMs = Date.now() - start;
    if (healthRes.ok) {
      const data: any = await healthRes.json();
      status = 'online';
      adbAvailable = Boolean(data.adbAvailable);
      emulatorAvailable = Boolean(data.emulatorAvailable);
      cpuUsagePercent = Number(data.cpuUsagePercent || 0);
      ramUsagePercent = Number(data.ramUsagePercent || 0);
      activeDevices = Number(data.activeDevices || 0);
    } else {
      lastError = `Remote agent returned HTTP ${healthRes.status}`;
    }
  } catch (err: any) {
    pingMs = Date.now() - start;
    lastError = `Unreachable (${err.name === 'AbortError' ? 'Timeout 3000ms' : err.message}). Run scripts/dynoshi_node_agent.ts on ${host}:${port}.`;
  }

  const newNode = {
    id: body.id || `node-${Date.now().toString(36)}`,
    name: body.name || `Remote Node (${host})`,
    type: body.type || ('remote_agent' as const),
    host,
    port,
    status,
    activeDevices,
    maxCapacity: body.maxCapacity ? parseInt(body.maxCapacity, 10) : 8,
    cpuUsagePercent,
    ramUsagePercent,
    pingMs,
    authToken: body.authToken,
    registeredAt: new Date().toISOString(),
    location: body.location || 'Remote Host Agent',
    lastError,
    adbAvailable,
    emulatorAvailable,
  };

  db.addNode(newNode);
  db.addLog({
    level: status === 'online' ? 'I' : 'W',
    tag: 'NodeManager',
    message:
      status === 'online'
        ? `Connected real Host Agent ${newNode.name} (${host}:${port}, ${pingMs}ms)`
        : `Registered Host Agent ${newNode.name} (${host}:${port}) as OFFLINE: ${lastError}`,
  });

  res.status(201).json(newNode);
});

app.post('/api/nodes/:id/probe', async (req, res) => {
  const node = db.getNodes().find((n) => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  if (node.id === 'node-local') return res.json(node);

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const healthRes = await fetch(`http://${node.host}:${node.port}/health`, {
      signal: controller.signal,
      headers: node.authToken ? { Authorization: `Bearer ${node.authToken}` } : undefined,
    });
    clearTimeout(timer);
    const pingMs = Date.now() - start;
    if (healthRes.ok) {
      const data: any = await healthRes.json();
      const updated = db.updateNode(node.id, {
        status: 'online',
        pingMs,
        lastError: undefined,
        adbAvailable: Boolean(data.adbAvailable),
        emulatorAvailable: Boolean(data.emulatorAvailable),
        cpuUsagePercent: Number(data.cpuUsagePercent || 0),
        ramUsagePercent: Number(data.ramUsagePercent || 0),
        activeDevices: Number(data.activeDevices || 0),
      });
      return res.json(updated);
    }
    const updated = db.updateNode(node.id, {
      status: 'offline',
      pingMs,
      lastError: `HTTP ${healthRes.status}`,
    });
    return res.json(updated);
  } catch (err: any) {
    const updated = db.updateNode(node.id, {
      status: 'offline',
      pingMs: Date.now() - start,
      lastError: err.message,
    });
    return res.json(updated);
  }
});

app.delete('/api/nodes/:id', (req, res) => {
  if (req.params.id === 'node-local') {
    return res.status(400).json({ error: 'Cannot delete primary local node' });
  }
  const success = db.deleteNode(req.params.id);
  db.addLog({
    level: 'W',
    tag: 'NodeManager',
    message: `Removed distributed node: ${req.params.id}`,
  });
  res.json({ success, id: req.params.id });
});

// 16. Capacity Governor
app.get('/api/capacity', (_req, res) => {
  res.json(db.getCapacityStatus());
});

// 17. Multi-Screen Wall Query
app.get('/api/screenwall/devices', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 12;
  const runningOnly = req.query.runningOnly === 'true';
  const devices = db.getDevices();
  const filtered = runningOnly ? devices.filter((d) => d.status === 'running') : devices;
  res.json({
    total: filtered.length,
    devices: filtered.slice(0, limit),
  });
});

// ==========================================
// VITE DEV SERVER / STATIC ASSETS
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DYNOSHI ANDROID LAB] Server online and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[DYNOSHI ANDROID LAB] Server startup error:', err);
  process.exit(1);
});
