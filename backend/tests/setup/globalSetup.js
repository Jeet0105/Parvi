const { execSync } = require('node:child_process');

/**
 * Runs once before the whole suite.
 *
 * Brings the dedicated test database up to the current migration state so a
 * schema change can never silently invalidate the suite. Never points at
 * DATABASE_URL -- tests must not touch development data.
 */
module.exports = async () => {
  process.env.NODE_ENV = 'test';

  require('dotenv').config({ quiet: true });

  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Tests refuse to run against the development database.'
    );
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'test' },
  });
};
