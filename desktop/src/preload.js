// The small, fixed API the game page gets from the desktop shell (window.desktop).
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  info: () => ipcRenderer.sendSync('app:info'),
  loadSaves: () => ipcRenderer.sendSync('saves:load'),
  storeSaves: (data) => ipcRenderer.sendSync('saves:store', data),
  quit: () => ipcRenderer.send('app:quit'),
  toggleFullscreen: () => ipcRenderer.send('app:fullscreen'),
});
