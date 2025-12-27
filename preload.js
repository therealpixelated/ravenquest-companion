const { contextBridge, ipcRenderer } = require('electron');

// Track listeners for cleanup
let alertListener = null;
let settingsListener = null;
let viewModeListener = null;

contextBridge.exposeInMainWorld('electronAPI', {
  // Data
  getData: () => ipcRenderer.invoke('get-data'),
  saveProgress: (progress) => ipcRenderer.invoke('save-progress', progress),
  getProgress: () => ipcRenderer.invoke('get-progress'),
  saveTrophyLog: (log) => ipcRenderer.invoke('save-trophy-log', log),
  getTrophyLog: () => ipcRenderer.invoke('get-trophy-log'),
  reloadData: () => ipcRenderer.invoke('get-data'),

  // Overlay
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
  getOverlayOpacity: () => ipcRenderer.invoke('get-opacity'),
  setOverlayOpacity: (value) => ipcRenderer.invoke('set-opacity', value),

  // Collection tracking
  toggleCollected: (type, id, collected) =>
    ipcRenderer.invoke('toggle-collected', { type, id, collected }),
  getCollectedState: (type) => ipcRenderer.invoke('get-collected-state', type),
  getTrophyStates: () => ipcRenderer.invoke('get-trophy-states'),
  saveTrophyState: (trophyId, tier, checked) =>
    ipcRenderer.invoke('save-trophy-state', trophyId, tier, checked),
  getCosmeticsState: () => ipcRenderer.invoke('get-cosmetics-state'),
  saveCosmeticsState: (cosmeticId, state) =>
    ipcRenderer.invoke('save-cosmetics-state', cosmeticId, state),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Hotkey
  getHotkey: () => ipcRenderer.invoke('get-hotkey'),
  setHotkey: (accelerator) => ipcRenderer.invoke('set-hotkey', accelerator),

  // View Mode
  getViewMode: () => ipcRenderer.invoke('get-view-mode'),
  setViewMode: (mode) => ipcRenderer.invoke('set-view-mode', mode),

  // Active Targets (compact mode)
  getActiveTargets: () => ipcRenderer.invoke('get-active-targets'),
  saveActiveTargets: (targets) => ipcRenderer.invoke('save-active-targets', targets),

  // Kill Counters & Milestones
  getCounterConfig: (trophyId, trophyType) =>
    ipcRenderer.invoke('get-counter-config', trophyId, trophyType),
  getKillCounters: () => ipcRenderer.invoke('get-kill-counters'),
  getKillCounter: (trophyId) => ipcRenderer.invoke('get-kill-counter', trophyId),
  incrementCounter: (trophyId, amount) => ipcRenderer.invoke('increment-counter', trophyId, amount),
  setCounter: (trophyId, value) => ipcRenderer.invoke('set-counter', trophyId, value),
  resetCounter: (trophyId) => ipcRenderer.invoke('reset-counter', trophyId),
  recordMilestone: (trophyId, tier, method, count) =>
    ipcRenderer.invoke('record-milestone', trophyId, tier, method, count),
  removeMilestone: (trophyId, tier) => ipcRenderer.invoke('remove-milestone', trophyId, tier),
  getGlobalStats: () => ipcRenderer.invoke('get-global-stats'),

  // Shared counters (Monuments boss kills)
  getSharedCounter: () => ipcRenderer.invoke('get-shared-counter'),
  incrementSharedCounter: (amount) => ipcRenderer.invoke('increment-shared-counter', amount),
  resetSharedCounter: () => ipcRenderer.invoke('reset-shared-counter'),

  // Reset / Data Management
  resetAllCounters: () => ipcRenderer.invoke('reset-all-counters'),
  resetAllProgress: () => ipcRenderer.invoke('reset-all-progress'),

  // Event listeners
  onAlert: (callback) => {
    if (alertListener) {
      ipcRenderer.removeListener('alert', alertListener);
    }
    alertListener = (_event, payload) => callback(payload);
    ipcRenderer.on('alert', alertListener);
  },

  onOpenSettings: (callback) => {
    if (settingsListener) {
      ipcRenderer.removeListener('open-settings', settingsListener);
    }
    settingsListener = () => callback();
    ipcRenderer.on('open-settings', settingsListener);
  },

  onViewModeChanged: (callback) => {
    if (viewModeListener) {
      ipcRenderer.removeListener('view-mode-changed', viewModeListener);
    }
    viewModeListener = (_event, mode) => callback(mode);
    ipcRenderer.on('view-mode-changed', viewModeListener);
  },

  // Context Menu
  showContextMenu: () => ipcRenderer.invoke('show-context-menu'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // Settings window
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings-window'),

  // Overlay controls
  setClickThrough: (enabled) => ipcRenderer.invoke('set-click-through', enabled),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('set-always-on-top', enabled)
});
