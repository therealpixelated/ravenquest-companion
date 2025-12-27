// Settings panel logic
let settings = {};
let isRecordingHotkey = false;
let recordedKeys = [];

const settingsHelpers = window.uiHelpers || {
  showToast: () => {},
  setLoading: () => {},
  debounce: (fn) => fn
};

// Key name mapping for display
const keyNames = {
  Control: 'Ctrl',
  Meta: 'Cmd',
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right'
};

function formatKey(key) {
  return keyNames[key] || key;
}

function formatAccelerator(keys) {
  const modifiers = [];
  const regularKeys = [];

  keys.forEach((key) => {
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      modifiers.push(formatKey(key));
    } else {
      regularKeys.push(formatKey(key));
    }
  });

  return [...modifiers, ...regularKeys].join('+');
}

async function initSettings() {
  try {
    settings = await window.electronAPI.getSettings();

    // Load active targets from storage
    settings.activeTargets = (await window.electronAPI.getActiveTargets()) || [];

    renderSettingsPanel();
    applyViewMode(settings.viewMode);

    // Listen for tray menu triggers
    window.electronAPI.onOpenSettings(() => {
      openSettings();
    });

    window.electronAPI.onViewModeChanged((mode) => {
      settings.viewMode = mode;
      closeSettings(); // Close settings when view mode changes
      applyViewMode(mode);
    });
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function renderSettingsPanel() {
  const overlay = document.getElementById('settingsOverlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="settings-panel">
      <div class="settings-header">
        <h2>⚙ Settings</h2>
        <button class="settings-close">✕</button>
      </div>
      <div class="settings-content">
        
        <div class="settings-section">
          <div class="settings-section-title">Display</div>
          
          <div class="settings-row">
            <label>Show Trophy Count</label>
            <label class="toggle-switch">
              <input type="checkbox" id="showTrophyCount" ${settings.showTrophyCount ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="settings-row">
            <label>Show Cosmetics Count</label>
            <label class="toggle-switch">
              <input type="checkbox" id="showCosmeticsCount" ${settings.showCosmeticsCount ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="settings-row">
            <label>Show Total Renown</label>
            <label class="toggle-switch">
              <input type="checkbox" id="showRenown" ${settings.showRenown ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="settings-row">
            <label>Show Stat Bonuses</label>
            <label class="toggle-switch">
              <input type="checkbox" id="showStatBonuses" ${settings.showStatBonuses ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="settings-row">
            <label>Show Active Targets</label>
            <label class="toggle-switch">
              <input type="checkbox" id="showActiveTargets" ${settings.showActiveTargets ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="settings-section-title">Layout</div>
          <div class="layout-options">
            <div class="layout-option ${settings.viewMode === 'full' ? 'active' : ''}">
              <input type="radio" name="viewMode" value="full" ${settings.viewMode === 'full' ? 'checked' : ''}>
              <span class="layout-radio"></span>
              <div>
                <div class="layout-label">Full Window</div>
                <div class="layout-desc">Complete tracker with all features</div>
              </div>
            </div>
            
            <div class="layout-option ${settings.viewMode === 'compact-sidebar' ? 'active' : ''}">
              <input type="radio" name="viewMode" value="compact-sidebar" ${settings.viewMode === 'compact-sidebar' ? 'checked' : ''}>
              <span class="layout-radio"></span>
              <div>
                <div class="layout-label">Compact Sidebar</div>
                <div class="layout-desc">Slim sidebar with stats & targets</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="settings-section-title">Appearance</div>
          <div class="settings-row">
            <label>Overlay Opacity</label>
            <div class="settings-slider">
              <input type="range" id="opacitySlider" min="20" max="100" value="${Math.round((settings.opacity || 0.85) * 100)}">
              <span class="slider-value" id="opacityValue">${Math.round((settings.opacity || 0.85) * 100)}%</span>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="settings-section-title">Hotkey</div>
          <div class="settings-row">
            <label>Toggle Overlay</label>
            <div class="hotkey-display">
              <span class="hotkey-value ${isRecordingHotkey ? 'hotkey-recording' : ''}" id="hotkeyValue">${isRecordingHotkey ? 'Press keys...' : settings.hotkey || 'Ctrl+Alt+F12'}</span>
              <button class="hotkey-btn" id="hotkeyBtn">${isRecordingHotkey ? 'Cancel' : 'Change'}</button>
            </div>
          </div>
        </div>

        <div class="settings-section danger-zone">
          <div class="settings-section-title">⚠️ Data Management</div>
          <div class="settings-row">
            <div class="danger-info">
              <label>Reset Kill Counters</label>
              <span class="danger-desc">Clear all kill/activity counters (keeps collection progress)</span>
            </div>
            <button class="danger-btn" id="resetCountersBtn">Reset Counters</button>
          </div>
          <div class="settings-row">
            <div class="danger-info">
              <label>Reset All Progress</label>
              <span class="danger-desc">Clear everything: trophies, cosmetics, counters, targets</span>
            </div>
            <button class="danger-btn danger-btn-severe" id="resetAllBtn">Reset All</button>
          </div>
        </div>
        
      </div>
    </div>
  `;
}

function openSettings() {
  // Open settings in separate window
  window.electronAPI.openSettingsWindow();
}

function closeSettings() {
  window.electronAPI.closeSettingsWindow();
}

async function updateSetting(key, value) {
  settings[key] = value;
  try {
    await window.electronAPI.saveSettings({ [key]: value });
    updateCompactDisplay();
  } catch (err) {
    settingsHelpers.showToast('Failed to save setting', 'error');
  }
}

async function setViewMode(mode) {
  settings.viewMode = mode;

  // Update radio buttons
  document.querySelectorAll('.layout-option').forEach((opt) => {
    opt.classList.toggle('active', opt.querySelector('input').value === mode);
  });

  try {
    const result = await window.electronAPI.setViewMode(mode);
    if (result.success) {
      applyViewMode(mode);
      settingsHelpers.showToast(`Switched to ${mode.replace('-', ' ')} mode`, 'success');
    } else {
      settingsHelpers.showToast(result.error || 'Failed to change mode', 'error');
    }
  } catch (err) {
    settingsHelpers.showToast('Failed to change view mode', 'error');
  }
}

function applyViewMode(mode) {
  const app = document.querySelector('.app');
  if (!app) return;

  // Remove all mode classes
  app.classList.remove('compact-sidebar', 'compact-bar', 'compact-floating');

  // Add new mode class if not full
  if (mode !== 'full') {
    app.classList.add(mode);
  }

  // Update compact content visibility
  updateCompactDisplay();
}

async function updateOpacity(value) {
  const opacity = value / 100;
  document.getElementById('opacityValue').textContent = `${value}%`;

  try {
    await window.electronAPI.setOverlayOpacity(opacity);
    settings.opacity = opacity;
  } catch (err) {
    console.error('Failed to update opacity:', err);
  }
}

function toggleHotkeyRecording() {
  if (isRecordingHotkey) {
    stopHotkeyRecording();
  } else {
    startHotkeyRecording();
  }
}

function startHotkeyRecording() {
  isRecordingHotkey = true;
  recordedKeys = [];

  document.getElementById('hotkeyValue').textContent = 'Press keys...';
  document.getElementById('hotkeyValue').classList.add('hotkey-recording');
  document.getElementById('hotkeyBtn').textContent = 'Cancel';

  document.addEventListener('keydown', handleHotkeyKeydown);
  document.addEventListener('keyup', handleHotkeyKeyup);
}

function stopHotkeyRecording() {
  isRecordingHotkey = false;
  recordedKeys = [];

  const hotkeyValue = document.getElementById('hotkeyValue');
  const hotkeyBtn = document.getElementById('hotkeyBtn');

  if (hotkeyValue) {
    hotkeyValue.textContent = settings.hotkey || 'Ctrl+Alt+F12';
    hotkeyValue.classList.remove('hotkey-recording');
  }
  if (hotkeyBtn) {
    hotkeyBtn.textContent = 'Change';
  }

  document.removeEventListener('keydown', handleHotkeyKeydown);
  document.removeEventListener('keyup', handleHotkeyKeyup);
}

function handleHotkeyKeydown(e) {
  e.preventDefault();
  e.stopPropagation();

  const key = e.key;

  // Escape cancels
  if (key === 'Escape') {
    stopHotkeyRecording();
    return;
  }

  // Track modifier keys and regular key
  if (!recordedKeys.includes(key)) {
    recordedKeys.push(key);
  }

  // Update display
  const display = formatAccelerator(recordedKeys);
  document.getElementById('hotkeyValue').textContent = display || 'Press keys...';
}

async function handleHotkeyKeyup(e) {
  e.preventDefault();
  e.stopPropagation();

  // Need at least one modifier + one regular key
  const hasModifier = recordedKeys.some((k) => ['Control', 'Alt', 'Shift', 'Meta'].includes(k));
  const hasRegularKey = recordedKeys.some((k) => !['Control', 'Alt', 'Shift', 'Meta'].includes(k));

  if (hasModifier && hasRegularKey) {
    const accelerator = formatAccelerator(recordedKeys);

    try {
      const result = await window.electronAPI.setHotkey(accelerator);
      if (result.success) {
        settings.hotkey = result.hotkey;
        settingsHelpers.showToast(`Hotkey set to ${accelerator}`, 'success');
        stopHotkeyRecording();
      } else {
        settingsHelpers.showToast(result.error || 'Failed to set hotkey', 'error');
        stopHotkeyRecording();
      }
    } catch (err) {
      settingsHelpers.showToast('Failed to set hotkey', 'error');
      stopHotkeyRecording();
    }
  }
}

// Compact mode display updates
function updateCompactDisplay() {
  updateCompactStats();
  updateCompactTargets();
}

async function updateCompactStats() {
  const statsContainer = document.querySelector('.compact-stats');
  if (!statsContainer) return;

  // Get trophy and cosmetic data from global state
  const trophyData = window.trophyData || { trophies: [], trackedStates: {} };
  const cosmeticData = window.cosmeticData || { cosmetics: [], cosmeticState: {} };

  // Calculate totals
  const trophyTotal = trophyData.trophies.length;
  const trophyCollected = Object.values(trophyData.trackedStates).filter(
    (s) => s && (s.base || s.golden || s.enchanted)
  ).length;

  const cosmeticTotal = cosmeticData.cosmetics.length;
  const cosmeticCollected = Object.values(cosmeticData.cosmeticState).filter(
    (s) => s && s.collected
  ).length;

  const totalRenown = cosmeticData.cosmetics.reduce((sum, item) => {
    const state = cosmeticData.cosmeticState[item.id];
    return sum + (state?.collected ? item.renown || 0 : 0);
  }, 0);

  const maxRenown = cosmeticData.cosmetics.reduce((sum, item) => sum + (item.renown || 0), 0);

  let html = '';

  if (settings.showTrophyCount) {
    html += `
      <div class="compact-stat">
        <span class="compact-stat-label">🏆 Trophies</span>
        <span class="compact-stat-value">${trophyCollected}/${trophyTotal}</span>
      </div>
    `;
  }

  if (settings.showCosmeticsCount) {
    html += `
      <div class="compact-stat">
        <span class="compact-stat-label">👗 Cosmetics</span>
        <span class="compact-stat-value">${cosmeticCollected}/${cosmeticTotal}</span>
      </div>
    `;
  }

  if (settings.showRenown) {
    html += `
      <div class="compact-stat">
        <span class="compact-stat-label">✨ Renown</span>
        <span class="compact-stat-value">${totalRenown.toLocaleString()}/${maxRenown.toLocaleString()}</span>
      </div>
    `;
  }

  statsContainer.innerHTML = html;

  // Also update bar mode
  const barContent = document.querySelector('.compact-bar-content');
  if (barContent) {
    let barHtml = '';

    if (settings.showTrophyCount) {
      barHtml += `
        <div class="compact-bar-stat">
          <span class="icon">🏆</span>
          <span class="value">${trophyCollected}/${trophyTotal}</span>
        </div>
        <div class="compact-bar-divider"></div>
      `;
    }

    if (settings.showCosmeticsCount) {
      barHtml += `
        <div class="compact-bar-stat">
          <span class="icon">👗</span>
          <span class="value">${cosmeticCollected}/${cosmeticTotal}</span>
        </div>
        <div class="compact-bar-divider"></div>
      `;
    }

    if (settings.showRenown) {
      barHtml += `
        <div class="compact-bar-stat">
          <span class="icon">✨</span>
          <span class="value">${totalRenown.toLocaleString()}</span>
        </div>
      `;
    }

    barContent.innerHTML = barHtml;
  }
}

async function updateCompactTargets() {
  const targetsContainer = document.querySelector('.compact-targets');
  if (!targetsContainer || !settings.showActiveTargets) {
    if (targetsContainer) targetsContainer.innerHTML = '';
    return;
  }

  // Use window.activeTargets if available (synced from trophies.js), otherwise from settings
  const targets = window.activeTargets || settings.activeTargets || [];
  const trophyStates = window.trophyData?.trackedStates || {};

  // Get kill counters for display
  let killCounters = {};
  try {
    killCounters = (await window.electronAPI.getKillCounters()) || {};
  } catch (err) {
    console.error('Failed to load kill counters:', err);
  }

  if (targets.length === 0) {
    targetsContainer.innerHTML = `
      <div class="compact-targets-header">Active Targets</div>
      <div class="compact-target" style="opacity: 0.5; cursor: default;">
        No targets set. Add from full view.
      </div>
    `;
    return;
  }

  let html = '<div class="compact-targets-header">Active Targets</div>';

  targets.forEach((target) => {
    const state = trophyStates[target.id];
    const isCompleted = state && (state.base || state.golden || state.enchanted);
    const counter = killCounters[target.id] || { count: 0 };

    // Generate trophy image path
    const typeFolder = (target.type || 'Creature Trophies')
      .toLowerCase()
      .replace(/\s+trophies/g, '')
      .trim();
    const imageName = target.id || target.name.toLowerCase().replace(/\s+/g, '_');
    const imagePath = `../assets/trophies/${typeFolder}/${imageName}.png`;

    html += `
      <div class="compact-target ${isCompleted ? 'completed' : ''}" data-id="${target.id}" data-name="${target.name}">
        <img class="compact-target-img" src="${imagePath}" alt="${target.name}" onerror="this.src='../assets/cooking.png'">
        <div class="compact-target-info">
          <input type="checkbox" class="compact-target-checkbox" ${isCompleted ? 'checked' : ''} title="Mark as collected">
          <span class="compact-target-name"><span>${target.name}</span></span>
        </div>
        <div class="compact-target-actions">
          <div class="compact-target-counter">
            <button class="compact-counter-btn" data-id="${target.id}" data-action="add" title="Add kill">+</button>
            <span class="compact-target-count">${counter.count}</span>
          </div>
          <button class="compact-target-remove" data-id="${target.id}" title="Remove from targets">×</button>
        </div>
      </div>
    `;
  });

  targetsContainer.innerHTML = html;

  // Check for text overflow and add class
  targetsContainer.querySelectorAll('.compact-target-name').forEach((el) => {
    if (el.scrollWidth > el.clientWidth) {
      el.classList.add('overflow');
    }
  });
}

async function toggleCompactTarget(id, checked, name) {
  if (checked) {
    // Show acquisition modal for collecting
    showCompactAcquisitionModal(id, name);
  } else {
    // Unchecking - just update the state
    try {
      await window.electronAPI.saveTrophyState(id, 'base', false);
      settingsHelpers.showToast('Trophy unmarked', 'info');
      updateCompactTargets();
    } catch (err) {
      console.error('Failed to update trophy state:', err);
      settingsHelpers.showToast('Failed to update trophy', 'error');
    }
  }
}

// Show acquisition modal in compact mode
function showCompactAcquisitionModal(trophyId, trophyName) {
  // Use the existing modal if in full view, or create a mini one for compact
  const modal = document.getElementById('acquisitionModal');
  if (modal) {
    // Store the trophy info for when user selects a method
    window.pendingCompactAcquisition = { trophyId, trophyName };
    modal.classList.add('active');

    // Focus first option
    const firstOption = modal.querySelector('.modal-option');
    if (firstOption) firstOption.focus();
  }
}

// Handle acquisition method selection from compact mode
async function handleCompactAcquisition(method) {
  const pending = window.pendingCompactAcquisition;
  if (!pending) return;

  const { trophyId, trophyName } = pending;
  window.pendingCompactAcquisition = null;

  // Close modal
  const modal = document.getElementById('acquisitionModal');
  if (modal) modal.classList.remove('active');

  try {
    // Save trophy state as base collected
    await window.electronAPI.saveTrophyState(trophyId, 'base', true);

    // Record the milestone with method
    const counter = await window.electronAPI.getKillCounter(trophyId);
    await window.electronAPI.recordMilestone(trophyId, 'base', method, counter?.count || 0);

    settingsHelpers.showToast(`${trophyName} marked as ${method}!`, 'success');
    updateCompactTargets();
  } catch (err) {
    console.error('Failed to record acquisition:', err);
    settingsHelpers.showToast('Failed to save trophy', 'error');
  }
}

// Increment kill counter from compact mode
async function incrementCompactCounter(trophyId) {
  try {
    const result = await window.electronAPI.incrementCounter(trophyId, 1);
    if (result?.success !== false) {
      // Update the compact display
      const countEl = document.querySelector(
        `.compact-target[data-id="${trophyId}"] .compact-target-count`
      );
      if (countEl && result?.counter) {
        countEl.textContent = result.counter.count;
      }

      // Also update main view counter if visible
      const mainCountEl = document.querySelector(
        `.trophy-card[data-trophy-id="${trophyId}"] .counter-value`
      );
      if (mainCountEl && result?.counter) {
        mainCountEl.textContent = result.counter.count;
      }

      updateCompactTargets();
    }
  } catch (err) {
    console.error('Failed to increment counter:', err);
    settingsHelpers.showToast('Failed to add kill', 'error');
  }
}

// Add target from full view
async function addActiveTarget(id, name, type = 'trophy') {
  const targets = settings.activeTargets || [];

  // Check if already exists
  if (targets.some((t) => t.id === id)) {
    settingsHelpers.showToast('Already tracking this target', 'info');
    return;
  }

  targets.push({ id, name, type });
  settings.activeTargets = targets;

  try {
    await window.electronAPI.saveActiveTargets(targets);
    updateCompactTargets();
    settingsHelpers.showToast(`Added "${name}" to targets`, 'success');
  } catch (err) {
    settingsHelpers.showToast('Failed to add target', 'error');
  }
}

async function removeActiveTarget(id) {
  const targets = (settings.activeTargets || []).filter((t) => t.id !== id);
  settings.activeTargets = targets;

  // Sync with window.activeTargets too
  window.activeTargets = targets;

  try {
    await window.electronAPI.saveActiveTargets(targets);
    updateCompactTargets();
    settingsHelpers.showToast('Target removed', 'info');
  } catch (err) {
    settingsHelpers.showToast('Failed to remove target', 'error');
  }
}

// Export all functions for global access
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.updateSetting = updateSetting;
window.setViewMode = setViewMode;
window.updateOpacity = updateOpacity;
window.toggleHotkeyRecording = toggleHotkeyRecording;
window.addActiveTarget = addActiveTarget;
window.removeActiveTarget = removeActiveTarget;
window.toggleCompactTarget = toggleCompactTarget;
window.updateCompactDisplay = updateCompactDisplay;

// Initialize on DOM ready - attach event listeners properly (CSP compliant)
document.addEventListener('DOMContentLoaded', () => {
  initSettings();

  // Attach settings button click handler
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }

  // Event delegation for settings panel (handles dynamically created elements)
  document.addEventListener('click', (e) => {
    const target = e.target;

    // Close button
    if (target.classList.contains('settings-close')) {
      closeSettings();
      return;
    }

    // Layout options
    const layoutOption = target.closest('.layout-option');
    if (layoutOption) {
      const input = layoutOption.querySelector('input[type="radio"]');
      if (input) {
        setViewMode(input.value);
      }
      return;
    }

    // Hotkey button
    if (target.classList.contains('hotkey-btn')) {
      toggleHotkeyRecording();
      return;
    }

    // Compact target remove button
    if (target.classList.contains('compact-target-remove')) {
      const targetId = target.dataset.id;
      if (targetId) {
        removeActiveTarget(targetId);
      }
      return;
    }

    // Compact counter add button
    if (target.classList.contains('compact-counter-btn')) {
      const targetId = target.dataset.id;
      if (targetId && target.dataset.action === 'add') {
        incrementCompactCounter(targetId);
      }
      return;
    }

    // Compact target checkbox
    if (target.classList.contains('compact-target-checkbox')) {
      const targetEl = target.closest('.compact-target');
      if (targetEl) {
        const trophyId = targetEl.dataset.id;
        const trophyName = targetEl.dataset.name;
        toggleCompactTarget(trophyId, target.checked, trophyName);
      }
      return;
    }

    // Acquisition modal options (for compact mode)
    if (target.classList.contains('modal-option')) {
      const method = target.dataset.method;
      if (method && window.pendingCompactAcquisition) {
        handleCompactAcquisition(method);
      }
      return;
    }

    // Acquisition modal cancel (for compact mode)
    if (target.id === 'acquisitionCancel' || target.classList.contains('modal-overlay')) {
      if (window.pendingCompactAcquisition) {
        window.pendingCompactAcquisition = null;
        const modal = document.getElementById('acquisitionModal');
        if (modal) modal.classList.remove('active');
        // Uncheck the checkbox since they cancelled
        updateCompactTargets();
      }
      return;
    }

    // Reset counters button
    if (target.id === 'resetCountersBtn') {
      handleResetCounters();
      return;
    }

    // Reset all button
    if (target.id === 'resetAllBtn') {
      handleResetAll();
    }
  });

  // Event delegation for change events
  document.addEventListener('change', (e) => {
    const target = e.target;

    // Toggle switches
    if (target.closest('.toggle-switch')) {
      const id = target.id;
      if (id) {
        updateSetting(id, target.checked);
      }
      return;
    }

    // Opacity slider in settings
    if (target.id === 'opacitySlider') {
      updateOpacity(target.value);
    }
  });
});

// Reset handlers with confirmation
async function handleResetCounters() {
  const confirmed = confirm(
    'Are you sure you want to reset all kill counters?\n\n' +
      'This will clear all kill/activity counts and milestones.\n' +
      'Your trophy and cosmetic collection progress will be kept.'
  );

  if (!confirmed) return;

  try {
    const result = await window.electronAPI.resetAllCounters();
    if (result.success) {
      settingsHelpers.showToast('All counters have been reset', 'success');
      // Reload the page to refresh all data
      window.location.reload();
    } else {
      settingsHelpers.showToast('Failed to reset counters', 'error');
    }
  } catch (err) {
    console.error('Failed to reset counters:', err);
    settingsHelpers.showToast('Failed to reset counters', 'error');
  }
}

async function handleResetAll() {
  const confirmed = confirm(
    '⚠️ WARNING: This will delete ALL your progress!\n\n' +
      '• All trophy checkmarks\n' +
      '• All cosmetic checkmarks\n' +
      '• All kill counters & milestones\n' +
      '• All tracked targets\n\n' +
      'This cannot be undone. Are you absolutely sure?'
  );

  if (!confirmed) return;

  // Double confirmation for safety
  const doubleConfirmed = confirm('FINAL WARNING: Click OK to permanently delete all data.');

  if (!doubleConfirmed) return;

  try {
    const result = await window.electronAPI.resetAllProgress();
    if (result.success) {
      settingsHelpers.showToast('All progress has been reset', 'success');
      // Reload the page to refresh all data
      window.location.reload();
    } else {
      settingsHelpers.showToast('Failed to reset progress', 'error');
    }
  } catch (err) {
    console.error('Failed to reset progress:', err);
    settingsHelpers.showToast('Failed to reset progress', 'error');
  }
}
