import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiagnosticVerificationSteps,
  formatDiagnosticLogTranscript,
  extractGroundingSources,
  toSafeFirestoreId,
} from './diagnostics_log.js';
import type { LiveDeviceDiagnosticsResult } from '../types.js';

test('buildDiagnosticVerificationSteps maps 4 real ADB checks to PASS/FAIL steps', () => {
  const sample: LiveDeviceDiagnosticsResult = {
    deviceId: 'adb-emulator_5554',
    adbSerial: 'emulator-5554',
    adbAvailable: true,
    adbPath: '/app/applet/tools/platform-tools/adb',
    checkedAt: '2026-11-12T18:00:00.000Z',
    adbDevices: {
      command: 'adb devices -l',
      exitCode: 0,
      passed: true,
      stdout: 'List of devices attached\nemulator-5554 device model:Pixel_8',
      stderr: '',
      durationMs: 12,
      attachedCount: 1,
      devices: [{ id: 'emulator-5554', state: 'device', model: 'Pixel_8' }],
    },
    getprop: {
      command: 'adb -s emulator-5554 shell getprop',
      exitCode: 0,
      passed: true,
      stdout: '[ro.product.model]: [Pixel 8]',
      stderr: '',
      durationMs: 25,
      properties: { 'ro.product.model': 'Pixel 8' },
      propertyCount: 1,
      highlights: { model: 'Pixel 8', androidRelease: '14', apiLevel: '34' },
    },
    packages: {
      playStore: {
        packageName: 'com.android.vending',
        command: 'adb -s emulator-5554 shell pm path com.android.vending',
        exitCode: 0,
        passed: true,
        stdout: 'package:/product/priv-app/Phonesky/Phonesky.apk',
        stderr: '',
        durationMs: 18,
        installed: true,
        apkPaths: ['/product/priv-app/Phonesky/Phonesky.apk'],
      },
      youtube: {
        packageName: 'com.google.android.youtube',
        command: 'adb -s emulator-5554 shell pm path com.google.android.youtube',
        exitCode: 1,
        passed: false,
        stdout: '',
        stderr: 'Package com.google.android.youtube not installed on device.',
        durationMs: 15,
        installed: false,
        apkPaths: [],
      },
    },
  };

  const steps = buildDiagnosticVerificationSteps(sample);
  assert.equal(steps.length, 4);
  assert.equal(steps[0].status, 'pass');
  assert.equal(steps[1].status, 'pass');
  assert.equal(steps[2].status, 'pass');
  assert.equal(steps[3].status, 'fail');

  const transcript = formatDiagnosticLogTranscript(steps);
  assert.ok(transcript.includes('[PASS] ADB Hardware Probe (adb devices -l)'));
  assert.ok(transcript.includes('[FAIL] YouTube Package (com.google.android.youtube)'));
  assert.ok(transcript.includes('/product/priv-app/Phonesky/Phonesky.apk'));
});

test('extractGroundingSources deduplicates and filters invalid URLs', () => {
  const chunks = [
    { web: { uri: 'https://developer.android.com/studio/releases/emulator', title: 'Android Emulator' } },
    { web: { uri: 'https://developer.android.com/studio/releases/emulator', title: 'Duplicate' } },
    { web: { uri: 'javascript:alert(1)', title: 'Bad Scheme' } },
    { web: { uri: 'https://source.android.com/docs/core/tests', title: 'AOSP Tests' } },
  ];

  const extracted = extractGroundingSources(chunks, 10);
  assert.equal(extracted.length, 2);
  assert.equal(extracted[0].title, 'Android Emulator');
  assert.equal(extracted[1].uri, 'https://source.android.com/docs/core/tests');
});

test('toSafeFirestoreId sanitizes disallowed characters cleanly', () => {
  assert.equal(toSafeFirestoreId('emulator-5554:5555'), 'emulator-5554_5555');
  assert.equal(toSafeFirestoreId('bad/path;drop'), 'bad_path_drop');
  assert.match(toSafeFirestoreId(''), /^item_/);
});
