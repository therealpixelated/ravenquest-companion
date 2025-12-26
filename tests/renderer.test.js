/**
 * @jest-environment jsdom
 */

// Mock the electronAPI before importing anything
const mockElectronAPI = {
  getData: jest.fn(),
  getTrophyStates: jest.fn(),
  saveTrophyState: jest.fn(),
  getCosmeticsState: jest.fn(),
  saveCosmeticsState: jest.fn(),
  getOverlayOpacity: jest.fn(),
  setOverlayOpacity: jest.fn(),
  onAlert: jest.fn()
};

// Setup window.electronAPI before tests
beforeAll(() => {
  Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true
  });
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
});

describe('UI Helpers', () => {
  // Import uiHelpers from trophies.js inline setup
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
    }
  };

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('delays function execution', () => {
      const fn = jest.fn();
      const debounced = uiHelpers.debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('only calls function once for rapid calls', () => {
      const fn = jest.fn();
      const debounced = uiHelpers.debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('passes arguments to debounced function', () => {
      const fn = jest.fn();
      const debounced = uiHelpers.debounce(fn, 100);

      debounced('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('setLoading', () => {
    test('shows loading overlay when true', () => {
      document.body.innerHTML = '<div id="loadingOverlay" style="display: none;"></div>';

      uiHelpers.setLoading(true);

      const overlay = document.getElementById('loadingOverlay');
      expect(overlay.style.display).toBe('flex');
      expect(document.body.dataset.loading).toBe('true');
    });

    test('hides loading overlay when false', () => {
      document.body.innerHTML = '<div id="loadingOverlay" style="display: flex;"></div>';

      uiHelpers.setLoading(false);

      const overlay = document.getElementById('loadingOverlay');
      expect(overlay.style.display).toBe('none');
      expect(document.body.dataset.loading).toBe('false');
    });

    test('handles missing overlay gracefully', () => {
      expect(() => uiHelpers.setLoading(true)).not.toThrow();
    });
  });

  describe('showToast', () => {
    test('creates toast with correct class and message', () => {
      document.body.innerHTML = '<div id="toastContainer"></div>';

      uiHelpers.showToast('Test message', 'success');

      const toast = document.querySelector('.toast');
      expect(toast).not.toBeNull();
      expect(toast.classList.contains('toast-success')).toBe(true);
      expect(toast.textContent).toBe('Test message');
    });

    test('defaults to info type', () => {
      document.body.innerHTML = '<div id="toastContainer"></div>';

      uiHelpers.showToast('Info message');

      const toast = document.querySelector('.toast');
      expect(toast.classList.contains('toast-info')).toBe(true);
    });

    test('handles missing container gracefully', () => {
      expect(() => uiHelpers.showToast('Test')).not.toThrow();
    });
  });
});

describe('Trophy Filtering Logic', () => {
  const sampleTrophies = [
    {
      id: 'arachnid_trophy',
      name: 'Arachnid Trophy',
      type: 'Creature Trophies',
      category: 'Naturals',
      bonuses: [{ stat: 'Precision', value: '4%' }]
    },
    {
      id: 'demon_trophy',
      name: 'Demon Trophy',
      type: 'Creature Trophies',
      category: 'Outsiders',
      bonuses: [{ stat: 'Impact', value: '4%' }]
    },
    {
      id: 'shark_trophy',
      name: 'Shark Trophy',
      type: 'Ocean Trophies',
      category: 'Naturals',
      bonuses: [{ stat: 'Might', value: '2%' }]
    }
  ];

  // Filtering function extracted from trophies.js logic
  function filterTrophies(trophies, { type, category, status }, trackedStates) {
    return trophies.filter((trophy) => {
      // Type filter
      if (trophy.type !== type) return false;

      // Category filter
      if (category && trophy.category !== category) return false;

      // Status filter
      if (status === 'collected') {
        const state = trackedStates[trophy.id];
        if (!state || (!state.base && !state.golden && !state.enchanted)) {
          return false;
        }
      } else if (status === 'missing') {
        const state = trackedStates[trophy.id];
        if (state && (state.base || state.golden || state.enchanted)) {
          return false;
        }
      }

      return true;
    });
  }

  test('filters by trophy type', () => {
    const result = filterTrophies(
      sampleTrophies,
      { type: 'Creature Trophies', category: '', status: '' },
      {}
    );

    expect(result).toHaveLength(2);
    expect(result.every((t) => t.type === 'Creature Trophies')).toBe(true);
  });

  test('filters by category', () => {
    const result = filterTrophies(
      sampleTrophies,
      { type: 'Creature Trophies', category: 'Naturals', status: '' },
      {}
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('arachnid_trophy');
  });

  test('filters by collected status', () => {
    const trackedStates = {
      arachnid_trophy: { base: true, golden: false, enchanted: false }
    };

    const result = filterTrophies(
      sampleTrophies,
      { type: 'Creature Trophies', category: '', status: 'collected' },
      trackedStates
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('arachnid_trophy');
  });

  test('filters by missing status', () => {
    const trackedStates = {
      arachnid_trophy: { base: true, golden: false, enchanted: false }
    };

    const result = filterTrophies(
      sampleTrophies,
      { type: 'Creature Trophies', category: '', status: 'missing' },
      trackedStates
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('demon_trophy');
  });

  test('returns empty array when no matches', () => {
    const result = filterTrophies(
      sampleTrophies,
      { type: 'Carnival Trophies', category: '', status: '' },
      {}
    );

    expect(result).toHaveLength(0);
  });
});

describe('Trophy Stat Calculations', () => {
  // Stat calculation logic extracted from trophies.js
  function calculateStatTotals(trophies, trackedStates) {
    const totals = {};

    trophies.forEach((trophy) => {
      const state = trackedStates[trophy.id];
      if (!state) return;

      const tiers = ['base', 'golden', 'enchanted'];
      const collectedTiers = tiers.filter((t) => state[t]);

      if (collectedTiers.length === 0) return;

      const bonuses = trophy.bonuses || [];
      bonuses.forEach((bonus) => {
        const value = parseFloat(bonus.value) || 0;
        // Each collected tier adds the bonus
        const totalValue = value * collectedTiers.length;

        if (!totals[bonus.stat]) {
          totals[bonus.stat] = 0;
        }
        totals[bonus.stat] += totalValue;
      });
    });

    return totals;
  }

  test('calculates stat totals for collected trophies', () => {
    const trophies = [
      {
        id: 'test1',
        bonuses: [{ stat: 'Precision', value: '4%' }]
      }
    ];
    const states = {
      test1: { base: true, golden: false, enchanted: false }
    };

    const result = calculateStatTotals(trophies, states);

    expect(result.Precision).toBe(4);
  });

  test('stacks bonuses across tiers', () => {
    const trophies = [
      {
        id: 'test1',
        bonuses: [{ stat: 'Precision', value: '4%' }]
      }
    ];
    const states = {
      test1: { base: true, golden: true, enchanted: true }
    };

    const result = calculateStatTotals(trophies, states);

    expect(result.Precision).toBe(12); // 4 * 3 tiers
  });

  test('handles multiple bonuses per trophy', () => {
    const trophies = [
      {
        id: 'test1',
        bonuses: [
          { stat: 'Dexterity', value: '2%' },
          { stat: 'Wisdom', value: '1%' }
        ]
      }
    ];
    const states = {
      test1: { base: true, golden: false, enchanted: false }
    };

    const result = calculateStatTotals(trophies, states);

    expect(result.Dexterity).toBe(2);
    expect(result.Wisdom).toBe(1);
  });

  test('returns empty object when no trophies collected', () => {
    const trophies = [
      {
        id: 'test1',
        bonuses: [{ stat: 'Precision', value: '4%' }]
      }
    ];
    const states = {};

    const result = calculateStatTotals(trophies, states);

    expect(Object.keys(result)).toHaveLength(0);
  });
});
