module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testPathIgnorePatterns: ['/tests/e2e/', 'gui.test.js', 'debug-settings.js'],
  collectCoverage: false
};
