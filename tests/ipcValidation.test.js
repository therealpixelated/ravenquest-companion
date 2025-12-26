const {
  isNonEmptyString,
  validateToggleCollected,
  validateTrophyState,
  validateCosmeticId
} = require('../src/ipcValidation');

describe('ipcValidation', () => {
  test('isNonEmptyString enforces trimmed content', () => {
    expect(isNonEmptyString('abc')).toBe(true);
    expect(isNonEmptyString('  abc  ')).toBe(true);
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
  });

  test('validateToggleCollected requires type and id', () => {
    expect(validateToggleCollected({ type: 't', id: '1' }).success).toBe(true);
    expect(validateToggleCollected({ type: '', id: '1' }).success).toBe(false);
    expect(validateToggleCollected({ id: '1' }).success).toBe(false);
  });

  test('validateTrophyState requires id and tier', () => {
    expect(validateTrophyState('abc', 'base').success).toBe(true);
    expect(validateTrophyState('', 'base').success).toBe(false);
    expect(validateTrophyState('abc', '').success).toBe(false);
  });

  test('validateCosmeticId requires id', () => {
    expect(validateCosmeticId('cos-1').success).toBe(true);
    expect(validateCosmeticId(' ').success).toBe(false);
  });
});
