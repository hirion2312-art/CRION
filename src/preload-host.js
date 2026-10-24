// CRION 화면(렌더러)에 꼭 필요한 기능만 열어 준다 (껍데기 · API 묶음 3)
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => {
  const h = (_e, data) => fn(data);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('crion', {
  info: () => ipcRenderer.invoke('app:info'),
  engineReady: () => ipcRenderer.invoke('engine:ready'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  getWorks: () => ipcRenderer.invoke('works:get'),
  syncWorks: () => ipcRenderer.invoke('works:sync'),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  openFolder: () => ipcRenderer.invoke('app:openFolder'),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  onUpdate: on('updates:event')
});
