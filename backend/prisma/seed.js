/**
 * Development seed.
 *
 * Creates the government accounts that cannot be self-registered, because
 * `POST /api/auth/register` always produces a CITIZEN. All data here is
 * synthetic -- never seed real identity details.
 *
 *   npm run db:seed
 */
require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');

const { prisma } = require('../src/config/database');

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'Password123';

const ACCOUNTS = [
  {
    name: 'Verification Officer',
    email: 'officer@example.gov',
    mobile: '9800000001',
    role: 'VERIFICATION_OFFICER',
    district: 'Ahmedabad',
  },
  {
    name: 'District Officer',
    email: 'district@example.gov',
    mobile: '9800000002',
    role: 'DISTRICT_OFFICER',
    district: 'Ahmedabad',
  },
  {
    name: 'System Administrator',
    email: 'admin@example.gov',
    mobile: '9800000003',
    role: 'ADMIN',
    district: null,
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo accounts in production');
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const account of ACCOUNTS) {
    // Upsert keeps re-seeding idempotent and never clobbers a changed password.
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, role: account.role, district: account.district },
      create: { ...account, passwordHash },
    });
    console.log(`  ${user.role.padEnd(21)} ${user.email}`);
  }

  console.log(`\nAll seeded accounts use the password: ${DEFAULT_PASSWORD}`);
  console.log('Citizens register themselves at POST /api/auth/register.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
