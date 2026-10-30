// Desktop (Steam) shell for Trout for Clout: one fullscreen window running the staged web game,
// saves mirrored to a plain file (so Steam Cloud can sync it), and Steamworks when launched through Steam.
'use strict';
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEV = !app.isPackaged || process.argv.includes('--dev');
const GAME = path.join(__dirname, '..', 'app', 'game', 'index.html');

// --profile=<dir> runs with its own saves and settings (testing never touches a player's real save).
const profileArg = process.argv.find((a) => a.startsWith('--profile='));
if (profileArg) app.setPath('userData', path.resolve(profileArg.slice(10)));

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// ---- Steam ----
// steam_appid.txt next to the exe (or in this folder during development) says which app to start as.
// Without Steam running the game still plays; it just has no overlay.
let steam = null;
function appId() {
  for (const dir of [path.dirname(process.execPath), path.join(__dirname, '..')]) {
    try { const n = parseInt(fs.readFileSync(path.join(dir, 'steam_appid.txt'), 'utf8'), 10); if (n) return n; } catch (e) { /* try the next */ }
  }
  return undefined;
}
try {
  const sw = require('steamworks.js');
  steam = sw.init(appId());
  sw.electronEnableSteamOverlay();
  console.log('Steam: signed in as ' + steam.localplayer.getName());
} catch (e) {
  steam = null;
  console.log('Steam not available: ' + (e && e.message));
}

// ---- Saves ----
// The game keeps everything in localStorage; the page mirrors its keys here as one JSON file.
// Point Steam Auto-Cloud at %APPDATA%/Trout for Clout/saves (see desktop/README.md).
const saveDir = path.join(app.getPath('userData'), 'saves');
const saveFile = path.join(saveDir, 'reelwild.json');
const prefsFile = path.join(app.getPath('userData'), 'window.json');

function readJson(f, fallback) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fallback; } }
function writeJson(f, data) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, f); // never leave a half-written save behind
}

ipcMain.on('saves:load', (e) => { e.returnValue = readJson(saveFile, null); });
ipcMain.on('saves:store', (e, data) => { try { writeJson(saveFile, data); e.returnValue = true; } catch (err) { e.returnValue = false; } });
ipcMain.on('app:quit', () => app.quit());
ipcMain.on('app:info', (e) => { e.returnValue = { version: app.getVersion(), steam: !!steam, platform: process.platform }; });

// ---- Window ----
let win = null;
function toggleFullscreen() {
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
  writeJson(prefsFile, { fullscreen: win.isFullScreen() });
}
ipcMain.on('app:fullscreen', () => toggleFullscreen());

function createWindow() {
  const prefs = readJson(prefsFile, { fullscreen: true });
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    fullscreen: prefs.fullscreen !== false,
    backgroundColor: '#0F1A1C',
    title: 'Trout for Clout',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: DEV,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.once('ready-to-show', () => win.show());

  // F11 / Alt+Enter flip fullscreen; F12 opens dev tools in development only.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { toggleFullscreen(); e.preventDefault(); }
    if (DEV && input.key === 'F12') win.webContents.toggleDevTools();
  });

  // Stay on the game: links open in the real browser, nothing else navigates the window.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:') && url.split('?')[0].split('#')[0].endsWith('/index.html')) return; // location.reload()
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });

  // Catch photos ("Download" on the share card) go straight to Pictures/Trout for Clout.
  win.webContents.session.on('will-download', (e, item) => {
    const dir = path.join(app.getPath('pictures'), 'Trout for Clout');
    fs.mkdirSync(dir, { recursive: true });
    item.setSavePath(path.join(dir, item.getFilename()));
  });

  win.loadFile(GAME);
}

Menu.setApplicationMenu(null);
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
