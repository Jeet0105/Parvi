const { Prisma } = require('../generated/prisma');

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const { ROLES } = require('../middleware/role.middleware');
const audit = require('./audit.service');
const familyService = require('./family.service');

/**
 * A relationship reads "from is the <type> of to".
 * So { from: Rahul, type: FATHER, to: Vivek } means Rahul is Vivek's father.
 */

/** Types where the `from` member must be older than the `to` member. */
const FROM_MUST_BE_OLDER = [
  'FATHER',
  'MOTHER',
  'GRANDFATHER',
  'GRANDMOTHER',
];

/** Types where the `from` member must be younger than the `to` member. */
const FROM_MUST_BE_YOUNGER = [
  'SON',
  'DAUGHTER',
  'GRANDSON',
  'GRANDDAUGHTER',
];

/** Gender each type implies for the `from` member. */
const IMPLIED_GENDER = {
  FATHER: 'MALE',
  SON: 'MALE',
  BROTHER: 'MALE',
  GRANDFATHER: 'MALE',
  GRANDSON: 'MALE',
  MOTHER: 'FEMALE',
  DAUGHTER: 'FEMALE',
  SISTER: 'FEMALE',
  GRANDMOTHER: 'FEMALE',
  GRANDDAUGHTER: 'FEMALE',
};

/** A person has at most one of each of these pointing at them. */
const SINGLE_HOLDER_TYPES = ['FATHER', 'MOTHER'];

const relationshipInclude = {
  fromMember: { select: { id: true, name: true, gender: true, dateOfBirth: true } },
  toMember: { select: { id: true, name: true, gender: true, dateOfBirth: true } },
};

function yearsBetween(earlier, later) {
  return (later.getTime() - earlier.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Rejects relationships that cannot be true, so obvious data-entry errors are
 * caught before an officer wastes time on them. Deliberately conservative:
 * it only blocks contradictions, never merely unusual families.
 */
function assertPlausible({ fromMember, toMember, relationshipType }) {
  const expectedGender = IMPLIED_GENDER[relationshipType];

  // OTHER is always allowed; only a direct contradiction is blocked.
  if (
    expectedGender &&
    fromMember.gender !== 'OTHER' &&
    fromMember.gender !== expectedGender
  ) {
    throw new AppError(422, 'Relationship conflicts with the recorded gender', [
      {
        field: 'relationshipType',
        message: `${fromMember.name} is recorded as ${fromMember.gender}, so cannot be the ${relationshipType.toLowerCase()}`,
      },
    ]);
  }

  const gap = yearsBetween(fromMember.dateOfBirth, toMember.dateOfBirth);

  if (FROM_MUST_BE_OLDER.includes(relationshipType) && gap <= 0) {
    throw new AppError(422, 'Relationship conflicts with the recorded dates of birth', [
      {
        field: 'relationshipType',
        message: `${fromMember.name} is not older than ${toMember.name}`,
      },
    ]);
  }

  if (FROM_MUST_BE_YOUNGER.includes(relationshipType) && gap >= 0) {
    throw new AppError(422, 'Relationship conflicts with the recorded dates of birth', [
      {
        field: 'relationshipType',
        message: `${fromMember.name} is not younger than ${toMember.name}`,
      },
    ]);
  }
}

async function createRelationship({ user, data }) {
  const { fromMemberId, toMemberId, relationshipType } = data;

  if (fromMemberId === toMemberId) {
    throw new AppError(422, 'A member cannot be related to themselves', [
      { field: 'toMemberId', message: 'Choose a different member' },
    ]);
  }

  const members = await prisma.familyMember.findMany({
    where: { id: { in: [fromMemberId, toMemberId] } },
    include: { family: true },
  });

  const fromMember = members.find((m) => m.id === fromMemberId);
  const toMember = members.find((m) => m.id === toMemberId);

  if (!fromMember || !toMember) {
    throw new AppError(404, 'Member not found');
  }

  // Both members must belong to one family, and it must be the caller's.
  if (fromMember.familyId !== toMember.familyId) {
    throw new AppError(422, 'Both members must belong to the same family', [
      { field: 'toMemberId', message: 'Member is in a different family' },
    ]);
  }

  const family = fromMember.family;

  if (!familyService.canAccessFamily(user, family)) {
    throw new AppError(404, 'Member not found');
  }

  if (!familyService.canEditFamily(user, family)) {
    throw new AppError(403, 'You do not have permission to modify this family');
  }

  assertPlausible({ fromMember, toMember, relationshipType });

  if (SINGLE_HOLDER_TYPES.includes(relationshipType)) {
    const existing = await prisma.relationship.findFirst({
      where: {
        toMemberId,
        relationshipType,
        verificationStatus: { not: 'REJECTED' },
      },
      include: { fromMember: { select: { name: true } } },
    });

    if (existing) {
      throw new AppError(
        409,
        `${toMember.name} already has a recorded ${relationshipType.toLowerCase()}`,
        [{ field: 'relationshipType', message: `Currently ${existing.fromMember.name}` }]
      );
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const relationship = await tx.relationship.create({
        data: {
          familyId: family.id,
          fromMemberId,
          toMemberId,
          relationshipType,
        },
        include: relationshipInclude,
      });

      await audit.record(
        {
          userId: user.id,
          action: audit.AUDIT_ACTIONS.RELATIONSHIP_CREATED,
          entityType: 'Relationship',
          entityId: relationship.id,
          newValue: {
            from: fromMember.name,
            to: toMember.name,
            relationshipType,
            verificationStatus: relationship.verificationStatus,
          },
        },
        tx
      );

      return relationship;
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new AppError(409, 'This relationship has already been recorded');
    }
    throw err;
  }
}

async function listForFamily({ user, familyId, verificationStatus }) {
  const family = await familyService.getFamily({ user, id: familyId });

  const relationships = await prisma.relationship.findMany({
    where: {
      familyId: family.id,
      ...(verificationStatus ? { verificationStatus } : {}),
    },
    include: relationshipInclude,
    orderBy: { createdAt: 'asc' },
  });

  return { family, relationships };
}

async function getRelationship({ user, id }) {
  const relationship = await prisma.relationship.findUnique({
    where: { id },
    include: { ...relationshipInclude, family: true },
  });

  if (!relationship || !familyService.canAccessFamily(user, relationship.family)) {
    throw new AppError(404, 'Relationship not found');
  }

  return relationship;
}

/** Officer decisions, mapped to the verification states they produce. */
const DECISIONS = {
  APPROVE: 'VERIFIED',
  REJECT: 'REJECTED',
  REQUEST_DOCUMENT: 'UNDER_REVIEW',
};

/**
 * Records an officer's decision on a relationship.
 *
 * Citizens can never reach this: verification is the whole point of having
 * officers, so a family cannot approve its own claims.
 */
async function verifyRelationship({ user, id, action, reason }) {
  const relationship = await getRelationship({ user, id });
  const nextStatus = DECISIONS[action];

  if (!nextStatus) {
    throw new AppError(422, 'Unknown verification action');
  }

  if (relationship.verificationStatus === nextStatus) {
    throw new AppError(409, `Relationship is already ${nextStatus}`);
  }

  if (relationship.verificationStatus === 'VERIFIED' && action === 'REQUEST_DOCUMENT') {
    throw new AppError(409, 'A verified relationship cannot be returned for documents');
  }

  if (action === 'REJECT' && !reason) {
    throw new AppError(422, 'A reason is required when rejecting', [
      { field: 'reason', message: 'Explain why this relationship was rejected' },
    ]);
  }

  const auditAction =
    nextStatus === 'REJECTED'
      ? audit.AUDIT_ACTIONS.RELATIONSHIP_REJECTED
      : audit.AUDIT_ACTIONS.RELATIONSHIP_VERIFIED;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.relationship.update({
      where: { id: relationship.id },
      data: {
        verificationStatus: nextStatus,
        verifiedById: user.id,
        verifiedAt: nextStatus === 'VERIFIED' ? new Date() : null,
        rejectionReason: nextStatus === 'REJECTED' ? reason : null,
      },
      include: relationshipInclude,
    });

    await audit.record(
      {
        userId: user.id,
        action: auditAction,
        entityType: 'Relationship',
        entityId: relationship.id,
        oldValue: { verificationStatus: relationship.verificationStatus },
        newValue: { verificationStatus: nextStatus },
        reason,
      },
      tx
    );

    return updated;
  });
}

/** Officer queue of relationships awaiting a decision. */
async function listPending({ user, page = 1, pageSize = 25 }) {
  const where = {
    verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] },
    ...(user.role === ROLES.DISTRICT_OFFICER
      ? { family: { district: user.district } }
      : {}),
  };

  const [relationships, total] = await Promise.all([
    prisma.relationship.findMany({
      where,
      include: {
        ...relationshipInclude,
        family: { select: { id: true, familyId: true, district: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.relationship.count({ where }),
  ]);

  return {
    relationships,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

module.exports = {
  createRelationship,
  listForFamily,
  getRelationship,
  verifyRelationship,
  listPending,
  assertPlausible,
  DECISIONS,
  IMPLIED_GENDER,
  FROM_MUST_BE_OLDER,
  FROM_MUST_BE_YOUNGER,
};
