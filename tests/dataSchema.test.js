const { normalizeCosmetics, normalizeTrophies } = require('../src/dataNormalize');

describe('Data Normalization Schema', () => {
  test('cosmetics normalization ensures id, renown, materials', () => {
    const input = { items: [{ name: 'Magic Hat', renown: '5', materials: 'invalid' }] };
    const out = normalizeCosmetics(input);
    expect(out.items[0].id).toBe('magic_hat');
    expect(out.items[0].renown).toBe(5);
    expect(Array.isArray(out.items[0].materials)).toBe(true);
  });

  test('trophies normalization ensures id, type, tiers', () => {
    const input = { items: [{ name: 'Goblin Trophy' }] };
    const out = normalizeTrophies(input);
    expect(out.items[0].id).toBe('goblin_trophy');
    expect(out.items[0].type).toBe('Creature Trophies');
    expect(Array.isArray(out.items[0].tiers)).toBe(true);
  });
});
