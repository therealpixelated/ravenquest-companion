const SCHEMAS = {
  'cosmetics.json': {
    id: 'string',
    name: 'string'
  },
  'trophies.json': {
    id: 'string',
    name: 'string',
    type: 'string'
  }
};

function validateItems(name, data, requiredFields = [], warnings = []) {
  const items = Array.isArray(data?.items) ? data.items : null;
  if (!items) {
    warnings.push(`${name}: missing items array`);
    return { items: [] };
  }

  const schema = SCHEMAS[name];
  const required = schema ? Object.keys(schema) : requiredFields;
  let missing = 0;

  items.forEach((entry) => {
    required.forEach((field) => {
      const type = schema ? schema[field] : null;
      const val = entry[field];
      const badType = type && typeof val !== type;
      if (val === undefined || val === null || val === '' || badType) {
        missing += 1;
      }
    });
    if (!entry.id) {
      missing += 1;
    }
  });

  if (missing > 0) {
    warnings.push(`${name}: ${missing} missing required fields`);
  }
  return { items };
}

module.exports = { validateItems };
