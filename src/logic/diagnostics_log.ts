/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Pure Diagnostic Log & Grounding Helpers
 */

import type { LiveDeviceDiagnosticsResult } from '../types.js';

export type DiagnosticStepId = 'adb_devices' | 'getprop' | 'playstore' | 'youtube';

export interface DiagnosticVerificationStep {
  id: DiagnosticStepId;
  label: string;
  command: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  exitCode?: number;
  durationMs?: number;
  summary: string;
  rawOutput: string;
  checkedAt: string;
}

export interface GroundingSourceLink {
  title: string;
  uri: string;
}

/**
 * Normalizes a LiveDeviceDiagnosticsResult into 4 ordered verification steps
 * for the monospaced diagnostic log panel.
 */
export function buildDiagnosticVerificationSteps(
  diag: LiveDeviceDiagnosticsResult
): DiagnosticVerificationStep[] {
  const checkedAt = diag.checkedAt || new Date().toISOString();

  const devOut = [diag.adbDevices.stdout, diag.adbDevices.stderr].filter(Boolean).join('\n').trim();
  const propOut = [
    diag.getprop.propertyCount > 0
      ? `Parsed ${diag.getprop.propertyCount} properties (model=${diag.getprop.highlights.model || 'N/A'}, android=${diag.getprop.highlights.androidRelease || 'N/A'}, sdk=${diag.getprop.highlights.apiLevel || 'N/A'})`
      : '',
    diag.getprop.stderr,
    diag.getprop.stdout ? diag.getprop.stdout.split('\n').slice(0, 12).join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();

  const playOut =
    diag.packages.playStore.apkPaths.length > 0
      ? diag.packages.playStore.apkPaths.map((p) => `package:${p}`).join('\n')
      : [diag.packages.playStore.stdout, diag.packages.playStore.stderr].filter(Boolean).join('\n').trim();

  const ytOut =
    diag.packages.youtube.apkPaths.length > 0
      ? diag.packages.youtube.apkPaths.map((p) => `package:${p}`).join('\n')
      : [diag.packages.youtube.stdout, diag.packages.youtube.stderr].filter(Boolean).join('\n').trim();

  return [
    {
      id: 'adb_devices',
      label: 'ADB Hardware Probe (adb devices -l)',
      command: diag.adbDevices.command,
      status: diag.adbDevices.passed ? 'pass' : 'fail',
      exitCode: diag.adbDevices.exitCode,
      durationMs: diag.adbDevices.durationMs,
      summary: `${diag.adbDevices.attachedCount} attached ADB target(s)`,
      rawOutput: devOut || '(no output)',
      checkedAt,
    },
    {
      id: 'getprop',
      label: 'System Properties (adb shell getprop)',
      command: diag.getprop.command,
      status: diag.getprop.passed ? 'pass' : 'fail',
      exitCode: diag.getprop.exitCode,
      durationMs: diag.getprop.durationMs,
      summary:
        diag.getprop.propertyCount > 0
          ? `${diag.getprop.propertyCount} properties verified`
          : 'No device properties returned',
      rawOutput: propOut || '(no output)',
      checkedAt,
    },
    {
      id: 'playstore',
      label: 'Play Store Package (com.android.vending)',
      command: diag.packages.playStore.command,
      status: diag.packages.playStore.installed ? 'pass' : 'fail',
      exitCode: diag.packages.playStore.exitCode,
      durationMs: diag.packages.playStore.durationMs,
      summary: diag.packages.playStore.installed
        ? `Installed (${diag.packages.playStore.apkPaths.length} APK path)`
        : 'Not installed or unreachable',
      rawOutput: playOut || '(no output)',
      checkedAt,
    },
    {
      id: 'youtube',
      label: 'YouTube Package (com.google.android.youtube)',
      command: diag.packages.youtube.command,
      status: diag.packages.youtube.installed ? 'pass' : 'fail',
      exitCode: diag.packages.youtube.exitCode,
      durationMs: diag.packages.youtube.durationMs,
      summary: diag.packages.youtube.installed
        ? `Installed (${diag.packages.youtube.apkPaths.length} APK path)`
        : 'Not installed or unreachable',
      rawOutput: ytOut || '(no output)',
      checkedAt,
    },
  ];
}

/**
 * Formats diagnostic verification steps into deterministic monospaced log text.
 */
export function formatDiagnosticLogTranscript(steps: DiagnosticVerificationStep[]): string {
  const lines: string[] = [];
  for (const step of steps) {
    const tag = step.status.toUpperCase();
    const timing =
      step.durationMs !== undefined ? ` (${step.durationMs}ms, exit=${step.exitCode ?? '?'})` : '';
    lines.push(`[${step.checkedAt}] [${tag}] ${step.label}${timing}`);
    lines.push(`$ ${step.command}`);
    lines.push(`> ${step.summary}`);
    if (step.rawOutput) {
      for (const rawLine of step.rawOutput.split('\n')) {
        lines.push(`  ${rawLine}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/**
 * Extracts deduplicated, safe HTTP/HTTPS grounding URLs from Gemini groundingChunks.
 */
export function extractGroundingSources(
  chunks: Array<{ web?: { uri?: string; title?: string } }> | undefined | null,
  maxItems: number = 10
): GroundingSourceLink[] {
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: GroundingSourceLink[] = [];

  for (const chunk of chunks) {
    const uri = chunk?.web?.uri?.trim();
    if (!uri) continue;
    if (!uri.startsWith('http://') && !uri.startsWith('https://')) continue;
    if (seen.has(uri)) continue;
    seen.add(uri);
    const title = (chunk?.web?.title?.trim() || uri).slice(0, 300);
    sources.push({ title, uri: uri.slice(0, 1024) });
    if (sources.length >= maxItems) break;
  }

  return sources;
}

/**
 * Sanitizes an identifier to comply with ^[a-zA-Z0-9_\-]+$ (max 128 chars).
 */
export function toSafeFirestoreId(raw: string, fallbackPrefix: string = 'item'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}
