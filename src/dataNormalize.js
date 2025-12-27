// Normalize data structures loaded from JSON for consistent usage across the app
// Keeps IDs, field names, and types consistent.

function normalizeCosmetics(cosmetics) {
  const items = (cosmetics?.items || []).map((item) => {
    const id = item.id || String(item.name).toLowerCase().replace(/\s+/g, '_');
    const renown = Number(item.renown || 0);
    const categoryPath = typeof item.categoryPath === 'string' ? item.categoryPath : '';
    const materials = Array.isArray(item.materials) ? item.materials : [];
    return { ...item, id, renown, categoryPath, materials };
  });
  return { ...cosmetics, items };
}

function normalizeTrophies(trophies) {
  const items = (trophies?.items || []).map((item) => {
    const id = item.id || String(item.name).toLowerCase().replace(/\s+/g, '_');
    const type = item.type || 'Creature Trophies';
    const tiers = Array.isArray(item.tiers) ? item.tiers : ['Base', 'Golden', 'Enchanted'];
    let bonuses = [];
    if (Array.isArray(item.bonuses)) {
      bonuses = item.bonuses;
    } else if (item.bonus) {
      bonuses = [
        { stat: String(item.bonus.stat || 'Unknown'), value: String(item.bonus.value || '') }
      ];
    }
    const creature = typeof item.creature === 'string' ? item.creature : '';
    return { ...item, id, type, tiers, bonuses, creature };
  });
  return { ...trophies, items };
}

module.exports = {
  normalizeCosmetics,
  normalizeTrophies
};
