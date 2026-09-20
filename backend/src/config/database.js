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
function resolveConnectionString() {
  const isTest = process.env.NODE_ENV === 'test';
  const url = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      `Missing ${isTest ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} environment variable`
    );
  }
  return url;
}

function resolveLogLevels() {
  if (process.env.NODE_ENV === 'test') return [];
  if (process.env.NODE_ENV === 'development') return ['warn', 'error'];
  return ['error'];
}

const adapter = new PrismaPg({ connectionString: resolveConnectionString() });

const prisma = new PrismaClient({
  adapter,
  // Tests deliberately trigger constraint violations; their logs are noise.
  log: resolveLogLevels(),
});

/** Verifies the database is reachable. Used at boot and by tests. */
async function connectDatabase() {
  await prisma.$queryRaw`SELECT 1`;
  return prisma;
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = { prisma, connectDatabase, disconnectDatabase };
