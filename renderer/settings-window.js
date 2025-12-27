// Settings Window Script
let settings = {};
let isRecordingHotkey = false;

async function init() {
  // Load current settings
  try {
    settings = await window.electronAPI.getSettings();
    applySettings();
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Close button
  document.getElementById('closeBtn').addEventListener('click', () => {
    window.electronAPI.closeSettingsWindow();
  });

  // Toggle switches
  document.querySelectorAll('.setting-toggle input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const setting = e.target.id;
      settings[setting] = e.target.checked;
      saveSettings();
    });
  });

  // View mode buttons
  document.querySelectorAll('.view-mode-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      await window.electronAPI.setViewMode(mode);
      settings.viewMode = mode;
      updateViewModeButtons();
    });
  });

  // Opacity slider
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  opacitySlider.addEventListener('input', async (e) => {
    const value = parseInt(e.target.value);
    opacityValue.textContent = `${value}%`;
    settings.opacity = value / 100;
    await window.electronAPI.setOpacity(value);
  });

  // Hotkey button
  const hotkeyBtn = document.getElementById('hotkeyBtn');
  hotkeyBtn.addEventListener('click', () => {
    if (isRecordingHotkey) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Danger buttons
  document.getElementById('resetCountersBtn').addEventListener('click', async () => {
    if (confirm('Reset all kill counters? This cannot be undone.')) {
      await window.electronAPI.resetAllCounters();
    }
  });

  document.getElementById('resetProgressBtn').addEventListener('click', async () => {
    if (confirm('Reset ALL progress including trophies and cosmetics? This cannot be undone.')) {
      await window.electronAPI.resetProgress();
    }
  });

  // Listen for hotkey
  document.addEventListener('keydown', handleKeyDown);
}

function applySettings() {
  document.getElementById('showTrophyCount').checked = settings.showTrophyCount !== false;
  document.getElementById('showCosmeticsCount').checked = settings.showCosmeticsCount !== false;
  document.getElementById('showRenown').checked = settings.showRenown !== false;
  document.getElementById('showStatBonuses').checked = settings.showStatBonuses === true;

  const opacity = Math.round((settings.opacity || 1) * 100);
  document.getElementById('opacitySlider').value = opacity;
  document.getElementById('opacityValue').textContent = `${opacity}%`;

  document.getElementById('hotkeyBtn').textContent = settings.hotkey || 'Ctrl+Alt+F12';

  updateViewModeButtons();
}

function updateViewModeButtons() {
  document.querySelectorAll('.view-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === settings.viewMode);
  });
}

async function saveSettings() {
  try {
    await window.electronAPI.saveSettings(settings);
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function startRecording() {
  isRecordingHotkey = true;
  const btn = document.getElementById('hotkeyBtn');
  btn.classList.add('recording');
  btn.textContent = 'Press keys...';
}

function stopRecording() {
  isRecordingHotkey = false;
  const btn = document.getElementById('hotkeyBtn');
  btn.classList.remove('recording');
  btn.textContent = settings.hotkey || 'Ctrl+Alt+F12';
}

async function handleKeyDown(e) {
  if (!isRecordingHotkey) return;

  e.preventDefault();

  if (e.key === 'Escape') {
    stopRecording();
    return;
  }

  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    parts.push(key);
  }

  if (parts.length > 1) {
    const accelerator = parts.join('+');
    try {
      const result = await window.electronAPI.setHotkey(accelerator);
      if (result.success) {
        settings.hotkey = accelerator;
        document.getElementById('hotkeyBtn').textContent = accelerator;
      }
    } catch (err) {
      console.error('Failed to set hotkey:', err);
    }
    stopRecording();
  }
}

document.addEventListener('DOMContentLoaded', init);
