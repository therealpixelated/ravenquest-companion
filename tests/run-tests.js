const fs = require('fs');
const path = require('path');

const DATA_FILES = [
  { file: 'cosmetics.json', required: ['id', 'name'] },
  { file: 'trophies.json', required: ['id', 'name', 'type'] }
];

function loadJsonSafe(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateFile(dataDir, entry) {
  const fullPath = path.join(dataDir, entry.file);
  const result = { file: entry.file, exists: false, validJson: false, missing: 0, count: 0 };

  if (!fs.existsSync(fullPath)) {
    return result;
  }

  result.exists = true;
  try {
    const parsed = loadJsonSafe(fullPath);
    if (!Array.isArray(parsed.items)) {
      return result;
    }
    result.validJson = true;
    result.count = parsed.items.length;
    parsed.items.forEach((row) => {
      entry.required.forEach((field) => {
        if (row[field] === undefined || row[field] === null || row[field] === '') {
          result.missing += 1;
        }
      });
    });
    return result;
  } catch (err) {
    return result;
  }
}

function runTests() {
  console.log('🧪 Running RavenQuest data checks...\n');
  const dataDir = path.join(__dirname, '..', 'data');
  let passed = 0;
  let failed = 0;

  DATA_FILES.forEach((entry) => {
    const res = validateFile(dataDir, entry);
    if (!res.exists) {
      console.log(`❌ Missing file: ${entry.file}`);
      failed += 1;
      return;
    }
    if (!res.validJson) {
      console.log(`❌ Invalid JSON or missing items[]: ${entry.file}`);
      failed += 1;
      return;
    }
    if (res.missing > 0) {
      console.log(`❌ ${entry.file}: ${res.missing} entries missing required fields`);
      failed += 1;
      return;
    }
    console.log(`✅ ${entry.file}: ${res.count} items, required fields present`);
    passed += 1;
  });

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`${'='.repeat(40)}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
