const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen } = require('electron');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');
const { validateItems } = require('./src/dataValidation');
const {
  validateToggleCollected,
  validateTrophyState,
  validateCosmeticId
} = require('./src/ipcValidation');
const { normalizeCosmetics, normalizeTrophies } = require('./src/dataNormalize');

// Error resilience
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

const store = new Store();
let mainWindow;
let settingsWindow;
let isOverlayVisible = true;
let tray;
let lastResetAlertDate;
let overlayOpacity = store.get('overlay-opacity', 1.0);
let currentHotkey = store.get('hotkey', 'Ctrl+Alt+F12');

// Default settings
const defaultSettings = {
  showTrophyCount: true,
  showCosmeticsCount: true,
  showRenown: true,
  showStatBonuses: false,
  showActiveTargets: true,
  viewMode: 'full',
  opacity: 1.0,
  hotkey: 'Ctrl+Alt+F12',
  activeTargets: []
};

// Load data files
async function loadData() {
  const dataDir = path.join(__dirname, 'data');
  const warnings = [];

  // Helper to load with fallback
  const loadJson = async (filename, fallback = {}) => {
    const filepath = path.join(dataDir, filename);
    try {
      const raw = await fs.promises.readFile(filepath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Failed to load ${filename}, using fallback`);
      return fallback;
    }
  };

  const cosmeticsValidated = validateItems(
    'cosmetics.json',
    await loadJson('cosmetics.json', { items: [] }),
    ['name'],
    warnings
  );
  const cosmetics = normalizeCosmetics(cosmeticsValidated);

  const trophiesRaw = await loadJson('trophies.json', { items: [] });
  const trophiesValidated = validateItems('trophies.json', trophiesRaw, ['name', 'type'], warnings);
  const trophies = normalizeTrophies(trophiesValidated);

  return {
    cosmetics,
    trophies,
    warnings
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    acceptFirstMouse: true,
    // Overlay-specific settings for fullscreen games
    focusable: true,
    hasShadow: false,
    thickFrame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false // Keep running when not focused
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  // Set always on top with highest level for fullscreen game overlay
  // 'screen-saver' is the highest level and works over fullscreen games
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Enable click-through when ctrl is held (optional, for positioning)
  mainWindow.setIgnoreMouseEvents(false);

  if (overlayOpacity >= 0.2 && overlayOpacity <= 1) {
    mainWindow.setOpacity(overlayOpacity);
  }

  try {
    const primary = screen.getPrimaryDisplay().bounds;
    mainWindow.setPosition(primary.width - 1240, Math.max(0, Math.floor(primary.height / 2 - 350)));
  } catch (err) {
    console.warn('Failed to position window:', err.message);
  }

  mainWindow.loadFile('renderer/index.html');

  // Apply saved view mode on startup
  const savedViewMode = store.get('view-mode', 'full');
  if (savedViewMode !== 'full') {
    mainWindow.once('ready-to-show', () => {
      setViewModeFromTray(savedViewMode);
    });
  }

  // Register hotkey from settings
  registerHotkey(currentHotkey);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Re-apply overlay level when shown (important for fullscreen games)
  mainWindow.on('show', () => {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  });

  // Re-apply overlay level when focused
  mainWindow.on('focus', () => {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  });

  // Prevent minimize when clicking outside (stays visible for overlay use)
  mainWindow.on('blur', () => {
    // Re-assert always on top after blur to stay above fullscreen games
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  createTray();
}

// Create settings window as separate popup
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const mainBounds = mainWindow ? mainWindow.getBounds() : { x: 100, y: 100 };

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 520,
    x: mainBounds.x + 50,
    y: mainBounds.y + 50,
    parent: mainWindow,
    modal: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  settingsWindow.setAlwaysOnTop(true, 'screen-saver');
  settingsWindow.loadFile('renderer/settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow.on('blur', () => {
    // Keep on top even when blurred
    if (settingsWindow) {
      settingsWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });
}

// Dynamic hotkey registration
function registerHotkey(accelerator) {
  // Unregister all first
  globalShortcut.unregisterAll();

  if (!accelerator) return false;

  try {
    const success = globalShortcut.register(accelerator, () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          // Show and ensure it's on top of fullscreen games
          mainWindow.show();
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
          mainWindow.focus();
        }
      }
    });

    if (success) {
      currentHotkey = accelerator;
      store.set('hotkey', accelerator);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to register hotkey:', err.message);
    return false;
  }
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    console.warn('Tray icon not found, skipping tray creation');
    return;
  }

  try {
    tray = new Tray(iconPath);
  } catch (err) {
    console.warn('Failed to create tray:', err.message);
    return;
  }
  const toggleLabel = () => (mainWindow && mainWindow.isVisible() ? 'Hide' : 'Show');
  const currentMode = () => store.get('view-mode', 'full');

  const buildMenu = () =>
    Menu.buildFromTemplate([
      {
        label: `${toggleLabel()} Companion`,
        click: () => {
          if (!mainWindow) return;
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          createSettingsWindow();
        }
      },
      {
        label: 'View Mode',
        submenu: [
          {
            label: 'Full Window',
            type: 'radio',
            checked: currentMode() === 'full',
            click: () => setViewModeFromTray('full')
          },
          {
            label: 'Compact Sidebar',
            type: 'radio',
            checked: currentMode() === 'compact-sidebar',
            click: () => setViewModeFromTray('compact-sidebar')
          },
          {
            label: 'Minimal Bar',
            type: 'radio',
            checked: currentMode() === 'compact-bar',
            click: () => setViewModeFromTray('compact-bar')
          },
          {
            label: 'Floating Tracker',
            type: 'radio',
            checked: currentMode() === 'compact-floating',
            click: () => setViewModeFromTray('compact-floating')
          }
        ]
      },
      { type: 'separator' },
      { role: 'quit', label: 'Quit' }
    ]);

  tray.setContextMenu(buildMenu());
  tray.setToolTip('RavenQuest Companion');

  // Rebuild menu when window visibility changes
  if (mainWindow) {
    mainWindow.on('show', () => tray.setContextMenu(buildMenu()));
    mainWindow.on('hide', () => tray.setContextMenu(buildMenu()));
  }

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// Helper to set view mode from tray and update window
function setViewModeFromTray(mode) {
  store.set('view-mode', mode);

  if (mainWindow) {
    const primary = screen.getPrimaryDisplay().bounds;
    switch (mode) {
      case 'full':
        mainWindow.setSize(1200, 700);
        mainWindow.setResizable(true);
        mainWindow.setPosition(
          primary.width - 1240,
          Math.max(0, Math.floor(primary.height / 2 - 350))
        );
        break;
      case 'compact-sidebar':
        mainWindow.setSize(220, 450);
        mainWindow.setResizable(true);
        mainWindow.setMinimumSize(180, 300);
        mainWindow.setPosition(primary.width - 240, 100);
        break;
      case 'compact-bar':
        mainWindow.setSize(380, 42);
        mainWindow.setResizable(false);
        mainWindow.setPosition(Math.floor(primary.width / 2 - 190), 10);
        break;
      case 'compact-floating':
        mainWindow.setSize(160, 240);
        mainWindow.setResizable(true);
        mainWindow.setMinimumSize(140, 180);
        mainWindow.setPosition(primary.width - 180, 100);
        break;
      default:
        break;
    }
    // Ensure overlay level is maintained after mode switch
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.webContents.send('view-mode-changed', mode);
  }
}

// IPC handlers
ipcMain.handle('get-data', async () => loadData());

ipcMain.handle('save-progress', (event, progress) => {
  store.set('cosmetic-progress', progress);
  return { success: true };
});

ipcMain.handle('get-progress', () => store.get('cosmetic-progress', {}));

ipcMain.handle('save-trophy-log', (event, log) => {
  store.set('trophy-log', log);
  return { success: true };
});

ipcMain.handle('get-trophy-log', () => store.get('trophy-log', []));

ipcMain.handle('toggle-collected', (event, { type, id, collected }) => {
  const validation = validateToggleCollected({ type, id });
  if (!validation.success) {
    return validation;
  }
  const key = `${type}-collected`;
  const state = store.get(key, {});
  if (collected) {
    state[id] = {
      collected: true,
      collectedCount: (state[id]?.collectedCount || 0) + 1,
      firstCollectedAt: state[id]?.firstCollectedAt || new Date().toISOString(),
      lastCollectedAt: new Date().toISOString()
    };
  } else {
    delete state[id];
  }
  store.set(key, state);
  return { success: true, state: state[id] };
});

ipcMain.handle('get-collected-state', (event, type) => {
  const key = `${type}-collected`;
  return store.get(key, {});
});

ipcMain.handle('toggle-overlay', () => {
  isOverlayVisible = !isOverlayVisible;
  return isOverlayVisible;
});

ipcMain.handle('get-opacity', () => overlayOpacity);

ipcMain.handle('set-opacity', (_event, value) => {
  const num = Number(value);
  if (Number.isNaN(num) || num < 0.2 || num > 1) {
    return { success: false, error: 'Opacity must be between 0.2 and 1' };
  }
  overlayOpacity = num;
  store.set('overlay-opacity', overlayOpacity);
  if (mainWindow) {
    mainWindow.setOpacity(overlayOpacity);
  }
  return { success: true, value: overlayOpacity };
});

// Alert renderer when daily reset hits 6AM PST
const resetCheckInterval = setInterval(() => {
  const now = new Date();
  const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hours = pstNow.getHours();
  const dateKey = pstNow.toISOString().slice(0, 10);
  if (hours === 6 && lastResetAlertDate !== dateKey && mainWindow) {
    lastResetAlertDate = dateKey;
    mainWindow.webContents.send('alert', {
      type: 'reset',
      message: 'Daily reset (6AM PST). Reload data if needed.'
    });
  }
}, 60_000);

// Trophy tracking handlers
ipcMain.handle('get-trophy-states', () => store.get('trophy-states', {}));

ipcMain.handle('save-trophy-state', (event, trophyId, tier, checked) => {
  const validation = validateTrophyState(trophyId, tier);
  if (!validation.success) {
    return validation;
  }
  const states = store.get('trophy-states', {});
  if (!states[trophyId]) {
    states[trophyId] = { base: false, enchanted: false, golden: false };
  }
  states[trophyId][tier] = checked;
  store.set('trophy-states', states);
  return { success: true };
});

// Cosmetics tracking handlers
ipcMain.handle('get-cosmetics-state', () => store.get('cosmetics-state', {}));

ipcMain.handle('save-cosmetics-state', (event, cosmeticId, state) => {
  const validation = validateCosmeticId(cosmeticId);
  if (!validation.success) {
    return validation;
  }
  const states = store.get('cosmetics-state', {});
  states[cosmeticId] = state;
  store.set('cosmetics-state', states);
  return { success: true };
});

// ============================================
// Settings Handlers
// ============================================

ipcMain.handle('get-settings', () => ({
  showTrophyCount: store.get('settings.showTrophyCount', defaultSettings.showTrophyCount),
  showCosmeticsCount: store.get('settings.showCosmeticsCount', defaultSettings.showCosmeticsCount),
  showRenown: store.get('settings.showRenown', defaultSettings.showRenown),
  showStatBonuses: store.get('settings.showStatBonuses', defaultSettings.showStatBonuses),
  showActiveTargets: store.get('settings.showActiveTargets', defaultSettings.showActiveTargets),
  viewMode: store.get('view-mode', defaultSettings.viewMode),
  opacity: store.get('overlay-opacity', defaultSettings.opacity),
  hotkey: store.get('hotkey', defaultSettings.hotkey),
  activeTargets: store.get('active-targets', defaultSettings.activeTargets)
}));

ipcMain.handle('save-settings', (event, settings) => {
  try {
    if (settings.showTrophyCount !== undefined) {
      store.set('settings.showTrophyCount', settings.showTrophyCount);
    }
    if (settings.showCosmeticsCount !== undefined) {
      store.set('settings.showCosmeticsCount', settings.showCosmeticsCount);
    }
    if (settings.showRenown !== undefined) {
      store.set('settings.showRenown', settings.showRenown);
    }
    if (settings.showStatBonuses !== undefined) {
      store.set('settings.showStatBonuses', settings.showStatBonuses);
    }
    if (settings.showActiveTargets !== undefined) {
      store.set('settings.showActiveTargets', settings.showActiveTargets);
    }
    if (settings.viewMode !== undefined) {
      store.set('view-mode', settings.viewMode);
    }
    if (settings.activeTargets !== undefined) {
      store.set('active-targets', settings.activeTargets);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-hotkey', () => currentHotkey);

ipcMain.handle('set-hotkey', (event, accelerator) => {
  if (!accelerator || typeof accelerator !== 'string') {
    return { success: false, error: 'Invalid hotkey' };
  }

  const success = registerHotkey(accelerator);
  if (success) {
    return { success: true, hotkey: currentHotkey };
  }
  // Try to restore previous hotkey
  registerHotkey(currentHotkey);
  return {
    success: false,
    error: 'Failed to register hotkey. It may be in use by another application.'
  };
});

ipcMain.handle('get-view-mode', () => store.get('view-mode', 'full'));

ipcMain.handle('set-view-mode', (event, mode) => {
  const validModes = ['full', 'compact-sidebar', 'compact-bar', 'compact-floating'];
  if (!validModes.includes(mode)) {
    return { success: false, error: 'Invalid view mode' };
  }

  store.set('view-mode', mode);

  // Resize window based on mode
  if (mainWindow) {
    const primary = screen.getPrimaryDisplay().bounds;
    switch (mode) {
      case 'full':
        mainWindow.setSize(1200, 700);
        mainWindow.setResizable(true);
        mainWindow.setPosition(
          primary.width - 1240,
          Math.max(0, Math.floor(primary.height / 2 - 350))
        );
        break;
      case 'compact-sidebar':
        mainWindow.setSize(220, 450);
        mainWindow.setResizable(true);
        mainWindow.setMinimumSize(180, 300);
        mainWindow.setPosition(primary.width - 240, 100);
        break;
      case 'compact-bar':
        mainWindow.setSize(380, 42);
        mainWindow.setResizable(false);
        mainWindow.setPosition(Math.floor(primary.width / 2 - 190), 10);
        break;
      case 'compact-floating':
        mainWindow.setSize(160, 240);
        mainWindow.setResizable(true);
        mainWindow.setMinimumSize(140, 180);
        mainWindow.setPosition(primary.width - 180, 100);
        break;
      default:
        // Already validated, this shouldn't happen
        break;
    }

    // Ensure overlay level is maintained after mode switch
    mainWindow.setAlwaysOnTop(true, 'screen-saver');

    // Notify renderer of view mode change (closes settings, updates UI)
    mainWindow.webContents.send('view-mode-changed', mode);
  }

  return { success: true, mode };
});

// Active targets (for compact mode checklist)
ipcMain.handle('get-active-targets', () => store.get('active-targets', []));

ipcMain.handle('save-active-targets', (event, targets) => {
  if (!Array.isArray(targets)) {
    return { success: false, error: 'Targets must be an array' };
  }
  store.set('active-targets', targets);
  return { success: true };
});

// Context menu for right-click
ipcMain.handle('show-context-menu', () => {
  const currentMode = store.get('view-mode', 'full');
  const template = [
    {
      label: 'Full Window',
      type: 'radio',
      checked: currentMode === 'full',
      click: () => setViewModeFromTray('full')
    },
    {
      label: 'Compact Sidebar',
      type: 'radio',
      checked: currentMode === 'compact-sidebar',
      click: () => setViewModeFromTray('compact-sidebar')
    },
    {
      label: 'Minimal Bar',
      type: 'radio',
      checked: currentMode === 'compact-bar',
      click: () => setViewModeFromTray('compact-bar')
    },
    {
      label: 'Floating Tracker',
      type: 'radio',
      checked: currentMode === 'compact-floating',
      click: () => setViewModeFromTray('compact-floating')
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
    { role: 'quit', label: 'Quit' }
  ];

  const contextMenu = Menu.buildFromTemplate(template);
  contextMenu.popup({ window: mainWindow });
  return { success: true };
});

// Quit app handler
ipcMain.handle('quit-app', () => {
  app.quit();
});

// Open settings window handler
ipcMain.handle('open-settings-window', () => {
  createSettingsWindow();
  return { success: true };
});

// Close settings window handler
ipcMain.handle('close-settings-window', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
  return { success: true };
});

// Overlay control handlers
ipcMain.handle('set-click-through', (event, enabled) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
    return { success: true, enabled };
  }
  return { success: false, error: 'No window' };
});

ipcMain.handle('set-always-on-top', (event, enabled) => {
  if (mainWindow) {
    if (enabled) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      mainWindow.setAlwaysOnTop(false);
    }
    return { success: true, enabled };
  }
  return { success: false, error: 'No window' };
});

// ============================================
// Kill Counter / Milestone Handlers
// ============================================

// Counter type definitions per trophy category
const COUNTER_TYPES = {
  'Creature Trophies': { type: 'kills', label: 'Kills' },
  'Ocean Trophies': { type: 'kills', label: 'Kills' },
  Monuments: { type: 'bossKills', label: 'Bosses Defeated', shared: true },
  'Carnival Trophies': { type: 'default', label: 'Count' }
};

const TROPHY_COUNTER_OVERRIDES = {
  moa_carnival_trophy: { type: 'spins', label: 'Wheel Spins' },
  munk_carnival_trophy: { type: 'bets', label: 'Total Bets' }
};

// Shared counter key for Monuments
const SHARED_MONUMENT_KEY = '_shared_monuments_boss_kills';

ipcMain.handle('get-counter-config', (event, trophyId, trophyType) => {
  if (TROPHY_COUNTER_OVERRIDES[trophyId]) {
    return TROPHY_COUNTER_OVERRIDES[trophyId];
  }
  const config = COUNTER_TYPES[trophyType] || { type: 'kills', label: 'Kills' };
  return { ...config, sharedKey: config.shared ? SHARED_MONUMENT_KEY : null };
});

ipcMain.handle('get-kill-counters', () => store.get('kill-counters', {}));

ipcMain.handle('get-shared-counter', () => {
  const counters = store.get('kill-counters', {});
  return counters[SHARED_MONUMENT_KEY] || { count: 0, lastUpdated: null, milestones: [] };
});

ipcMain.handle('increment-shared-counter', (event, amount = 1) => {
  if (!Number.isInteger(amount) || Math.abs(amount) > 1000) {
    return { success: false, error: 'Invalid amount' };
  }

  const counters = store.get('kill-counters', {});
  if (!counters[SHARED_MONUMENT_KEY]) {
    counters[SHARED_MONUMENT_KEY] = { count: 0, lastUpdated: null, milestones: [] };
  }

  counters[SHARED_MONUMENT_KEY].count = Math.max(0, counters[SHARED_MONUMENT_KEY].count + amount);
  counters[SHARED_MONUMENT_KEY].lastUpdated = new Date().toISOString();
  store.set('kill-counters', counters);

  return { success: true, counter: counters[SHARED_MONUMENT_KEY] };
});

ipcMain.handle('reset-shared-counter', () => {
  const counters = store.get('kill-counters', {});
  if (counters[SHARED_MONUMENT_KEY]) {
    counters[SHARED_MONUMENT_KEY].count = 0;
    counters[SHARED_MONUMENT_KEY].lastUpdated = new Date().toISOString();
    store.set('kill-counters', counters);
  }
  return {
    success: true,
    counter: counters[SHARED_MONUMENT_KEY] || { count: 0, milestones: [] }
  };
});

ipcMain.handle('get-kill-counter', (event, trophyId) => {
  const counters = store.get('kill-counters', {});
  return (
    counters[trophyId] || {
      count: 0,
      lastUpdated: null,
      milestones: []
    }
  );
});

ipcMain.handle('increment-counter', (event, trophyId, amount = 1) => {
  if (!trophyId || typeof trophyId !== 'string') {
    return { success: false, error: 'Invalid trophy ID' };
  }
  if (!Number.isInteger(amount) || Math.abs(amount) > 1000) {
    return { success: false, error: 'Invalid amount' };
  }

  const counters = store.get('kill-counters', {});
  if (!counters[trophyId]) {
    counters[trophyId] = { count: 0, lastUpdated: null, milestones: [] };
  }

  counters[trophyId].count = Math.max(0, counters[trophyId].count + amount);
  counters[trophyId].lastUpdated = new Date().toISOString();
  store.set('kill-counters', counters);

  return { success: true, counter: counters[trophyId] };
});

ipcMain.handle('set-counter', (event, trophyId, value) => {
  if (!trophyId || typeof trophyId !== 'string') {
    return { success: false, error: 'Invalid trophy ID' };
  }
  if (!Number.isInteger(value) || value < 0 || value > 999999) {
    return { success: false, error: 'Invalid value' };
  }

  const counters = store.get('kill-counters', {});
  if (!counters[trophyId]) {
    counters[trophyId] = { count: 0, lastUpdated: null, milestones: [] };
  }

  counters[trophyId].count = value;
  counters[trophyId].lastUpdated = new Date().toISOString();
  store.set('kill-counters', counters);

  return { success: true, counter: counters[trophyId] };
});

ipcMain.handle('reset-counter', (event, trophyId) => {
  if (!trophyId || typeof trophyId !== 'string') {
    return { success: false, error: 'Invalid trophy ID' };
  }

  const counters = store.get('kill-counters', {});
  if (counters[trophyId]) {
    // Keep milestones, only reset count
    counters[trophyId].count = 0;
    counters[trophyId].lastUpdated = new Date().toISOString();
    store.set('kill-counters', counters);
  }

  return { success: true, counter: counters[trophyId] || { count: 0, milestones: [] } };
});

ipcMain.handle('record-milestone', (event, trophyId, tier, method, currentCount) => {
  if (!trophyId || typeof trophyId !== 'string') {
    return { success: false, error: 'Invalid trophy ID' };
  }
  const validTiers = ['base', 'enchanted', 'golden'];
  const validMethods = ['collected', 'purchased', 'gambled'];

  if (!validTiers.includes(tier)) {
    return { success: false, error: 'Invalid tier' };
  }
  if (!validMethods.includes(method)) {
    return { success: false, error: 'Invalid acquisition method' };
  }

  const counters = store.get('kill-counters', {});
  if (!counters[trophyId]) {
    counters[trophyId] = { count: currentCount || 0, lastUpdated: null, milestones: [] };
  }

  // Remove existing milestone for this tier if any
  counters[trophyId].milestones = counters[trophyId].milestones.filter((m) => m.tier !== tier);

  // Add new milestone
  counters[trophyId].milestones.push({
    tier,
    method,
    count: method === 'collected' ? currentCount : null,
    date: new Date().toISOString()
  });

  store.set('kill-counters', counters);

  // Update global stats
  const globalStats = store.get('global-stats', {
    totalGambled: 0,
    totalPurchased: 0,
    luckiestDrop: null,
    averageDrops: []
  });

  if (method === 'gambled') {
    globalStats.totalGambled = (globalStats.totalGambled || 0) + 1;
  } else if (method === 'purchased') {
    globalStats.totalPurchased = (globalStats.totalPurchased || 0) + 1;
  } else if (method === 'collected' && currentCount) {
    // Track for luck calculation
    globalStats.averageDrops = globalStats.averageDrops || [];
    globalStats.averageDrops.push({ trophyId, tier, count: currentCount });

    // Update luckiest drop (lowest count)
    if (!globalStats.luckiestDrop || currentCount < globalStats.luckiestDrop.count) {
      globalStats.luckiestDrop = { trophyId, tier, count: currentCount };
    }
  }

  store.set('global-stats', globalStats);

  return { success: true, counter: counters[trophyId] };
});

ipcMain.handle('remove-milestone', (event, trophyId, tier) => {
  if (!trophyId || typeof trophyId !== 'string') {
    return { success: false, error: 'Invalid trophy ID' };
  }

  const counters = store.get('kill-counters', {});
  if (counters[trophyId]) {
    counters[trophyId].milestones = counters[trophyId].milestones.filter((m) => m.tier !== tier);
    store.set('kill-counters', counters);
  }

  return { success: true };
});

ipcMain.handle('get-global-stats', () => {
  const stats = store.get('global-stats', {
    totalGambled: 0,
    totalPurchased: 0,
    luckiestDrop: null,
    averageDrops: []
  });

  // Calculate average
  if (stats.averageDrops && stats.averageDrops.length > 0) {
    const sum = stats.averageDrops.reduce((acc, d) => acc + d.count, 0);
    stats.averageCount = Math.round(sum / stats.averageDrops.length);
  } else {
    stats.averageCount = 0;
  }

  return stats;
});

// ============================================
// Reset / Data Management Handlers
// ============================================

ipcMain.handle('reset-all-counters', () => {
  store.set('kill-counters', {});
  store.set('global-stats', {
    totalGambled: 0,
    totalPurchased: 0,
    luckiestDrop: null,
    averageDrops: []
  });
  return { success: true };
});

ipcMain.handle('reset-all-progress', () => {
  // Reset trophy states
  store.set('trophy-states', {});
  // Reset cosmetic states
  store.set('cosmetics-state', {});
  // Reset counters
  store.set('kill-counters', {});
  // Reset global stats
  store.set('global-stats', {
    totalGambled: 0,
    totalPurchased: 0,
    luckiestDrop: null,
    averageDrops: []
  });
  // Reset active targets
  store.set('active-targets', []);

  return { success: true };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (resetCheckInterval) {
    clearInterval(resetCheckInterval);
  }
});
