let cosmetics = [];
let cosmeticState = {};
let activeCosmeticCategory = ''; // Track active category tab

// Virtual scrolling state
let filteredCosmetics = [];
let scrollTop = 0;
const ITEM_HEIGHT = 100; // Approximate height of each cosmetic item in px
const BUFFER_ITEMS = 5; // Extra items to render above/below viewport

const helpers = window.uiHelpers || {
  showToast: () => {},
  setLoading: () => {},
  debounce: (fn) => fn
};

// Make globally accessible for dashboard
window.cosmeticData = { cosmetics: [], cosmeticState: {} };

function updateProgressBar(fillEl, textEl, item, stateForItem) {
  if (!fillEl) return;
  const mats = item.materials || [];
  if (!mats.length) {
    fillEl.style.width = '0%';
    if (textEl) textEl.textContent = '';
    return;
  }
  const progress = mats.reduce((pct, mat) => {
    const have = stateForItem?.materials?.[mat.name] || 0;
    const need = mat.quantity || 0;
    const part = need ? Math.min(have / need, 1) : 0;
    return pct + part * (100 / mats.length);
  }, 0);
  const pct = progress.toFixed(0);
  fillEl.style.width = `${pct}%`;
  if (textEl) {
    textEl.textContent = `${pct}%`;
  }
}

function isMaterialsComplete(item, state) {
  const mats = item.materials || [];
  if (!mats.length) return false;
  const counts = state?.materials || {};
  return mats.every((m) => (counts[m.name] || 0) >= (m.quantity || 0));
}

function isCollected(item, state) {
  const materialsComplete = isMaterialsComplete(item, state);
  return materialsComplete || !!state?.collected;
}

async function initCosmetics() {
  try {
    helpers.setLoading(true);
    const data = await window.electronAPI.getData();
    if (Array.isArray(data?.warnings)) {
      data.warnings.forEach((msg) => helpers.showToast(msg, 'error'));
    }
    cosmetics = data.cosmetics.items || [];
    cosmeticState = (await window.electronAPI.getCosmeticsState()) || {};

    // Update global data for dashboard
    window.cosmeticData = { cosmetics, cosmeticState };

    buildCategoryFilters();
    attachCosmeticFilterListeners();
    renderCosmetics();
    updateCosmeticTotals();

    // Update dashboard if function is available
    if (window.updateDashboard) {
      window.updateDashboard();
    }
  } catch (err) {
    console.error('Failed to init cosmetics', err);
    helpers.showToast('Failed to load cosmetics', 'error');
  } finally {
    helpers.setLoading(false);
  }
}

function buildCategoryFilters() {
  const level1 = new Set();
  const level2ByCategory = {};

  cosmetics.forEach((item) => {
    const cat = item.category || {};
    if (cat.level1) {
      level1.add(cat.level1);
      if (!level2ByCategory[cat.level1]) {
        level2ByCategory[cat.level1] = new Set();
      }
      if (cat.level2) {
        level2ByCategory[cat.level1].add(cat.level2);
      }
    }
  });

  // Build category tabs
  const tabsContainer = document.querySelector('.cosmetic-tabs');
  if (tabsContainer) {
    tabsContainer.innerHTML = '';
    const sortedL1 = Array.from(level1).sort();

    sortedL1.forEach((category, index) => {
      const tab = document.createElement('button');
      tab.className = `cosmetic-tab ${index === 0 ? 'active' : ''}`;
      tab.textContent = category;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      tab.dataset.category = category;
      tab.addEventListener('click', (e) => {
        // Update active state
        document.querySelectorAll('.cosmetic-tab').forEach((b) => {
          const isActive = b === e.target;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        activeCosmeticCategory = e.target.dataset.category;
        document.getElementById('cosmeticLevel2').value = '';
        updateLevel2Filter();
        renderCosmetics();
      });
      tabsContainer.appendChild(tab);
    });

    // Set initial active category
    if (sortedL1.length > 0) {
      activeCosmeticCategory = sortedL1[0];
    }
  }

  // Store level2 mapping for later
  window.cosmeticLevel2ByCategory = level2ByCategory;
}

function updateLevel2Filter() {
  const level2Select = document.getElementById('cosmeticLevel2');
  if (!level2Select) return;

  const level2Set = window.cosmeticLevel2ByCategory[activeCosmeticCategory] || new Set();
  level2Select.innerHTML = '<option value="">All</option>';
  [...level2Set].sort().forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    level2Select.appendChild(opt);
  });
}

function attachCosmeticFilterListeners() {
  ['cosmeticSearch', 'cosmeticLevel2', 'cosmeticLocation'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = el.tagName === 'INPUT' ? 'input' : 'change';
    const debounced = helpers.debounce(renderCosmetics, 150);
    el.addEventListener(evt, debounced);
  });

  // Setup virtual scroll listener
  const list = document.getElementById('cosmeticsListContainer');
  if (list) {
    list.addEventListener('scroll', helpers.debounce(handleVirtualScroll, 16));
  }
}

/**
 * Virtual scrolling handler - only re-renders when scroll position changes significantly
 */
function handleVirtualScroll() {
  const list = document.getElementById('cosmeticsListContainer');
  if (!list) return;

  const newScrollTop = list.scrollTop;
  const scrollDelta = Math.abs(newScrollTop - scrollTop);

  // Only re-render if scrolled more than half an item height
  if (scrollDelta > ITEM_HEIGHT / 2) {
    scrollTop = newScrollTop;
    renderVisibleItems();
  }
}

/**
 * Calculates visible range based on scroll position
 */
function getVisibleRange(containerHeight) {
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS);
  const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT) + BUFFER_ITEMS * 2;
  const endIndex = Math.min(filteredCosmetics.length, startIndex + visibleCount);
  return { startIndex, endIndex };
}

/**
 * Creates a single cosmetic item element
 */
function createCosmeticItem(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'cosmetic-item';
  wrapper.setAttribute('role', 'listitem');
  wrapper.setAttribute('aria-label', item.name);
  wrapper.dataset.id = item.id;

  // Image thumbnail
  const thumbnail = document.createElement('img');
  thumbnail.className = 'cosmetic-thumbnail';
  thumbnail.alt = item.name;
  thumbnail.loading = 'lazy';

  const categoryFolder = (item.category?.level1 || 'outfit').toLowerCase().replace(/\s+/g, '-');
  const imageName = item.id || item.name.toLowerCase().replace(/\s+/g, '_');
  thumbnail.src = `../assets/cosmetics/${categoryFolder}/${imageName}.png`;
  thumbnail.onerror = () => {
    thumbnail.src = '../assets/cooking.png';
  };
  wrapper.appendChild(thumbnail);

  const info = document.createElement('div');
  info.className = 'cosmetic-info';
  const categoryPath = item.categoryPath || '';
  info.innerHTML = `
    <div class="cosmetic-name">${item.name}</div>
    <div class="cosmetic-meta">${categoryPath}</div>
    <div class="cosmetic-renown">Renown: ${item.renown ?? 0}</div>
  `;

  const mats = item.materials || [];
  let progressFill = null;
  let progressText = null;

  if (mats.length > 0) {
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressText = document.createElement('span');
    progressText.className = 'progress-text';
    progressBar.appendChild(progressFill);
    progressBar.appendChild(progressText);
    info.appendChild(progressBar);
    updateProgressBar(progressFill, progressText, item, cosmeticState[item.id]);
  }

  const materials = document.createElement('div');
  materials.className = 'cosmetic-materials';
  const materialInputs = [];

  if (mats.length) {
    mats.forEach((mat) => {
      const pill = document.createElement('div');
      pill.className = 'material-pill material-row';
      const label = document.createElement('span');
      label.textContent = `${mat.name} x${mat.quantity}`;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = 0;
      input.max = mat.quantity || 9999;
      input.setAttribute('aria-label', `${mat.name} quantity for ${item.name}`);
      const current = cosmeticState[item.id]?.materials?.[mat.name] || 0;
      input.value = current;
      input.addEventListener('input', async (e) => {
        const val = Math.max(
          0,
          Math.min(parseInt(e.target.value || '0', 10), mat.quantity || 9999)
        );
        e.target.value = val;
        cosmeticState[item.id] = cosmeticState[item.id] || {};
        cosmeticState[item.id].materials = cosmeticState[item.id].materials || {};
        cosmeticState[item.id].materials[mat.name] = val;
        const materialsComplete = isMaterialsComplete(item, cosmeticState[item.id]);
        if (materialsComplete) {
          cosmeticState[item.id].collected = true;
        }
        try {
          const res = await window.electronAPI.saveCosmeticsState(item.id, cosmeticState[item.id]);
          if (!res?.success) {
            throw new Error(res?.error || 'Save failed');
          }
          window.cosmeticData.cosmeticState = cosmeticState;
          checkbox.checked = isCollected(item, cosmeticState[item.id]);
          updateCosmeticTotals(filteredCosmetics);
          updateProgressBar(progressFill, progressText, item, cosmeticState[item.id]);
          if (window.updateDashboard) {
            window.updateDashboard();
          }
        } catch (saveErr) {
          console.error('Failed to save cosmetic materials', saveErr);
          helpers.showToast('Could not save materials update', 'error');
        }
      });
      materialInputs.push({ input, mat });
      pill.appendChild(label);
      pill.appendChild(input);
      materials.appendChild(pill);
    });
    info.appendChild(materials);
  }

  const actions = document.createElement('div');
  actions.className = 'cosmetic-actions';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isCollected(item, cosmeticState[item.id]);
  checkbox.setAttribute('aria-label', `Collected ${item.name}`);
  checkbox.addEventListener('change', async (e) => {
    const collected = e.target.checked;
    cosmeticState[item.id] = cosmeticState[item.id] || {};
    cosmeticState[item.id].collected = collected;
    if (collected) {
      cosmeticState[item.id].materials = cosmeticState[item.id].materials || {};
      materialInputs.forEach(({ input, mat }) => {
        const maxVal = mat.quantity || 0;
        input.value = maxVal;
        cosmeticState[item.id].materials[mat.name] = maxVal;
      });
    }
    try {
      const res = await window.electronAPI.saveCosmeticsState(item.id, cosmeticState[item.id]);
      if (!res?.success) {
        throw new Error(res?.error || 'Save failed');
      }
      window.cosmeticData.cosmeticState = cosmeticState;
      updateCosmeticTotals(filteredCosmetics);
      if (mats.length > 0 && progressFill && progressText) {
        updateProgressBar(progressFill, progressText, item, cosmeticState[item.id]);
      }
      if (window.updateDashboard) {
        window.updateDashboard();
      }
    } catch (saveErr) {
      console.error('Failed to save cosmetic state', saveErr);
      helpers.showToast('Could not save cosmetic state', 'error');
      e.target.checked = !collected;
    }
  });
  const labelEl = document.createElement('label');
  labelEl.appendChild(checkbox);
  labelEl.appendChild(document.createTextNode(' Collected'));
  actions.appendChild(labelEl);

  wrapper.appendChild(info);
  wrapper.appendChild(actions);

  return wrapper;
}

/**
 * Renders only the visible items in the viewport (virtual scrolling)
 */
function renderVisibleItems() {
  const list = document.getElementById('cosmeticsListContainer');
  if (!list || filteredCosmetics.length === 0) return;

  const containerHeight = list.clientHeight;
  const { startIndex, endIndex } = getVisibleRange(containerHeight);

  // Get or create the virtual scroll container
  let content = list.querySelector('.virtual-scroll-content');
  if (!content) {
    content = document.createElement('div');
    content.className = 'virtual-scroll-content';
    list.appendChild(content);
  }

  // Set total height for scrollbar
  const totalHeight = filteredCosmetics.length * ITEM_HEIGHT;
  content.style.height = `${totalHeight}px`;
  content.style.position = 'relative';

  // Clear and render visible items
  content.innerHTML = '';

  const fragment = document.createDocumentFragment();
  for (let i = startIndex; i < endIndex; i++) {
    const item = filteredCosmetics[i];
    if (!item) continue;

    const element = createCosmeticItem(item);
    element.style.position = 'absolute';
    element.style.top = `${i * ITEM_HEIGHT}px`;
    element.style.left = '0';
    element.style.right = '0';
    fragment.appendChild(element);
  }
  content.appendChild(fragment);
}

/**
 * Main render function - filters data and triggers virtual scroll render
 */
function renderCosmetics() {
  const search = (document.getElementById('cosmeticSearch')?.value || '').toLowerCase();
  const l2 = document.getElementById('cosmeticLevel2')?.value || '';
  const location = document.getElementById('cosmeticLocation')?.value || '';

  const list = document.getElementById('cosmeticsListContainer');
  if (!list) return;

  // Reset scroll position when filters change
  scrollTop = 0;
  list.scrollTop = 0;

  // Filter cosmetics
  filteredCosmetics = cosmetics.filter((item) => {
    const cat = item.category || {};
    if (cat.level1 !== activeCosmeticCategory) return false;
    if (search && !item.name.toLowerCase().includes(search)) return false;
    if (l2 && cat.level2 !== l2) return false;
    if (location && item.location !== location) return false;
    return true;
  });

  list.innerHTML = '';
  list.setAttribute('role', 'list');

  if (filteredCosmetics.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-message';
    empty.textContent = 'No cosmetics match the filters';
    list.appendChild(empty);
    updateCosmeticTotals(filteredCosmetics);
    return;
  }

  // Render visible items using virtual scrolling
  renderVisibleItems();
  updateCosmeticTotals(filteredCosmetics);

  if (window.updateDashboard) {
    window.updateDashboard();
  }
}

function updateCosmeticTotals(filteredItems = cosmetics) {
  const collected = filteredItems.filter((item) =>
    isCollected(item, cosmeticState[item.id])
  ).length;
  const total = filteredItems.length;
  const renown = filteredItems.reduce(
    (sum, item) => sum + (isCollected(item, cosmeticState[item.id]) ? item.renown || 0 : 0),
    0
  );

  const collectedEl = document.getElementById('cosmeticCollectedCount');
  const renownEl = document.getElementById('cosmeticRenownTotal');
  if (collectedEl) collectedEl.textContent = `${collected}/${total}`;
  if (renownEl) renownEl.textContent = renown.toLocaleString();
}

// kick off after DOM ready
document.addEventListener('DOMContentLoaded', initCosmetics);
