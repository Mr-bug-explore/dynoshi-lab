/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Companion Remote Host Node Agent
 * Run on any Windows/Linux workstation with Android SDK + KVM/WHPX:
 *   npx tsx scripts/dynoshi_node_agent.ts
 */

import express from 'express';
import os from 'os';
import { execFile } from 'child_process';

const app = express();
const PORT = process.env.DYNOSHI_NODE_PORT ? parseInt(process.env.DYNOSHI_NODE_PORT, 10) : 5055;
const AUTH_TOKEN = process.env.DYNOSHI_NODE_TOKEN || '';

app.use(express.json());

app.use((req, res, next) => {
  if (AUTH_TOKEN && req.headers.authorization !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized node agent token' });
  }
  next();
});

function runBin(bin: string, args: string[], timeout = 6000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        code: err ? 1 : 0,
        stdout: (stdout || '').toString(),
        stderr: (stderr || (err ? err.message : '')).toString(),
      });
    });
  });
}

app.get('/health', async (_req, res) => {
  const adbCheck = await runBin('adb', ['devices']);
  const emuCheck = await runBin('emulator', ['-list-avds']);
  const activeDevices = adbCheck.stdout
    .split('\n')
    .filter((l) => /\tdevice\b|\s+device\b/.test(l) && !l.startsWith('List of')).length;

  const totalMem = os.totalmem() || 1;
  const freeMem = os.freemem() || 0;
  const ramUsagePercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
  const load = os.loadavg()[0] || 0;
  const cpuUsagePercent = Math.min(100, Math.round((load / (os.cpus().length || 1)) * 100));

  res.json({
    ok: true,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    adbAvailable: adbCheck.code === 0,
    emulatorAvailable: emuCheck.code === 0,
    activeDevices,
    cpuUsagePercent,
    ramUsagePercent,
    avds: emuCheck.code === 0 ? emuCheck.stdout.trim().split('\n').filter(Boolean) : [],
  });
});

app.get('/devices', async (_req, res) => {
  const adbRes = await runBin('adb', ['devices', '-l']);
  res.status(adbRes.code === 0 ? 200 : 500).json({
    stdout: adbRes.stdout,
    stderr: adbRes.stderr,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[DYNOSHI NODE AGENT] Listening on http://0.0.0.0:${PORT}`);
});
