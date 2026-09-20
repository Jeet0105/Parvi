const { Prisma } = require('../generated/prisma');

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const { generateFamilyId } = require('../utils/familyId');
const { ROLES } = require('../middleware/role.middleware');
const audit = require('./audit.service');

const FAMILY_ID_ATTEMPTS = 5;

const familyInclude = {
  owner: { select: { id: true, name: true, email: true } },
  familyHead: true,
  members: { orderBy: { createdAt: 'asc' } },
};

/**
 * Whether a user may read a family.
 *
 * Citizens see only their own. Verification officers and admins see all.
 * District officers are limited to families in their own district.
 */
function canAccessFamily(user, family) {
  if (user.role === ROLES.CITIZEN) return family.ownerId === user.id;
  if (user.role === ROLES.DISTRICT_OFFICER) return family.district === user.district;
  return user.role === ROLES.VERIFICATION_OFFICER || user.role === ROLES.ADMIN;
}

/** Only the owning citizen edits family details; officers verify instead. */
function canEditFamily(user, family) {
  return user.role === ROLES.CITIZEN && family.ownerId === user.id;
}

/**
 * Creates a family, its head member and the audit entry as one transaction.
 *
 * A retry loop guards Family ID generation: the identifier is random, so a
 * collision is vanishingly unlikely but not impossible, and the unique index
 * is what actually guarantees correctness.
 */
async function createFamily({ user, data }) {
  const existing = await prisma.family.findFirst({
    where: { ownerId: user.id },
    select: { id: true, familyId: true },
  });

  if (existing) {
    throw new AppError(409, 'You have already registered a family', [
      { field: 'family', message: `Existing family ${existing.familyId}` },
    ]);
  }

  const { head, ...familyData } = data;

  for (let attempt = 1; attempt <= FAMILY_ID_ATTEMPTS; attempt += 1) {
    const familyId = generateFamilyId(familyData.state);

    try {
      return await prisma.$transaction(async (tx) => {
        const family = await tx.family.create({
          data: { ...familyData, familyId, ownerId: user.id, status: 'DRAFT' },
        });

        // The registering citizen becomes the Family Head, linked back to
        // their login account.
        const headMember = await tx.familyMember.create({
          data: {
            familyId: family.id,
            userId: user.id,
            name: head.name || user.name,
            dateOfBirth: head.dateOfBirth,
            gender: head.gender,
            fatherName: head.fatherName,
            motherName: head.motherName,
            spouseName: head.spouseName,
            isStudent: head.isStudent ?? false,
          },
        });

        const withHead = await tx.family.update({
          where: { id: family.id },
          data: { familyHeadId: headMember.id },
          include: familyInclude,
        });

        await audit.record(
          {
            userId: user.id,
            action: audit.AUDIT_ACTIONS.FAMILY_CREATED,
            entityType: 'Family',
            entityId: family.id,
            newValue: {
              familyId: withHead.familyId,
              district: withHead.district,
              status: withHead.status,
              familyHead: headMember.name,
            },
          },
          tx
        );

        return withHead;
      });
    } catch (err) {
      const isFamilyIdCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        String(err.meta?.target ?? '').includes('familyId');

      if (!isFamilyIdCollision) throw err;
      // Otherwise fall through and try a fresh identifier.
    }
  }

  throw new AppError(500, 'Could not generate a unique Family ID, please retry');
}

/** Looks up a family by database id or by public Family ID. */
async function findFamily(idOrFamilyId) {
  return prisma.family.findFirst({
    where: { OR: [{ id: idOrFamilyId }, { familyId: idOrFamilyId }] },
    include: familyInclude,
  });
}

async function getFamily({ user, id }) {
  const family = await findFamily(id);

  if (!family) {
    throw new AppError(404, 'Family not found');
  }

  if (!canAccessFamily(user, family)) {
    // Same status as a genuine miss, so probing cannot map out which family
    // identifiers exist.
    throw new AppError(404, 'Family not found');
  }

  return family;
}

async function updateFamily({ user, id, data }) {
  const family = await getFamily({ user, id });

  if (!canEditFamily(user, family)) {
    throw new AppError(403, 'You do not have permission to edit this family');
  }

  if (family.status === 'VERIFIED') {
    throw new AppError(
      409,
      'A verified family cannot be edited directly. Submit a correction request.'
    );
  }

  const changed = Object.keys(data).filter(
    (key) => String(family[key]) !== String(data[key])
  );

  if (changed.length === 0) {
    return family;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.family.update({
      where: { id: family.id },
      data,
      include: familyInclude,
    });

    await audit.record(
      {
        userId: user.id,
        action: audit.AUDIT_ACTIONS.FAMILY_UPDATED,
        entityType: 'Family',
        entityId: family.id,
        oldValue: Object.fromEntries(changed.map((k) => [k, family[k]])),
        newValue: Object.fromEntries(changed.map((k) => [k, updated[k]])),
      },
      tx
    );

    return updated;
  });
}

/** The family owned by the signed-in citizen, or null. */
async function getMyFamily(user) {
  return prisma.family.findFirst({
    where: { ownerId: user.id },
    include: familyInclude,
  });
}

/** Officer-facing list, scoped by role. */
async function listFamilies({ user, status, district, page = 1, pageSize = 25 }) {
  const where = {
    ...(status ? { status } : {}),
    ...(district ? { district } : {}),
    // A district officer never sees outside their own district.
    ...(user.role === ROLES.DISTRICT_OFFICER ? { district: user.district } : {}),
  };

  const [families, total] = await Promise.all([
    prisma.family.findMany({
      where,
      include: familyInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.family.count({ where }),
  ]);

  return {
    families,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

module.exports = {
  createFamily,
  getFamily,
  updateFamily,
  getMyFamily,
  listFamilies,
  findFamily,
  canAccessFamily,
  canEditFamily,
};
