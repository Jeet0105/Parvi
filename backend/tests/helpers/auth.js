const bcrypt = require('bcrypt');

const { prisma } = require('../../src/config/database');
const { signToken } = require('../../src/utils/jwt');

let counter = 0;

/**
 * Creates a user directly in the database with any role.
 *
 * Officer and admin accounts cannot be created through the public API by
 * design, so tests that exercise those roles build them here.
 */
async function createUser({
  role = 'CITIZEN',
  password = 'Password123',
  district = null,
  ...overrides
} = {}) {
  counter += 1;

  const user = await prisma.user.create({
    data: {
      name: `Test User ${counter}`,
      email: `user${counter}@example.com`,
      mobile: `98765${String(counter).padStart(5, '0')}`,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      district,
      ...overrides,
    },
  });

  return { ...user, password, token: signToken(user) };
}

const createCitizen = (overrides) => createUser({ ...overrides, role: 'CITIZEN' });
const createOfficer = (overrides) =>
  createUser({ district: 'Ahmedabad', ...overrides, role: 'VERIFICATION_OFFICER' });
const createDistrictOfficer = (overrides) =>
  createUser({ district: 'Ahmedabad', ...overrides, role: 'DISTRICT_OFFICER' });
const createAdmin = (overrides) => createUser({ ...overrides, role: 'ADMIN' });

/** Authorization header for a user created above. */
const bearer = (user) => `Bearer ${user.token}`;

module.exports = {
  createUser,
  createCitizen,
  createOfficer,
  createDistrictOfficer,
  createAdmin,
  bearer,
};
