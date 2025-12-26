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

// Error resilience
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

const store = new Store();
let mainWindow;
let isOverlayVisible = true;
let tray;
let lastResetAlertDate;
let overlayOpacity = store.get('overlay-opacity', 0.9);

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

  const cosmetics = validateItems(
    'cosmetics.json',
    await loadJson('cosmetics.json', { items: [] }),
    ['name'],
    warnings
  );
  const trophiesRaw = await loadJson('trophies.json', { items: [] });
  const trophies = validateItems('trophies.json', trophiesRaw, ['name', 'type'], warnings);

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

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

  // Register hotkey
  globalShortcut.register('Ctrl+Alt+F12', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createTray();
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
      { role: 'quit', label: 'Quit' }
    ]);

  tray.setContextMenu(buildMenu());
  tray.setToolTip('RavenQuest Companion');

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
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
