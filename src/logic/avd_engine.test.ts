import test from 'node:test';
import assert from 'node:assert/strict';
import {
  translateCoordinates,
  isValidPackageName,
  sanitizeFileName,
  isValidAdbSerialOrEndpoint,
  calculateSwipe,
  buildAdbInputCommand,
  parseAdbDevicesOutput,
  parseGetPropOutput,
  extractGetPropHighlights,
  parsePmListPackagesOutput,
  parsePmPathOutput,
  parseEmulatorAvdList,
  parseAvdManagerListOutput,
  isGenuinePlayStoreTag,
  parseProcMemInfo,
  parseDumpsysBattery,
  parseDumpsysCpuInfo,
  parseWmDisplay,
  parseAdbLsOutput,
  parseLogcatOutput,
  filterDevices,
  paginateItems,
  calculateSafeCapacity,
  checkGooglePlayEligibility,
} from './avd_engine';

test('translateCoordinates scales click relative to viewport and resolution', () => {
  const rect = { left: 100, top: 100, width: 400, height: 800 };
  const res = { width: 1080, height: 2400, densityDpi: 420 };

  const center = translateCoordinates(300, 500, rect, res, 'portrait');
  assert.equal(center.x, 540);
  assert.equal(center.y, 1200);

  const landscape = translateCoordinates(300, 500, rect, res, 'landscape');
  assert.equal(landscape.x, 1200);
  assert.equal(landscape.y, 540);

  const clamped = translateCoordinates(50, 50, rect, res, 'portrait');
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 0);
});

test('isValidPackageName and isValidAdbSerialOrEndpoint validate safely', () => {
  assert.equal(isValidPackageName('com.dynoshi.androidlab'), true);
  assert.equal(isValidPackageName('com.google.android.youtube'), true);
  assert.equal(isValidPackageName('com.android.vending'), true);
  assert.equal(isValidPackageName('invalid'), false);
  assert.equal(isValidPackageName('123.com.test'), false);

  assert.equal(isValidAdbSerialOrEndpoint('emulator-5554'), true);
  assert.equal(isValidAdbSerialOrEndpoint('192.168.1.50:5555'), true);
  assert.equal(isValidAdbSerialOrEndpoint('RF8M90A123'), true);
  assert.equal(isValidAdbSerialOrEndpoint('bad;rm -rf /'), false);
  assert.equal(isValidAdbSerialOrEndpoint(''), false);
});

test('sanitizeFileName removes risky characters', () => {
  assert.equal(sanitizeFileName('my-app_v1.0.apk'), 'my-app_v1.0.apk');
  assert.equal(sanitizeFileName('exploit;rm -rf.apk'), 'exploit_rm_-rf.apk');
});

test('calculateSwipe and buildAdbInputCommand construct valid ADB commands', () => {
  const res = { width: 1080, height: 1920, densityDpi: 400 };
  const upSwipe = calculateSwipe('up', res, 'portrait', 0.5, 250);
  assert.equal(upSwipe.startX, 540);
  assert.ok(upSwipe.startY > upSwipe.endY);

  assert.equal(buildAdbInputCommand('tap', { x: 500, y: 800 }), 'input tap 500 800');
  assert.equal(buildAdbInputCommand('key', { keyCode: 3 }), 'input keyevent 3');
  assert.equal(buildAdbInputCommand('text', { text: 'Hello World' }), 'input text "Hello%sWorld"');
});

test('parseAdbDevicesOutput parses multiple devices and states correctly', () => {
  const sample = `
* daemon started successfully
List of devices attached
emulator-5554          device product:sdk_gphone64_x86_64 model:Pixel_8_Pro device:emu64xa transport_id:1
RF8M90A123             unauthorized transport_id:2
192.168.1.105:5555     offline transport_id:3
`;
  const parsed = parseAdbDevicesOutput(sample);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].id, 'emulator-5554');
  assert.equal(parsed[0].state, 'device');
  assert.equal(parsed[0].model, 'Pixel_8_Pro');
  assert.equal(parsed[1].state, 'unauthorized');
  assert.equal(parsed[2].state, 'offline');
});

test('parseGetPropOutput parses Android getprop lines', () => {
  const raw = `
[ro.product.model]: [Pixel 8 Pro]
[ro.product.manufacturer]: [Google]
[ro.build.version.release]: [14]
[ro.build.version.sdk]: [34]
[sys.boot_completed]: [1]
`;
  const props = parseGetPropOutput(raw);
  assert.equal(props['ro.product.model'], 'Pixel 8 Pro');
  assert.equal(props['ro.build.version.release'], '14');
  assert.equal(props['sys.boot_completed'], '1');

  const highlights = extractGetPropHighlights(props);
  assert.equal(highlights.model, 'Pixel 8 Pro');
  assert.equal(highlights.manufacturer, 'Google');
  assert.equal(highlights.androidRelease, '14');
  assert.equal(highlights.apiLevel, '34');
  assert.equal(highlights.bootCompleted, '1');
  assert.equal(highlights.isEmulator, false);

  const pmPaths = parsePmPathOutput('package:/product/priv-app/Phonesky/Phonesky.apk\npackage:/data/app/split_config.arm64.apk\n');
  assert.deepEqual(pmPaths, [
    '/product/priv-app/Phonesky/Phonesky.apk',
    '/data/app/split_config.arm64.apk',
  ]);
  assert.deepEqual(parsePmPathOutput(''), []);
});

test('parsePmListPackagesOutput parses pm list packages -f accurately', () => {
  const raw = `
package:/system/priv-app/Phonesky/Phonesky.apk=com.android.vending
package:/product/app/YouTube/YouTube.apk=com.google.android.youtube
package:/data/app/~~xyz==/com.example.app-abc==/base.apk=com.example.app
`;
  const pkgs = parsePmListPackagesOutput(raw);
  assert.equal(pkgs.length, 3);
  assert.equal(pkgs[0].packageName, 'com.android.vending');
  assert.equal(pkgs[0].isSystem, true);
  assert.equal(pkgs[1].packageName, 'com.google.android.youtube');
  assert.equal(pkgs[2].packageName, 'com.example.app');
  assert.equal(pkgs[2].isSystem, false);
});

test('parseEmulatorAvdList and parseAvdManagerListOutput distinguish Play Store images', () => {
  const avdNames = parseEmulatorAvdList('INFO    | Storing crashdata\nPixel_8_PlayStore\nAOSP_API_34\n');
  assert.deepEqual(avdNames, ['Pixel_8_PlayStore', 'AOSP_API_34']);

  const avdMgrRaw = `
Available Android Virtual Devices:
    Name: Pixel_8_PlayStore
  Device: pixel_8 (Google)
    Path: /home/user/.android/avd/Pixel_8_PlayStore.avd
  Target: Google Play (Google Inc.)
          Based on: Android 14.0 ("UpsideDownCake") Tag/ABI: google_apis_playstore/x86_64
---------
    Name: AOSP_Vanilla
  Device: medium_phone (Generic)
    Path: /home/user/.android/avd/AOSP_Vanilla.avd
  Target: Default Android System Image
          Based on: Android 14.0 ("UpsideDownCake") Tag/ABI: default/x86_64
`;
  const parsed = parseAvdManagerListOutput(avdMgrRaw);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].hasGooglePlay, true);
  assert.equal(parsed[1].hasGooglePlay, false);
  assert.equal(isGenuinePlayStoreTag('google_apis'), false);
  assert.equal(isGenuinePlayStoreTag('google_apis_playstore'), true);
});

test('parseProcMemInfo, parseDumpsysBattery, and parseWmDisplay parse real hardware output', () => {
  const mem = parseProcMemInfo('MemTotal:        4028416 kB\nMemFree:         1024000 kB\nMemAvailable:    2014208 kB\n');
  assert.equal(mem.totalMb, 3934);
  assert.equal(mem.usedPercent, 50);

  const bat = parseDumpsysBattery('  AC powered: false\n  USB powered: true\n  level: 87\n  temperature: 295\n');
  assert.equal(bat.level, 87);
  assert.equal(bat.temperatureC, 29.5);
  assert.equal(bat.isCharging, true);

  const wm = parseWmDisplay('Physical size: 1080x2400', 'Physical density: 420');
  assert.deepEqual(wm, { width: 1080, height: 2400, densityDpi: 420 });

  const cpu = parseDumpsysCpuInfo('Load: 2.15 / 1.88 / 1.42\n24% TOTAL: 14% user + 8.5% kernel + 1.5% iowait');
  assert.equal(cpu, 24);
  assert.equal(parseDumpsysCpuInfo('no cpuinfo'), 0);
});

test('parseAdbLsOutput and parseLogcatOutput parse Android shell output', () => {
  const lsRaw = `
total 24
drwxrwx--x 11 root sdcard_rw 4096 2026-11-01 12:00 .
drwxrwx--x 11 root sdcard_rw 4096 2026-11-01 12:00 ..
drwxrwx--- 2 u0_a12 media_rw 4096 2026-11-08 15:20 Download
-rw-rw---- 1 u0_a12 media_rw 15420 2026-11-10 14:10 capture log.txt
`;
  const files = parseAdbLsOutput(lsRaw, '/sdcard');
  assert.equal(files.length, 2);
  assert.equal(files[0].name, 'Download');
  assert.equal(files[0].isDirectory, true);
  assert.equal(files[1].name, 'capture log.txt');
  assert.equal(files[1].sizeBytes, 15420);

  const logRaw = `--------- beginning of main\n11-12 14:10:05.123 I/ActivityManager( 1420): Start proc com.android.vending\n11-12 14:10:06.001 E/AndroidRuntime( 2210): FATAL EXCEPTION`;
  const logs = parseLogcatOutput(logRaw, 'emulator-5554');
  assert.equal(logs.length, 2);
  assert.equal(logs[0].level, 'I');
  assert.equal(logs[0].tag, 'ActivityManager');
  assert.equal(logs[1].level, 'E');
});

test('filterDevices, paginateItems, calculateSafeCapacity, checkGooglePlayEligibility', () => {
  const sampleDevices = [
    { name: 'Pixel 8 Pro', status: 'running', androidVersion: '14', model: 'Pixel 8 Pro', manufacturer: 'Google', nodeId: 'node-local' },
    { name: 'Galaxy S24', status: 'stopped', androidVersion: '14', model: 'SM-S928B', manufacturer: 'Samsung', nodeId: 'node-local' },
  ];
  assert.equal(filterDevices(sampleDevices, 'Pixel').length, 1);
  assert.equal(paginateItems(Array.from({ length: 25 }, (_, i) => i), 2, 12).items.length, 12);

  const cap = calculateSafeCapacity(16384, 8192, 8, 2, 2048, 3072);
  assert.ok(cap.safeMaxConcurrent >= 4);
  assert.equal(checkGooglePlayEligibility('14', 34, 'x86_64'), true);
  assert.equal(checkGooglePlayEligibility('7', 23, 'x86_64'), false);
});
