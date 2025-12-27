// Stats from trophies in game order (only those with actual bonuses)
const STAT_TYPES = [
  'Spell Power',
  'Weapon Power',
  'Spell Defense',
  'Weapon Defense',
  'Healing Power',
  'Max Health',
  'Max Mana',
  'Mana Regeneration',
  'Health Regeneration',
  'Precision',
  'Impact',
  'Haste',
  'Dexterity',
  'Intelligence',
  'Might',
  'Vitality',
  'Wisdom',
  'Fishing Damage',
  'Ship Cannon Damage',
  'Drop Rate (Ocean)',
  'Gathering EXP',
  'Crafting EXP'
];

let trophies = [];
let trackedStates = {}; // { trophyId: { base: bool, enchanted: bool, golden: bool } }
let killCounters = {}; // { trophyId: { count, milestones: [] } }
let sharedCounter = { count: 0, milestones: [] }; // Shared counter for Monuments
let activeTrophyType = 'Creature Trophies'; // Track active sub-tab

// Pending acquisition - stores info when user checks a tier
let pendingAcquisition = null;

// Track if listeners are already attached to prevent duplicates
let listenersAttached = false;

// Store listener references for cleanup
const listenerRefs = {
  statusFilter: null,
  categoryFilter: null,
  trophySearch: null,
  tierFilter: null
};

// Make globally accessible for dashboard
window.trophyData = { trophies: [], trackedStates: {} };

const TOAST_DURATION = 3500;

const uiHelpers = {
  debounce(fn, delay = 150) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  },
  setLoading(isLoading) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.display = isLoading ? 'flex' : 'none';
    }
    document.body.dataset.loading = isLoading ? 'true' : 'false';
  },
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-exit');
      toast.addEventListener('transitionend', () => toast.remove());
    }, TOAST_DURATION);
  }
};

window.uiHelpers = uiHelpers;

// Initialize the tracker
async function init() {
  try {
    uiHelpers.setLoading(true);
    // Load all trophy data types
    const response = await window.electronAPI.getData();
    if (Array.isArray(response?.warnings)) {
      response.warnings.forEach((msg) => uiHelpers.showToast(msg, 'error'));
    }
    trophies = (response.trophies.items || []).map((t) => ({
      ...t,
      type: t.type || 'Creature Trophies'
    }));

    // Load tracked states
    trackedStates = (await window.electronAPI.getTrophyStates()) || {};

    // Load kill counters
    killCounters = (await window.electronAPI.getKillCounters()) || {};

    // Load shared counter for Monuments
    sharedCounter = (await window.electronAPI.getSharedCounter()) || { count: 0, milestones: [] };

    // Load active hunting targets
    window.activeTargets = (await window.electronAPI.getActiveTargets()) || [];

    // Update global data for dashboard
    window.trophyData = { trophies, trackedStates };

    // Render UI
    renderTrophyList();
    renderStatPanel();
    updateTotals();

    // Setup acquisition modal handlers (only once)
    if (!listenersAttached) {
      setupAcquisitionModal();
      setupFilterListeners();
      listenersAttached = true;
    }

    updateCategoryFilterVisibility();
    updateDashboard();
  } catch (error) {
    console.error('Failed to initialize:', error);
    uiHelpers.showToast('Failed to load trophy data', 'error');
  } finally {
    uiHelpers.setLoading(false);
  }
}

// Setup all filter listeners (called once)
function setupFilterListeners() {
  const debouncedFilter = uiHelpers.debounce(filterAndRender, 150);

  // Store reference for status filter
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    listenerRefs.statusFilter = debouncedFilter;
    statusFilter.addEventListener('change', listenerRefs.statusFilter);
  }

  // Store reference for category filter
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) {
    listenerRefs.categoryFilter = debouncedFilter;
    categoryFilter.addEventListener('change', listenerRefs.categoryFilter);
  }

  // Setup trophy sub-tab listeners
  document.querySelectorAll('.trophy-sub-tab').forEach((btn) => {
    if (!btn.hasAttribute('aria-selected')) {
      btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
    }
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.trophy-sub-tab').forEach((b) => {
        const isActive = b === e.target;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      activeTrophyType = e.target.dataset.trophyType;
      updateCategoryFilterVisibility();
      filterAndRender();
    });
  });

  // Trophy search input
  const trophySearchInput = document.getElementById('trophySearch');
  if (trophySearchInput) {
    listenerRefs.trophySearch = uiHelpers.debounce(() => filterAndRender());
    trophySearchInput.addEventListener('input', listenerRefs.trophySearch);
  }

  // Tier filter
  const tierFilterSelect = document.getElementById('tierFilter');
  if (tierFilterSelect) {
    listenerRefs.tierFilter = () => filterAndRender();
    tierFilterSelect.addEventListener('change', listenerRefs.tierFilter);
  }

  // Opacity slider
  const opacitySlider = document.getElementById('opacitySlider');
  if (opacitySlider) {
    if (window.electronAPI.getOverlayOpacity) {
      window.electronAPI
        .getOverlayOpacity()
        .then((val) => {
          const pct = Math.round(Math.min(Math.max(val || 0.9, 0.2), 1) * 100);
          opacitySlider.value = pct;
        })
        .catch(() => {});
    }
    opacitySlider.addEventListener('input', async (e) => {
      const pct = Math.min(Math.max(parseInt(e.target.value || '90', 10), 20), 100);
      e.target.value = pct;
      if (window.electronAPI.setOverlayOpacity) {
        await window.electronAPI.setOverlayOpacity(pct / 100);
      }
    });
  }

  // Alert listener
  if (window.electronAPI.onAlert) {
    window.electronAPI.onAlert((payload) => {
      if (payload?.type === 'reset') {
        uiHelpers.showToast(payload.message || 'Daily reset', 'info');
      }
    });
  }
}

// Show/hide category filter based on active trophy type
function updateCategoryFilterVisibility() {
  const categoryGroup = document.getElementById('categoryFilterGroup');
  if (activeTrophyType === 'Creature Trophies') {
    categoryGroup.style.display = 'flex';
  } else {
    categoryGroup.style.display = 'none';
    document.getElementById('categoryFilter').value = '';
  }
}

// Filter and render trophies based on active filters
function filterAndRender() {
  const statusFilter = document.getElementById('statusFilter').value;
  const categoryFilter = document.getElementById('categoryFilter').value;
  const tierFilter = document.getElementById('tierFilter').value;
  const searchFilter = (document.getElementById('trophySearch')?.value || '').toLowerCase();

  const filtered = trophies.filter((trophy) => {
    // Active sub-tab type filter
    if (trophy.type !== activeTrophyType) {
      return false;
    }

    // Search filter
    if (searchFilter && !trophy.name.toLowerCase().includes(searchFilter)) {
      return false;
    }

    // Tier filter
    if (tierFilter) {
      const state = trackedStates[trophy.id];
      if (tierFilter === 'Base' && (!state || !state.base)) {
        return false;
      }
      if (tierFilter === 'Golden' && (!state || !state.golden)) {
        return false;
      }
      if (tierFilter === 'Enchanted' && (!state || !state.enchanted)) {
        return false;
      }
    }

    // Status filter
    if (statusFilter) {
      const state = trackedStates[trophy.id];
      if (statusFilter === 'all-tiers') {
        // All three tiers collected
        if (!state || !state.base || !state.golden || !state.enchanted) {
          return false;
        }
      } else if (statusFilter === 'partial') {
        // Some but not all tiers collected
        if (!state) return false;
        const collected = [state.base, state.golden, state.enchanted].filter((x) => x).length;
        if (collected === 0 || collected === 3) {
          return false;
        }
      } else if (statusFilter === 'base-only') {
        // Only base collected
        if (!state || !state.base || state.golden || state.enchanted) {
          return false;
        }
      } else if (statusFilter === 'none') {
        // No tiers collected
        if (state && (state.base || state.golden || state.enchanted)) {
          return false;
        }
      }
    }

    // Category filter (only for Creature Trophies)
    if (
      categoryFilter &&
      trophy.type === 'Creature Trophies' &&
      trophy.category !== categoryFilter
    ) {
      return false;
    }

    return true;
  });

  // Update results count
  updateResultsCount(filtered.length, trophies.length);

  renderTrophyList(filtered);
  updateDashboard();
}

// Update the results count display
function updateResultsCount(shown, total) {
  const countEl = document.getElementById('resultsCount');
  if (!countEl) return;

  if (shown === total) {
    countEl.textContent = `Showing all ${total} trophies`;
  } else {
    countEl.textContent = `Showing ${shown} of ${total} trophies`;
  }
}

// Render the trophy list
function renderTrophyList(trophiesToRender = trophies) {
  const container = document.getElementById('trophyListContainer');
  container.innerHTML = '';

  if (trophiesToRender.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'empty-message';
    emptyMsg.textContent = 'No trophies match the selected filters';
    container.appendChild(emptyMsg);
    return;
  }

  // If viewing Monuments, show shared counter at top
  if (activeTrophyType === 'Monuments') {
    const sharedCounterEl = createSharedCounterUI();
    container.appendChild(sharedCounterEl);
  }

  trophiesToRender.forEach((trophy) => {
    const item = document.createElement('div');
    item.className = 'trophy-item';

    // Trophy thumbnail
    const thumbnail = document.createElement('img');
    thumbnail.className = 'trophy-thumbnail';
    thumbnail.alt = trophy.name;
    thumbnail.loading = 'lazy';

    const typeFolder = (trophy.type || 'Creature Trophies')
      .toLowerCase()
      .replace(/\s+trophies/g, '')
      .trim();
    const imageName = trophy.id || trophy.name.toLowerCase().replace(/\s+/g, '_');
    thumbnail.src = `../assets/trophies/${typeFolder}/${imageName}.png`;
    thumbnail.onerror = () => {
      thumbnail.src = '../assets/cooking.png';
    };
    item.appendChild(thumbnail);

    // Trophy info
    const info = document.createElement('div');
    info.className = 'trophy-info';

    // Build bonus display (support multiple bonuses)
    let bonusDisplay = '';
    const bonuses = trophy.bonuses || (trophy.bonus ? [trophy.bonus] : []);
    bonusDisplay = bonuses.map((b) => `${b.value} ${b.stat}`).join(', ');

    // Only show creature/category for Creature and Ocean trophies
    const showCreatureInfo =
      trophy.type === 'Creature Trophies' || trophy.type === 'Ocean Trophies';
    const creatureHTML = showCreatureInfo
      ? `<span class="trophy-creature">${trophy.creature || 'N/A'}</span><span class="trophy-family">Coming Soon</span>`
      : '';

    info.innerHTML = `
            <div class="trophy-name">${trophy.name}</div>
            <div class="trophy-details">
                ${creatureHTML}
                <span class="trophy-bonus">${bonusDisplay}</span>
            </div>
        `;

    // Checkboxes for each tier
    const checkboxes = document.createElement('div');
    checkboxes.className = 'trophy-checkboxes';

    // Map trophy tier names to lowercase for state tracking
    const tierMapping = {
      Base: 'base',
      Golden: 'golden',
      Enchanted: 'enchanted'
    };

    // Only show tiers that exist for this trophy
    const availableTiers = trophy.tiers || ['Base', 'Golden', 'Enchanted'];
    availableTiers.forEach((tierLabel) => {
      const tier = tierMapping[tierLabel];
      const group = document.createElement('div');
      group.className = 'checkbox-group';

      const label = document.createElement('label');
      label.className = `checkbox-label ${tier}`;
      label.textContent = tierLabel;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = `trophy-checkbox ${tier}`;
      checkbox.dataset.trophyId = trophy.id;
      checkbox.dataset.tier = tier;
      checkbox.setAttribute('aria-label', `${trophy.name} ${tierLabel} collected`);

      // Load saved state
      if (trackedStates[trophy.id] && trackedStates[trophy.id][tier]) {
        checkbox.checked = true;
      }

      checkbox.addEventListener('change', (e) => {
        handleCheckboxChange(trophy.id, tier, e.target.checked, trophy);
      });

      group.appendChild(label);
      group.appendChild(checkbox);
      checkboxes.appendChild(group);
    });

    item.appendChild(info);
    item.appendChild(checkboxes);

    // Add track button for hunting targets
    const trackBtn = document.createElement('button');
    trackBtn.className = 'track-btn';
    trackBtn.title = 'Add to hunting targets';
    trackBtn.setAttribute('aria-label', `Track ${trophy.name}`);

    // Check if already tracked
    const isTracked = window.activeTargets?.some((t) => t.id === trophy.id);
    trackBtn.classList.toggle('tracked', isTracked);
    trackBtn.innerHTML = isTracked ? '🎯' : '➕';

    trackBtn.addEventListener('click', () => toggleTrackTrophy(trophy, trackBtn));
    item.appendChild(trackBtn);

    // Add kill counter UI (only for trackable trophies)
    const counterUI = createCounterUI(trophy);
    if (counterUI) {
      item.appendChild(counterUI);
    }

    container.appendChild(item);
  });
}

// Toggle tracking a trophy for hunting
async function toggleTrackTrophy(trophy, btn) {
  try {
    const targets = window.activeTargets || [];
    const existingIndex = targets.findIndex((t) => t.id === trophy.id);

    if (existingIndex >= 0) {
      // Remove from tracking
      targets.splice(existingIndex, 1);
      btn.classList.remove('tracked');
      btn.innerHTML = '➕';
      uiHelpers.showToast(`Removed ${trophy.name} from hunting targets`, 'info');
    } else {
      // Add to tracking (max 5)
      if (targets.length >= 5) {
        uiHelpers.showToast('Maximum 5 hunting targets allowed', 'warning');
        return;
      }
      targets.push({
        id: trophy.id,
        name: trophy.name,
        type: trophy.type,
        creature: trophy.creature
      });
      btn.classList.add('tracked');
      btn.innerHTML = '🎯';
      uiHelpers.showToast(`Added ${trophy.name} to hunting targets`, 'success');
    }

    window.activeTargets = targets;
    await window.electronAPI.saveActiveTargets(targets);
  } catch (error) {
    console.error('Failed to toggle tracking:', error);
    uiHelpers.showToast('Failed to update tracking', 'error');
  }
}

// Create shared counter UI for Monuments (Aether trophies)
function createSharedCounterUI() {
  const wrapper = document.createElement('div');
  wrapper.className = 'shared-counter-section';

  const header = document.createElement('div');
  header.className = 'shared-counter-header';
  header.innerHTML = `
    <span class="shared-counter-title">🎯 Boss Kill Tracker</span>
    <span class="shared-counter-desc">Track your boss kills - monuments drop randomly from any boss</span>
  `;

  const counterRow = document.createElement('div');
  counterRow.className = 'shared-counter-row';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'counter-label';
  labelSpan.textContent = 'Bosses Defeated:';

  const valueSpan = document.createElement('span');
  valueSpan.className = 'counter-value shared-counter-value';
  valueSpan.id = 'shared-counter-value';
  valueSpan.textContent = sharedCounter.count.toLocaleString();

  const buttons = document.createElement('div');
  buttons.className = 'counter-buttons';

  const btnMinus = document.createElement('button');
  btnMinus.className = 'counter-btn';
  btnMinus.textContent = '-1';
  btnMinus.addEventListener('click', () => updateSharedCounter(-1));

  const btnPlus1 = document.createElement('button');
  btnPlus1.className = 'counter-btn';
  btnPlus1.textContent = '+1';
  btnPlus1.addEventListener('click', () => updateSharedCounter(1));

  const btnPlus10 = document.createElement('button');
  btnPlus10.className = 'counter-btn';
  btnPlus10.textContent = '+10';
  btnPlus10.addEventListener('click', () => updateSharedCounter(10));

  const btnReset = document.createElement('button');
  btnReset.className = 'counter-btn reset';
  btnReset.textContent = '↺';
  btnReset.title = 'Reset counter (keeps milestone history)';
  btnReset.addEventListener('click', resetSharedCounter);

  buttons.appendChild(btnMinus);
  buttons.appendChild(btnPlus1);
  buttons.appendChild(btnPlus10);
  buttons.appendChild(btnReset);

  counterRow.appendChild(labelSpan);
  counterRow.appendChild(valueSpan);
  counterRow.appendChild(buttons);

  wrapper.appendChild(header);
  wrapper.appendChild(counterRow);

  return wrapper;
}

// Update shared counter
async function updateSharedCounter(amount) {
  try {
    const result = await window.electronAPI.incrementSharedCounter(amount);
    if (result.success) {
      sharedCounter = result.counter;
      const valueEl = document.getElementById('shared-counter-value');
      if (valueEl) {
        valueEl.textContent = result.counter.count.toLocaleString();
      }
    }
  } catch (err) {
    console.error('Failed to update shared counter:', err);
    uiHelpers.showToast('Failed to update counter', 'error');
  }
}

// Reset shared counter
async function resetSharedCounter() {
  try {
    const result = await window.electronAPI.resetSharedCounter();
    if (result.success) {
      sharedCounter = result.counter;
      const valueEl = document.getElementById('shared-counter-value');
      if (valueEl) {
        valueEl.textContent = '0';
      }
      uiHelpers.showToast('Counter reset (milestones preserved)', 'info');
    }
  } catch (err) {
    console.error('Failed to reset shared counter:', err);
    uiHelpers.showToast('Failed to reset counter', 'error');
  }
}

// Create the kill counter UI for a trophy
function createCounterUI(trophy) {
  // Monuments use shared counter, don't show individual
  if (trophy.type === 'Monuments') {
    return null;
  }

  const counter = killCounters[trophy.id] || { count: 0, milestones: [] };

  const wrapper = document.createElement('div');
  wrapper.className = 'trophy-counter';
  wrapper.dataset.trophyId = trophy.id;

  // Get counter config for label
  const counterType = getCounterTypeForTrophy(trophy);

  // Counter display
  const labelSpan = document.createElement('span');
  labelSpan.className = 'counter-label';
  labelSpan.textContent = `${counterType.label}:`;

  const valueSpan = document.createElement('span');
  valueSpan.className = 'counter-value';
  valueSpan.id = `counter-${trophy.id}`;
  valueSpan.textContent = counter.count.toLocaleString();

  // Buttons
  const buttons = document.createElement('div');
  buttons.className = 'counter-buttons';

  const btnMinus = document.createElement('button');
  btnMinus.className = 'counter-btn';
  btnMinus.textContent = '-1';
  btnMinus.addEventListener('click', () => updateCounter(trophy.id, -1));

  const btnPlus1 = document.createElement('button');
  btnPlus1.className = 'counter-btn';
  btnPlus1.textContent = '+1';
  btnPlus1.addEventListener('click', () => updateCounter(trophy.id, 1));

  const btnPlus10 = document.createElement('button');
  btnPlus10.className = 'counter-btn';
  btnPlus10.textContent = '+10';
  btnPlus10.addEventListener('click', () => updateCounter(trophy.id, 10));

  const btnReset = document.createElement('button');
  btnReset.className = 'counter-btn reset';
  btnReset.textContent = '↺';
  btnReset.title = 'Reset counter (keeps milestone history)';
  btnReset.addEventListener('click', () => resetCounter(trophy.id));

  buttons.appendChild(btnMinus);
  buttons.appendChild(btnPlus1);
  buttons.appendChild(btnPlus10);
  buttons.appendChild(btnReset);

  wrapper.appendChild(labelSpan);
  wrapper.appendChild(valueSpan);
  wrapper.appendChild(buttons);

  // Add milestones display if any exist
  if (counter.milestones && counter.milestones.length > 0) {
    const milestonesDiv = createMilestonesDisplay(counter.milestones);
    wrapper.appendChild(milestonesDiv);
  }

  return wrapper;
}

// Get counter type config for a trophy
function getCounterTypeForTrophy(trophy) {
  const overrides = {
    moa_carnival_trophy: { type: 'spins', label: 'Wheel Spins' },
    munk_carnival_trophy: { type: 'bets', label: 'Total Bets' }
  };

  if (overrides[trophy.id]) {
    return overrides[trophy.id];
  }

  const typeConfig = {
    'Creature Trophies': { type: 'kills', label: 'Kills' },
    'Ocean Trophies': { type: 'kills', label: 'Kills' },
    Monuments: { type: 'bossKills', label: 'Bosses Defeated' },
    'Carnival Trophies': { type: 'default', label: 'Count' }
  };

  return typeConfig[trophy.type] || { type: 'kills', label: 'Kills' };
}

// Create milestones display
function createMilestonesDisplay(milestones) {
  const div = document.createElement('div');
  div.className = 'trophy-milestones';

  const globalStats = window.globalStats || { averageCount: 0 };

  milestones.forEach((m) => {
    const span = document.createElement('span');
    span.className = 'milestone obtained';

    let icon = '🎯';
    let countDisplay = '';

    if (m.method === 'purchased') {
      icon = '💰';
      countDisplay = 'Purchased';
    } else if (m.method === 'gambled') {
      icon = '🎰';
      countDisplay = 'Gambled';
    } else if (m.count !== null) {
      countDisplay = m.count.toLocaleString();

      // Add luck indicator if we have average data
      if (globalStats.averageCount > 0) {
        const luckRatio = m.count / globalStats.averageCount;
        let luckClass = 'average';
        let luckText = '';

        if (luckRatio < 0.7) {
          luckClass = 'lucky';
          luckText = '🍀';
        } else if (luckRatio > 1.3) {
          luckClass = 'unlucky';
          luckText = '';
        }

        if (luckText) {
          countDisplay += ` <span class="luck-indicator ${luckClass}">${luckText}</span>`;
        }
      }
    }

    span.innerHTML = `
      <span class="milestone-icon">${icon}</span>
      <span class="milestone-tier">${m.tier}:</span>
      <span class="milestone-count">${countDisplay}</span>
    `;

    div.appendChild(span);
  });

  return div;
}

// Update counter value
async function updateCounter(trophyId, amount) {
  try {
    const result = await window.electronAPI.incrementCounter(trophyId, amount);
    if (result.success) {
      killCounters[trophyId] = result.counter;
      const valueEl = document.getElementById(`counter-${trophyId}`);
      if (valueEl) {
        valueEl.textContent = result.counter.count.toLocaleString();
      }
    }
  } catch (err) {
    console.error('Failed to update counter:', err);
    uiHelpers.showToast('Failed to update counter', 'error');
  }
}

// Reset counter (keeps milestones)
async function resetCounter(trophyId) {
  try {
    const result = await window.electronAPI.resetCounter(trophyId);
    if (result.success) {
      killCounters[trophyId] = result.counter;
      const valueEl = document.getElementById(`counter-${trophyId}`);
      if (valueEl) {
        valueEl.textContent = '0';
      }
      uiHelpers.showToast('Counter reset (milestones preserved)', 'info');
    }
  } catch (err) {
    console.error('Failed to reset counter:', err);
    uiHelpers.showToast('Failed to reset counter', 'error');
  }
}

// Setup acquisition modal event handlers
function setupAcquisitionModal() {
  const modal = document.getElementById('acquisitionModal');
  const cancelBtn = document.getElementById('acquisitionCancel');

  if (!modal || !cancelBtn) return;

  // Cancel button
  cancelBtn.addEventListener('click', () => {
    closeAcquisitionModal(false);
  });

  // Option buttons
  const options = modal.querySelectorAll('.modal-option');
  options.forEach((btn, index) => {
    // Make options focusable
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('role', 'button');

    btn.addEventListener('click', () => {
      const method = btn.dataset.method;
      if (method && pendingAcquisition) {
        completeAcquisition(method);
      }
    });

    // Enter/Space to activate
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const method = btn.dataset.method;
        if (method && pendingAcquisition) {
          completeAcquisition(method);
        }
      }
      // Arrow key navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = options[index + 1] || cancelBtn;
        next.focus();
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = options[index - 1] || options[options.length - 1];
        prev.focus();
      }
    });
  });

  // Make cancel button part of navigation
  cancelBtn.setAttribute('tabindex', '0');
  cancelBtn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      options[options.length - 1]?.focus();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      options[0]?.focus();
    }
  });

  // Click outside to cancel
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeAcquisitionModal(false);
    }
  });

  // Escape key to close - use document level for reliability
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      e.preventDefault();
      closeAcquisitionModal(false);
    }
  });
}

// Store the element that had focus before modal opened
let previousFocus = null;

// Show acquisition modal
function showAcquisitionModal(trophyId, tier, trophy) {
  pendingAcquisition = { trophyId, tier, trophy };

  const modal = document.getElementById('acquisitionModal');
  if (modal) {
    // Store current focus to restore later
    previousFocus = document.activeElement;

    modal.classList.add('active');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', `How did you acquire the ${tier} tier?`);

    // Focus the first option after a brief delay for animation
    setTimeout(() => {
      const firstOption = modal.querySelector('.modal-option');
      if (firstOption) firstOption.focus();
    }, 100);
  }
}

// Close acquisition modal
function closeAcquisitionModal(completed = false) {
  const modal = document.getElementById('acquisitionModal');
  if (modal) {
    modal.classList.remove('active');
    modal.removeAttribute('aria-modal');
  }

  // Restore focus to previous element
  if (previousFocus && previousFocus.focus) {
    previousFocus.focus();
    previousFocus = null;
  }

  // If cancelled, revert the checkbox
  if (!completed && pendingAcquisition) {
    const { trophyId, tier } = pendingAcquisition;
    trackedStates[trophyId][tier] = false;

    // Sync global state
    window.trophyData = { trophies, trackedStates };

    // Uncheck the checkbox in UI
    const checkbox = document.querySelector(
      `input[data-trophy-id="${trophyId}"][data-tier="${tier}"]`
    );
    if (checkbox) {
      checkbox.checked = false;
    }

    // Revert in backend and update UI
    window.electronAPI.saveTrophyState(trophyId, tier, false);
    updateTotals();
    updateDashboard();
  }

  pendingAcquisition = null;
}

// Complete acquisition with chosen method
async function completeAcquisition(method) {
  if (!pendingAcquisition) return;

  const { trophyId, tier } = pendingAcquisition;
  const counter = killCounters[trophyId] || { count: 0, milestones: [] };

  try {
    // Record milestone
    const result = await window.electronAPI.recordMilestone(trophyId, tier, method, counter.count);

    if (result.success) {
      killCounters[trophyId] = result.counter;

      // Refresh global stats
      window.globalStats = await window.electronAPI.getGlobalStats();

      // Sync global state
      window.trophyData = { trophies, trackedStates };

      // Close modal and refresh display
      closeAcquisitionModal(true);
      filterAndRender();
      updateTotals();
      updateDashboard();

      const methodLabels = {
        collected: 'Collected',
        purchased: 'Purchased',
        gambled: 'Gambled'
      };
      uiHelpers.showToast(
        `${tier.charAt(0).toUpperCase() + tier.slice(1)} marked as ${methodLabels[method]}!`,
        'success'
      );
    }
  } catch (err) {
    console.error('Failed to record milestone:', err);
    uiHelpers.showToast('Failed to record acquisition', 'error');
    closeAcquisitionModal(false);
  }
}

// Handle checkbox state changes
async function handleCheckboxChange(trophyId, tier, checked, trophy) {
  // Update local state
  if (!trackedStates[trophyId]) {
    trackedStates[trophyId] = { base: false, enchanted: false, golden: false };
  }
  trackedStates[trophyId][tier] = checked;

  // Sync global state for other modules
  window.trophyData = { trophies, trackedStates };

  // If checking (obtaining), show acquisition modal
  if (checked) {
    try {
      const result = await window.electronAPI.saveTrophyState(trophyId, tier, checked);
      if (!result?.success) {
        throw new Error(result?.error || 'Save failed');
      }
      // Show modal to ask how they got it
      showAcquisitionModal(trophyId, tier, trophy);
    } catch (err) {
      console.error('Failed to save trophy state', err);
      trackedStates[trophyId][tier] = false;
      window.trophyData = { trophies, trackedStates };
      uiHelpers.showToast('Could not save trophy change', 'error');
      filterAndRender();
      return;
    }
  } else {
    // Unchecking - remove milestone
    try {
      await window.electronAPI.saveTrophyState(trophyId, tier, checked);
      await window.electronAPI.removeMilestone(trophyId, tier);

      // Update local state
      if (killCounters[trophyId]) {
        killCounters[trophyId].milestones = killCounters[trophyId].milestones.filter(
          (m) => m.tier !== tier
        );
      }

      filterAndRender();
    } catch (err) {
      console.error('Failed to save trophy state', err);
      trackedStates[trophyId][tier] = true;
      window.trophyData = { trophies, trackedStates };
      uiHelpers.showToast('Could not save trophy change', 'error');
      filterAndRender();
      return;
    }
  }

  updateTotals();
  updateDashboard();
}

// Render stat panel with 17 stat types
function renderStatPanel() {
  const container = document.getElementById('statBonusContainer');
  container.innerHTML = '';

  STAT_TYPES.forEach((statType) => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
            <span class="stat-name">${statType}:</span>
            <span class="stat-value" id="stat-${statType.replace(/\s+/g, '-')}">+0%</span>
        `;
    container.appendChild(row);
  });
}

// Update all totals and stat bonuses
function updateTotals() {
  // Count trophies by tier
  let baseCounted = 0;
  let goldenCounted = 0;
  let enchantedCounted = 0;
  let totalSilverSpent = 0;
  let totalRenownGained = 0;

  // Count total trophies with each tier available
  let baseTotalAvailable = 0;
  let goldenTotalAvailable = 0;
  let enchantedTotalAvailable = 0;

  // Aggregate stat bonuses
  const statTotals = {};
  STAT_TYPES.forEach((stat) => (statTotals[stat] = 0));

  trophies.forEach((trophy) => {
    const state = trackedStates[trophy.id];
    const availableTiers = trophy.tiers || ['Base', 'Golden', 'Enchanted'];

    // Count how many trophies have each tier available
    if (availableTiers.includes('Base')) baseTotalAvailable++;
    if (availableTiers.includes('Golden')) goldenTotalAvailable++;
    if (availableTiers.includes('Enchanted')) enchantedTotalAvailable++;

    if (!state) return;

    // Get bonuses (handle both single bonus and multiple bonuses)
    const bonuses = trophy.bonuses || (trophy.bonus ? [trophy.bonus] : []);

    if (state.base && availableTiers.includes('Base')) {
      baseCounted++;
      totalRenownGained += 10;
      // 0 silver for base
      bonuses.forEach((bonus) => addStatBonus(statTotals, bonus.stat, bonus.value));
    }
    if (state.golden && availableTiers.includes('Golden')) {
      goldenCounted++;
      totalRenownGained += 260; // 10 + 250
      totalSilverSpent += 5000000;
      bonuses.forEach((bonus) => addStatBonus(statTotals, bonus.stat, bonus.value));
    }
    if (state.enchanted && availableTiers.includes('Enchanted')) {
      enchantedCounted++;
      totalRenownGained += 510; // 10 + 250 + 250
      totalSilverSpent += 5000000;
      bonuses.forEach((bonus) => addStatBonus(statTotals, bonus.stat, bonus.value));
    }
  });

  // Calculate max possible renown (if all tiers collected)
  let maxRenown = 0;
  trophies.forEach((trophy) => {
    const availableTiers = trophy.tiers || ['Base', 'Golden', 'Enchanted'];
    if (availableTiers.includes('Base')) maxRenown += 10;
    if (availableTiers.includes('Golden')) maxRenown += 260;
    if (availableTiers.includes('Enchanted')) maxRenown += 510;
  });

  // Update tier counts - show only for trophies that have that tier
  document.getElementById('baseCount').textContent = `${baseCounted}/${baseTotalAvailable}`;
  document.getElementById('goldenCount').textContent = `${goldenCounted}/${goldenTotalAvailable}`;
  document.getElementById('enchantedCount').textContent =
    `${enchantedCounted}/${enchantedTotalAvailable}`;

  // Update progress bars
  const baseProgress = document.getElementById('baseProgress');
  const goldenProgress = document.getElementById('goldenProgress');
  const enchantedProgress = document.getElementById('enchantedProgress');

  if (baseProgress) {
    baseProgress.style.width = `${baseTotalAvailable > 0 ? (baseCounted / baseTotalAvailable) * 100 : 0}%`;
  }
  if (goldenProgress) {
    goldenProgress.style.width = `${goldenTotalAvailable > 0 ? (goldenCounted / goldenTotalAvailable) * 100 : 0}%`;
  }
  if (enchantedProgress) {
    enchantedProgress.style.width = `${enchantedTotalAvailable > 0 ? (enchantedCounted / enchantedTotalAvailable) * 100 : 0}%`;
  }

  // Update renown and silver
  document.getElementById('totalRenown').textContent = totalRenownGained.toLocaleString();
  const maxRenownEl = document.getElementById('trophyMaxRenown');
  if (maxRenownEl) {
    maxRenownEl.textContent = `/ ${maxRenown.toLocaleString()}`;
  }
  document.getElementById('totalSilver').textContent = totalSilverSpent.toLocaleString();

  // Update stat bonuses
  STAT_TYPES.forEach((statType) => {
    const elementId = `stat-${statType.replace(/\s+/g, '-')}`;
    const element = document.getElementById(elementId);
    if (element) {
      const value = statTotals[statType];
      element.textContent = `+${value}%`;
      if (value > 0) {
        element.classList.add('has-bonus');
      } else {
        element.classList.remove('has-bonus');
      }
    }
  });
}

// Update dashboard header with collection stats
async function updateDashboard() {
  // Get cosmetic data from cosmetics tab
  let cosmeticCollected = 0;
  let cosmeticTotal = 0;
  let cosmeticRenown = 0;
  let cosmeticMaxRenown = 0;

  try {
    const cosmeticStateData = (await window.electronAPI.getCosmeticsState()) || {};
    const cosmeticData = await window.electronAPI.getData();
    const cosmeticItems = cosmeticData?.cosmetics?.items || [];

    cosmeticTotal = cosmeticItems.length;
    cosmeticCollected = Object.values(cosmeticStateData).filter(
      (state) => state && state.collected
    ).length;

    // Calculate renown from collected cosmetics
    cosmeticRenown = cosmeticItems.reduce((sum, item) => {
      const state = cosmeticStateData[item.id];
      if (state && state.collected) {
        return sum + (item.renown || 0);
      }
      return sum;
    }, 0);

    // Calculate max cosmetic renown
    cosmeticMaxRenown = cosmeticItems.reduce((sum, item) => sum + (item.renown || 0), 0);
  } catch (err) {
    console.error('Failed to load cosmetic data for dashboard', err);
  }

  const cosmeticPct = cosmeticTotal > 0 ? Math.round((cosmeticCollected / cosmeticTotal) * 100) : 0;

  // Trophy stats
  const trophyCollected = Object.values(trackedStates).filter(
    (state) => state && (state.base || state.golden || state.enchanted)
  ).length;
  const trophyTotal = trophies.length;
  const trophyPct = trophyTotal > 0 ? Math.round((trophyCollected / trophyTotal) * 100) : 0;

  // Trophy renown from stat panel
  const trophyRenown =
    parseInt(
      (document.getElementById('totalRenown')?.textContent || '0').replaceAll(',', ''),
      10
    ) || 0;

  // Trophy max renown from stat panel
  const trophyMaxRenown =
    parseInt(
      (document.getElementById('trophyMaxRenown')?.textContent || '0')
        .replace('/', '')
        .replaceAll(',', '')
        .trim(),
      10
    ) || 0;

  const totalRenown = cosmeticRenown + trophyRenown;
  const totalMaxRenown = cosmeticMaxRenown + trophyMaxRenown;

  document.getElementById('trophyProgress').textContent = `${trophyPct}%`;
  document.getElementById('trophyCount').textContent = `${trophyCollected}/${trophyTotal}`;
  document.getElementById('cosmeticProgress').textContent = `${cosmeticPct}%`;
  document.getElementById('cosmeticCount').textContent = `${cosmeticCollected}/${cosmeticTotal}`;
  document.getElementById('renownTotal').textContent = totalRenown.toLocaleString();

  const renownMaxEl = document.getElementById('renownMax');
  if (renownMaxEl) {
    renownMaxEl.textContent = `${totalRenown.toLocaleString()}/${totalMaxRenown.toLocaleString()}`;
  }
}

// Make updateDashboard globally available
window.updateDashboard = updateDashboard;

// Parse and add stat bonus value
function addStatBonus(totals, statName, valueStr) {
  // Parse value string (e.g., "4%" -> 4)
  const numericValue = parseFloat(valueStr.replace('%', ''));
  if (!isNaN(numericValue) && totals[statName] !== undefined) {
    totals[statName] += numericValue;
  }
}

// Initialize on load
init();
