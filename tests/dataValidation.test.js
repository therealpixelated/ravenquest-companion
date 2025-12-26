const { validateItems } = require('../src/dataValidation');

describe('validateItems', () => {
  test('flags missing items array', () => {
    const warnings = [];
    const result = validateItems('file.json', {}, ['name'], warnings);
    expect(result.items).toEqual([]);
    expect(warnings[0]).toMatch(/missing items array/);
  });

  test('flags missing required fields and id', () => {
    const warnings = [];
    const data = { items: [{ id: 'a', name: 'ok' }, { name: 'no-id' }, { id: 'c' }] };
    validateItems('file.json', data, ['name'], warnings);
    expect(warnings[0]).toMatch(/missing required fields/);
  });

  test('passes when items and fields are present', () => {
    const warnings = [];
    const data = {
      items: [
        { id: '1', name: 'One' },
        { id: '2', name: 'Two' }
      ]
    };
    const result = validateItems('file.json', data, ['name'], warnings);
    expect(result.items.length).toBe(2);
    expect(warnings.length).toBe(0);
  });
});
