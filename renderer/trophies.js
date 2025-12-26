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
let activeTrophyType = 'Creature Trophies'; // Track active sub-tab

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

    // Update global data for dashboard
    window.trophyData = { trophies, trackedStates };

    // Render UI
    renderTrophyList();
    renderStatPanel();
    updateTotals();

    // Setup filter listeners
    const debouncedFilter = uiHelpers.debounce(filterAndRender, 150);
    document.getElementById('statusFilter').addEventListener('change', debouncedFilter);
    document.getElementById('categoryFilter').addEventListener('change', debouncedFilter);

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

    updateCategoryFilterVisibility();

    // Trophy filter listeners
    const trophySearchInput = document.getElementById('trophySearch');
    if (trophySearchInput) {
      trophySearchInput.addEventListener(
        'input',
        uiHelpers.debounce(() => filterAndRender())
      );
    }

    const tierFilterSelect = document.getElementById('tierFilter');
    if (tierFilterSelect) {
      tierFilterSelect.addEventListener('change', () => filterAndRender());
    }

    const statusFilterSelect = document.getElementById('statusFilter');
    if (statusFilterSelect) {
      statusFilterSelect.addEventListener('change', () => filterAndRender());
    }

    const categoryFilterSelect = document.getElementById('categoryFilter');
    if (categoryFilterSelect) {
      categoryFilterSelect.addEventListener('change', () => filterAndRender());
    }

    const reloadBtn = document.getElementById('reloadDataBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', async () => {
        uiHelpers.setLoading(true);
        try {
          const fresh = await window.electronAPI.reloadData();
          if (Array.isArray(fresh?.warnings)) {
            fresh.warnings.forEach((msg) => uiHelpers.showToast(msg, 'error'));
          }
          trophies = (fresh.trophies.items || []).map((t) => ({
            ...t,
            type: t.type || 'Creature Trophies'
          }));
          filterAndRender();
          uiHelpers.showToast('Data reloaded', 'success');
        } catch (err) {
          console.error('Reload failed', err);
          uiHelpers.showToast('Reload failed', 'error');
        } finally {
          uiHelpers.setLoading(false);
        }
      });
    }

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

    if (window.electronAPI.onAlert) {
      window.electronAPI.onAlert((payload) => {
        if (payload?.type === 'reset') {
          uiHelpers.showToast(payload.message || 'Daily reset', 'info');
        }
      });
    }
  } catch (error) {
    console.error('Failed to initialize:', error);
    uiHelpers.showToast('Failed to load trophy data', 'error');
  } finally {
    uiHelpers.setLoading(false);
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

  renderTrophyList(filtered);
  updateDashboard();
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
        handleCheckboxChange(trophy.id, tier, e.target.checked);
      });

      group.appendChild(label);
      group.appendChild(checkbox);
      checkboxes.appendChild(group);
    });

    item.appendChild(info);
    item.appendChild(checkboxes);
    container.appendChild(item);
  });
}

// Handle checkbox state changes
async function handleCheckboxChange(trophyId, tier, checked) {
  // Update local state
  if (!trackedStates[trophyId]) {
    trackedStates[trophyId] = { base: false, enchanted: false, golden: false };
  }
  trackedStates[trophyId][tier] = checked;

  try {
    const result = await window.electronAPI.saveTrophyState(trophyId, tier, checked);
    if (!result?.success) {
      throw new Error(result?.error || 'Save failed');
    }
  } catch (err) {
    console.error('Failed to save trophy state', err);
    trackedStates[trophyId][tier] = !checked; // revert local state
    uiHelpers.showToast('Could not save trophy change', 'error');
    filterAndRender();
    return;
  }

  updateTotals();
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

  // Update tier counts - show only for trophies that have that tier
  document.getElementById('baseCount').textContent = `${baseCounted}/${baseTotalAvailable}`;
  document.getElementById('goldenCount').textContent = `${goldenCounted}/${goldenTotalAvailable}`;
  document.getElementById('enchantedCount').textContent =
    `${enchantedCounted}/${enchantedTotalAvailable}`;

  // Update renown and silver
  document.getElementById('totalRenown').textContent = totalRenownGained.toLocaleString();
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

  const totalRenown = cosmeticRenown + trophyRenown;

  document.getElementById('trophyProgress').textContent = `${trophyPct}%`;
  document.getElementById('trophyCount').textContent = `${trophyCollected}/${trophyTotal}`;
  document.getElementById('cosmeticProgress').textContent = `${cosmeticPct}%`;
  document.getElementById('cosmeticCount').textContent = `${cosmeticCollected}/${cosmeticTotal}`;
  document.getElementById('renownTotal').textContent = totalRenown.toLocaleString();
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
