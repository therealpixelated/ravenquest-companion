function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateToggleCollected(payload = {}) {
  const { type, id } = payload;
  if (!isNonEmptyString(type) || !isNonEmptyString(id)) {
    return { success: false, error: 'Invalid type or id' };
  }
  return { success: true };
}

function validateTrophyState(trophyId, tier) {
  if (!isNonEmptyString(trophyId) || !isNonEmptyString(tier)) {
    return { success: false, error: 'Invalid trophy id or tier' };
  }
  return { success: true };
}

function validateCosmeticId(cosmeticId) {
  if (!isNonEmptyString(cosmeticId)) {
    return { success: false, error: 'Invalid cosmetic id' };
  }
  return { success: true };
}

module.exports = {
  isNonEmptyString,
  validateToggleCollected,
  validateTrophyState,
  validateCosmeticId
};
