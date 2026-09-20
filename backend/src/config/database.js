require('dotenv').config({ quiet: true });

const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

/**
 * Single shared Prisma client.
 *
 * Prisma 7 requires an explicit driver adapter for SQL providers, so the
 * connection string is resolved here rather than in schema.prisma.
 *
 * Tests run against TEST_DATABASE_URL so they can never touch development data.
 */
const { Pool } = require('pg');

/** True for a connection string pointing at the machine running the process. */
function isLocalConnection(url) {
  return /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

function resolveConnectionString() {
  const isTest = process.env.NODE_ENV === 'test';
  const url = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      `Missing ${isTest ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} environment variable`
    );
  }

  // A deployed instance pointed at localhost is always a misconfiguration:
  // there is no database on that host. Say so plainly rather than letting it
  // surface later as an opaque ECONNREFUSED.
  if (process.env.NODE_ENV === 'production' && isLocalConnection(url)) {
    throw new Error(
      'DATABASE_URL points at localhost, but this is a production deployment. ' +
        'Set DATABASE_URL to your hosted database connection string ' +
        '(on Render, use the Internal Database URL of your Postgres instance).'
    );
  }

  return url;
}

/**
 * TLS settings for the connection pool.
 *
 * Managed providers require TLS while a local container does not, so the
 * default follows the host. `DATABASE_SSL` overrides it when a provider
 * disagrees, which avoids a code change to fix a hosting detail.
 */
function resolveSsl(url) {
  const override = process.env.DATABASE_SSL;
  if (override === 'false' || override === 'disable') return undefined;
  if (override === 'true' || override === 'require') {
    return { rejectUnauthorized: false };
  }

  const useTls = !isLocalConnection(url) && process.env.NODE_ENV === 'production';
  return useTls ? { rejectUnauthorized: false } : undefined;
}

function resolveLogLevels() {
  if (process.env.NODE_ENV === 'test') return [];
  if (process.env.NODE_ENV === 'development') return ['warn', 'error'];
  return ['error'];
}

const connectionString = resolveConnectionString();

const pool = new Pool({
  connectionString,
  ssl: resolveSsl(connectionString),
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  // Tests deliberately trigger constraint violations; their logs are noise.
  log: resolveLogLevels(),
});

/** Verifies the database is reachable. Used at boot and by tests. */
async function connectDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return prisma;
  } catch (err) {
    console.error('Database connection failed. Please verify your DATABASE_URL and database status.');
    console.error('Connection details:', {
      host: connectionString.split('@')[1]?.split('/')[0] || 'hidden',
    });
    throw err;
  }
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = { prisma, connectDatabase, disconnectDatabase };
