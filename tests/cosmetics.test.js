/**
 * @jest-environment jsdom
 */

describe('Cosmetics Logic', () => {
  describe('Material Progress Calculation', () => {
    // Function extracted from cosmetics.js
    function calculateMaterialProgress(materials, stateForItem) {
      if (!materials || !materials.length) return 0;

      const progress = materials.reduce((pct, mat) => {
        const have = stateForItem?.materials?.[mat.name] || 0;
        const need = mat.quantity || 0;
        const part = need ? Math.min(have / need, 1) : 0;
        return pct + part * (100 / materials.length);
      }, 0);

      return Math.round(progress);
    }

    test('returns 0 for empty materials', () => {
      expect(calculateMaterialProgress([], {})).toBe(0);
      expect(calculateMaterialProgress(null, {})).toBe(0);
    });

    test('calculates progress for single material', () => {
      const materials = [{ name: 'Gold Ore', quantity: 10 }];
      const state = { materials: { 'Gold Ore': 5 } };

      expect(calculateMaterialProgress(materials, state)).toBe(50);
    });

    test('calculates progress for multiple materials', () => {
      const materials = [
        { name: 'Gold Ore', quantity: 10 },
        { name: 'Silver Ore', quantity: 10 }
      ];
      const state = {
        materials: {
          'Gold Ore': 10, // 100%
          'Silver Ore': 5 // 50%
        }
      };

      // (100 + 50) / 2 = 75
      expect(calculateMaterialProgress(materials, state)).toBe(75);
    });

    test('caps individual material at 100%', () => {
      const materials = [{ name: 'Gold Ore', quantity: 10 }];
      const state = { materials: { 'Gold Ore': 20 } }; // Over max

      expect(calculateMaterialProgress(materials, state)).toBe(100);
    });

    test('handles missing material state gracefully', () => {
      const materials = [{ name: 'Gold Ore', quantity: 10 }];

      expect(calculateMaterialProgress(materials, null)).toBe(0);
      expect(calculateMaterialProgress(materials, {})).toBe(0);
      expect(calculateMaterialProgress(materials, { materials: {} })).toBe(0);
    });
  });

  describe('Materials Complete Check', () => {
    // Function extracted from cosmetics.js
    function isMaterialsComplete(item, state) {
      const mats = item.materials || [];
      if (!mats.length) return false;
      const counts = state?.materials || {};
      return mats.every((m) => (counts[m.name] || 0) >= (m.quantity || 0));
    }

    test('returns false for item with no materials', () => {
      expect(isMaterialsComplete({ materials: [] }, {})).toBe(false);
      expect(isMaterialsComplete({}, {})).toBe(false);
    });

    test('returns true when all materials complete', () => {
      const item = {
        materials: [
          { name: 'Gold', quantity: 10 },
          { name: 'Silver', quantity: 5 }
        ]
      };
      const state = {
        materials: { Gold: 10, Silver: 5 }
      };

      expect(isMaterialsComplete(item, state)).toBe(true);
    });

    test('returns true when materials exceed required', () => {
      const item = {
        materials: [{ name: 'Gold', quantity: 10 }]
      };
      const state = {
        materials: { Gold: 20 }
      };

      expect(isMaterialsComplete(item, state)).toBe(true);
    });

    test('returns false when any material incomplete', () => {
      const item = {
        materials: [
          { name: 'Gold', quantity: 10 },
          { name: 'Silver', quantity: 5 }
        ]
      };
      const state = {
        materials: { Gold: 10, Silver: 3 }
      };

      expect(isMaterialsComplete(item, state)).toBe(false);
    });

    test('handles missing state gracefully', () => {
      const item = {
        materials: [{ name: 'Gold', quantity: 10 }]
      };

      expect(isMaterialsComplete(item, null)).toBe(false);
      expect(isMaterialsComplete(item, {})).toBe(false);
    });
  });

  describe('isCollected Check', () => {
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

    test('returns true if manually marked collected', () => {
      const item = { materials: [] };
      const state = { collected: true };

      expect(isCollected(item, state)).toBe(true);
    });

    test('returns true if materials complete', () => {
      const item = {
        materials: [{ name: 'Gold', quantity: 10 }]
      };
      const state = {
        collected: false,
        materials: { Gold: 10 }
      };

      expect(isCollected(item, state)).toBe(true);
    });

    test('returns false if not collected and materials incomplete', () => {
      const item = {
        materials: [{ name: 'Gold', quantity: 10 }]
      };
      const state = {
        collected: false,
        materials: { Gold: 5 }
      };

      expect(isCollected(item, state)).toBe(false);
    });

    test('returns false for null state', () => {
      const item = { materials: [] };

      expect(isCollected(item, null)).toBe(false);
      expect(isCollected(item, undefined)).toBe(false);
    });
  });

  describe('Cosmetic Filtering', () => {
    const sampleCosmetics = [
      {
        id: 'magic_sigils',
        name: 'Magic Sigils',
        category: { level1: 'Outfit', level2: 'Body' },
        location: 'Quest',
        renown: 100
      },
      {
        id: 'ocean_helm',
        name: 'Ocean Helm',
        category: { level1: 'Outfit', level2: 'Head' },
        location: 'Ocean',
        renown: 50
      },
      {
        id: 'fire_moa',
        name: 'Fire Moa',
        category: { level1: 'Moa', level2: 'Skin' },
        location: 'Event',
        renown: 200
      }
    ];

    function filterCosmetics(cosmetics, { activeCategory, search, level2, location }) {
      return cosmetics.filter((item) => {
        const cat = item.category || {};
        if (cat.level1 !== activeCategory) return false;
        if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (level2 && cat.level2 !== level2) return false;
        if (location && item.location !== location) return false;
        return true;
      });
    }

    test('filters by category level1', () => {
      const result = filterCosmetics(sampleCosmetics, {
        activeCategory: 'Outfit',
        search: '',
        level2: '',
        location: ''
      });

      expect(result).toHaveLength(2);
      expect(result.every((c) => c.category.level1 === 'Outfit')).toBe(true);
    });

    test('filters by search term', () => {
      const result = filterCosmetics(sampleCosmetics, {
        activeCategory: 'Outfit',
        search: 'magic',
        level2: '',
        location: ''
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('magic_sigils');
    });

    test('filters by level2 subcategory', () => {
      const result = filterCosmetics(sampleCosmetics, {
        activeCategory: 'Outfit',
        search: '',
        level2: 'Head',
        location: ''
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ocean_helm');
    });

    test('filters by location', () => {
      const result = filterCosmetics(sampleCosmetics, {
        activeCategory: 'Outfit',
        search: '',
        level2: '',
        location: 'Quest'
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('magic_sigils');
    });

    test('combines multiple filters', () => {
      const result = filterCosmetics(sampleCosmetics, {
        activeCategory: 'Outfit',
        search: 'ocean',
        level2: 'Head',
        location: 'Ocean'
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ocean_helm');
    });

    test('returns empty when no matches', () => {
      const result = filterCosmetics(sampleCosmetics, {
        activeCategory: 'Outfit',
        search: 'nonexistent',
        level2: '',
        location: ''
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('Renown Calculation', () => {
    function calculateTotalRenown(cosmetics, cosmeticState) {
      return cosmetics.reduce((sum, item) => {
        const state = cosmeticState[item.id];
        const isCollected = state?.collected || false;
        return sum + (isCollected ? item.renown || 0 : 0);
      }, 0);
    }

    test('sums renown for collected items', () => {
      const cosmetics = [
        { id: 'item1', renown: 100 },
        { id: 'item2', renown: 50 },
        { id: 'item3', renown: 200 }
      ];
      const state = {
        item1: { collected: true },
        item3: { collected: true }
      };

      expect(calculateTotalRenown(cosmetics, state)).toBe(300);
    });

    test('returns 0 when nothing collected', () => {
      const cosmetics = [
        { id: 'item1', renown: 100 },
        { id: 'item2', renown: 50 }
      ];

      expect(calculateTotalRenown(cosmetics, {})).toBe(0);
    });

    test('handles items without renown', () => {
      const cosmetics = [
        { id: 'item1', renown: 100 },
        { id: 'item2' } // No renown field
      ];
      const state = {
        item1: { collected: true },
        item2: { collected: true }
      };

      expect(calculateTotalRenown(cosmetics, state)).toBe(100);
    });
  });
});

describe('Virtual Scrolling', () => {
  const ITEM_HEIGHT = 100;
  const BUFFER_ITEMS = 5;

  function getVisibleRange(scrollTop, containerHeight, totalItems) {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS);
    const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT) + BUFFER_ITEMS * 2;
    const endIndex = Math.min(totalItems, startIndex + visibleCount);
    return { startIndex, endIndex };
  }

  test('calculates correct range at top of list', () => {
    const { startIndex, endIndex } = getVisibleRange(0, 500, 100);

    expect(startIndex).toBe(0);
    expect(endIndex).toBeLessThanOrEqual(20); // 5 visible + 5 buffer
  });

  test('calculates correct range when scrolled', () => {
    const { startIndex, endIndex } = getVisibleRange(1000, 500, 100);

    // scrollTop 1000 / height 100 = item 10, minus buffer 5 = 5
    expect(startIndex).toBe(5);
    expect(endIndex).toBeLessThanOrEqual(25);
  });

  test('clamps to list bounds', () => {
    const { startIndex, endIndex } = getVisibleRange(9000, 500, 100);

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBe(100);
  });

  test('handles small lists', () => {
    const { startIndex, endIndex } = getVisibleRange(0, 500, 5);

    expect(startIndex).toBe(0);
    expect(endIndex).toBe(5);
  });
});
