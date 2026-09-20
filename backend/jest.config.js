module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  verbose: true,
  // Tests share one PostgreSQL database, so they must not run in parallel.
  maxWorkers: 1,
  testTimeout: 30000,
};
