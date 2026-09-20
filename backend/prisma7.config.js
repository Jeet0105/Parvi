// Prisma 7 configuration. JavaScript (CommonJS) to match the project's
// JavaScript-only rule -- Prisma scaffolds a .ts file by default.
require('dotenv/config');
const { defineConfig } = require('prisma/config');

// Tests must never touch the development database.
const url =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url,
  },
});
