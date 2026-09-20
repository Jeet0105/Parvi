module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  // Tests drive the Express app in-process via supertest; no server listen.
  testTimeout: 15000,
};
