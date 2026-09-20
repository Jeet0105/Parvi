const bcrypt = require('bcrypt');

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/jwt');

const SALT_ROUNDS = 10;

/**
 * Shape a User row for API output.
 * Guarantees passwordHash never leaves the service layer.
 */
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    district: user.district,
    createdAt: user.createdAt,
  };
}

async function register({ name, email, mobile, password }) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { mobile }] },
    select: { email: true, mobile: true },
  });

  if (existing) {
    const field = existing.email === email ? 'email' : 'mobile';
    throw new AppError(409, `An account with this ${field} already exists`, [
      { field, message: 'Already registered' },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Role is never taken from the request body -- self-registration always
  // produces a CITIZEN. Officer and admin accounts are provisioned separately.
  const user = await prisma.user.create({
    data: { name, email, mobile, passwordHash, role: 'CITIZEN' },
  });

  return { user: toPublicUser(user), token: signToken(user) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same message and comparable work for both branches, so the response does
  // not reveal whether an email is registered.
  if (!user) {
    await bcrypt.compare(password, '$2b$10$invalidsaltinvalidsaltinvalidsaltinvalidsaltinvalidsa');
    throw new AppError(401, 'Invalid email or password');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new AppError(401, 'Invalid email or password');
  }

  return { user: toPublicUser(user), token: signToken(user) };
}

async function getProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  return toPublicUser(user);
}

module.exports = { register, login, getProfile, toPublicUser, SALT_ROUNDS };
