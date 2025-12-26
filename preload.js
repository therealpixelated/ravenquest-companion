const { contextBridge, ipcRenderer } = require('electron');

// Track alert listener for cleanup
let alertListener = null;

contextBridge.exposeInMainWorld('electronAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  saveProgress: (progress) => ipcRenderer.invoke('save-progress', progress),
  getProgress: () => ipcRenderer.invoke('get-progress'),
  saveTrophyLog: (log) => ipcRenderer.invoke('save-trophy-log', log),
  getTrophyLog: () => ipcRenderer.invoke('get-trophy-log'),
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
  toggleCollected: (type, id, collected) =>
    ipcRenderer.invoke('toggle-collected', { type, id, collected }),
  getCollectedState: (type) => ipcRenderer.invoke('get-collected-state', type),
  getTrophyStates: () => ipcRenderer.invoke('get-trophy-states'),
  saveTrophyState: (trophyId, tier, checked) =>
    ipcRenderer.invoke('save-trophy-state', trophyId, tier, checked),
  getCosmeticsState: () => ipcRenderer.invoke('get-cosmetics-state'),
  saveCosmeticsState: (cosmeticId, state) =>
    ipcRenderer.invoke('save-cosmetics-state', cosmeticId, state),
  reloadData: () => ipcRenderer.invoke('get-data'),
  onAlert: (callback) => {
    // Remove previous listener to prevent duplicates
    if (alertListener) {
      ipcRenderer.removeListener('alert', alertListener);
    }
    alertListener = (_event, payload) => callback(payload);
    ipcRenderer.on('alert', alertListener);
  },
  getOverlayOpacity: () => ipcRenderer.invoke('get-opacity'),
  setOverlayOpacity: (value) => ipcRenderer.invoke('set-opacity', value)
});
