const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const { toPublicUser } = require('./auth.service');

const MAX_PAGE_SIZE = 100;

/** Admin-only directory of platform accounts. */
async function listUsers({ role, district, page = 1, pageSize = 25 } = {}) {
  const take = Math.min(pageSize, MAX_PAGE_SIZE);
  const skip = (page - 1) * take;

  const where = {
    ...(role ? { role } : {}),
    ...(district ? { district } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(toPublicUser),
    pagination: { page, pageSize: take, total, totalPages: Math.ceil(total / take) },
  };
}

async function getUser(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  return toPublicUser(user);
}

/**
 * Changes a user's role. Admin only.
 *
 * An admin cannot demote themselves, which would otherwise make it possible
 * to lock the last administrator out of the platform.
 */
async function updateUserRole({ id, role, actingUserId }) {
  if (id === actingUserId) {
    throw new AppError(400, 'You cannot change your own role');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
  });

  return { previousRole: user.role, user: toPublicUser(updated) };
}

module.exports = { listUsers, getUser, updateUserRole };
