/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - Electron Desktop Main Process
 */

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;

function startBackendServer() {
  const serverPath = path.join(__dirname, '..', 'server.ts');
  serverProcess = spawn('npx', ['tsx', serverPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '3000' },
    shell: true,
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error] ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#080B11',
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // Load Dynoshi Android Lab
  mainWindow.loadURL('http://localhost:3000');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackendServer();
  setTimeout(createWindow, 1500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) serverProcess.kill();
    app.quit();
  }
});
