const { prisma } = require('../config/database');
const { getCache, setCache, invalidateCache } = require('../config/redis');
const AppError = require('../utils/AppError');
const { ROLES } = require('../middleware/role.middleware');
const audit = require('./audit.service');
const familyService = require('./family.service');

const DECISIONS = {
  APPROVE: 'VERIFIED',
  REJECT: 'REJECTED',
  REQUEST_DOCUMENT: 'UNDER_REVIEW',
};

/**
 * Submits a family for officer review.
 *
 * A family with nothing to check wastes an officer's time, so submission
 * requires at least one supporting document somewhere in the household.
 */
async function submitFamily({ user, familyId }) {
  const family = await familyService.getFamily({ user, id: familyId });

  if (!familyService.canEditFamily(user, family)) {
    throw new AppError(403, 'Only the family owner can submit for verification');
  }

  if (family.status === 'PENDING_VERIFICATION') {
    throw new AppError(409, 'This family is already awaiting verification');
  }

  if (family.status === 'VERIFIED') {
    throw new AppError(409, 'This family is already verified');
  }

  const documentCount = await prisma.document.count({
    where: { member: { familyId: family.id } },
  });

  if (documentCount === 0) {
    throw new AppError(422, 'Upload at least one supporting document first', [
      { field: 'documents', message: 'No documents have been uploaded' },
    ]);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.family.update({
      where: { id: family.id },
      data: { status: 'PENDING_VERIFICATION', rejectionReason: null },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        familyHead: true,
        members: { orderBy: { createdAt: 'asc' } },
      },
    });

    await audit.record(
      {
        userId: user.id,
        action: audit.AUDIT_ACTIONS.FAMILY_SUBMITTED,
        entityType: 'Family',
        entityId: family.id,
        oldValue: { status: family.status },
        newValue: { status: 'PENDING_VERIFICATION' },
      },
      tx
    );

    return updated;
  });
}

/**
 * Records an officer's decision on a whole family.
 *
 * Verifying a family means its members and relationships were checked, so
 * approval requires every member to have been verified first. That keeps the
 * family-level status honest rather than a rubber stamp.
 */
async function verifyFamily({ user, familyId, action, reason }) {
  const family = await familyService.getFamily({ user, id: familyId });
  const nextStatus = DECISIONS[action];

  if (!nextStatus) {
    throw new AppError(422, 'Unknown verification action');
  }

  if (action === 'REJECT' && !reason) {
    throw new AppError(422, 'A reason is required when rejecting', [
      { field: 'reason', message: 'Explain what the family must correct' },
    ]);
  }

  if (family.status === 'VERIFIED') {
    throw new AppError(409, 'This family is already verified');
  }

  // An officer decides on submissions, not on drafts: until the citizen
  // submits, the record is still being filled in.
  if (family.status !== 'PENDING_VERIFICATION') {
    throw new AppError(
      409,
      'This family has not been submitted for verification'
    );
  }

  if (action === 'APPROVE') {

    const unverified = await prisma.familyMember.count({
      where: {
        familyId: family.id,
        status: 'ACTIVE',
        verificationStatus: { not: 'VERIFIED' },
      },
    });

    if (unverified > 0) {
      throw new AppError(
        409,
        `Verify all ${unverified} remaining member${unverified === 1 ? '' : 's'} before verifying the family`
      );
    }
  }

  const statusByAction = {
    APPROVE: 'VERIFIED',
    REJECT: 'REJECTED',
    REQUEST_DOCUMENT: 'PENDING_VERIFICATION',
  };
  const familyStatus = statusByAction[action];

  const auditAction =
    action === 'REJECT'
      ? audit.AUDIT_ACTIONS.FAMILY_REJECTED
      : audit.AUDIT_ACTIONS.FAMILY_VERIFIED;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.family.update({
      where: { id: family.id },
      data: {
        status: familyStatus,
        verifiedById: user.id,
        verifiedAt: familyStatus === 'VERIFIED' ? new Date() : null,
        rejectionReason: familyStatus === 'REJECTED' ? reason : null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        familyHead: true,
        members: { orderBy: { createdAt: 'asc' } },
      },
    });

    await audit.record(
      {
        userId: user.id,
        action: auditAction,
        entityType: 'Family',
        entityId: family.id,
        oldValue: { status: family.status },
        newValue: { status: familyStatus },
        reason,
      },
      tx
    );

    return updated;
  });
}

/** Officer decision on an individual member. */
async function verifyMember({ user, memberId, action, reason }) {
  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
    include: { family: true },
  });

  if (!member || !familyService.canAccessFamily(user, member.family)) {
    throw new AppError(404, 'Member not found');
  }

  const nextStatus = DECISIONS[action];
  if (!nextStatus) {
    throw new AppError(422, 'Unknown verification action');
  }

  if (member.verificationStatus === nextStatus) {
    throw new AppError(409, `Member is already ${nextStatus}`);
  }

  if (action === 'REJECT' && !reason) {
    throw new AppError(422, 'A reason is required when rejecting', [
      { field: 'reason', message: 'Explain why this member was rejected' },
    ]);
  }

  const auditAction =
    nextStatus === 'REJECTED'
      ? audit.AUDIT_ACTIONS.MEMBER_REJECTED
      : audit.AUDIT_ACTIONS.MEMBER_VERIFIED;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.familyMember.update({
      where: { id: member.id },
      data: {
        verificationStatus: nextStatus,
        verifiedById: user.id,
        verifiedAt: nextStatus === 'VERIFIED' ? new Date() : null,
        rejectionReason: nextStatus === 'REJECTED' ? reason : null,
      },
    });

    await audit.record(
      {
        userId: user.id,
        action: auditAction,
        entityType: 'FamilyMember',
        entityId: member.id,
        oldValue: { verificationStatus: member.verificationStatus },
        newValue: { verificationStatus: nextStatus },
        reason,
      },
      tx
    );

    return updated;
  });
}

/** Families awaiting an officer decision. */
async function listPendingFamilies({ user, page = 1, pageSize = 25 }) {
  const where = {
    status: 'PENDING_VERIFICATION',
    ...(user.role === ROLES.DISTRICT_OFFICER ? { district: user.district } : {}),
  };

  const [families, total] = await Promise.all([
    prisma.family.findMany({
      where,
      include: {
        familyHead: true,
        members: { orderBy: { createdAt: 'asc' } },
        _count: { select: { members: true, relationships: true } },
      },
      orderBy: { updatedAt: 'asc' },
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

const VERIFICATION_AUDIT_ACTIONS = [
  'FAMILY_VERIFIED',
  'FAMILY_REJECTED',
  'MEMBER_VERIFIED',
  'MEMBER_REJECTED',
  'RELATIONSHIP_VERIFIED',
  'RELATIONSHIP_REJECTED',
  'DOCUMENT_VERIFIED',
  'DOCUMENT_REJECTED',
  'DUPLICATE_REVIEWED',
  'BENEFICIARY_APPROVED',
  'BENEFICIARY_REJECTED',
];

/**
 * Counts for the officer dashboard.
 *
 * Every count is scoped the same way the corresponding queue is, so the
 * numbers always match what the officer can actually open.
 */
async function getStatistics({ user }) {
  const districtScoped = user.role === ROLES.DISTRICT_OFFICER;
  const cacheKey = `stats:${user.role}:${districtScoped ? user.district || 'none' : 'all'}`;

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const familyScope = districtScoped ? { district: user.district } : {};
  const memberScope = districtScoped
    ? { family: { district: user.district } }
    : {};

  const [
    pendingFamilies,
    verifiedFamilies,
    totalFamilies,
    pendingMembers,
    pendingRelationships,
    pendingDocuments,
    duplicateAlerts,
    pendingApplications,
  ] = await Promise.all([
    prisma.family.count({ where: { ...familyScope, status: 'PENDING_VERIFICATION' } }),
    prisma.family.count({ where: { ...familyScope, status: 'VERIFIED' } }),
    prisma.family.count({ where: familyScope }),
    prisma.familyMember.count({
      where: {
        ...memberScope,
        status: 'ACTIVE',
        verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
    }),
    prisma.relationship.count({
      where: {
        ...(districtScoped ? { family: { district: user.district } } : {}),
        verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
    }),
    prisma.document.count({
      where: {
        ...(districtScoped
          ? { member: { family: { district: user.district } } }
          : {}),
        verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
    }),
    prisma.duplicateReview.count({
      where: {
        status: 'PENDING_REVIEW',
        ...(districtScoped && user.district
          ? { sourceMember: { family: { district: user.district } } }
          : {}),
      },
    }),
    prisma.beneficiaryApplication.count({
      where: {
        status: { in: ['APPLIED', 'UNDER_REVIEW'] },
        ...(districtScoped && user.district
          ? { family: { district: user.district } }
          : {}),
      },
    }),
  ]);

  const stats = {
    scope: districtScoped ? user.district : 'All districts',
    pendingFamilies,
    pendingMembers,
    pendingRelationships,
    pendingDocuments,
    duplicateAlerts,
    pendingApplications,
    verifiedFamilies,
    totalFamilies,
  };

  await setCache(cacheKey, stats, 15);

  return stats;
}

/**
 * Retrieves past verification actions recorded in the audit trail.
 */
async function getVerificationHistory({ user, page = 1, pageSize = 20 }) {
  const districtScoped = user.role === ROLES.DISTRICT_OFFICER;
  const where = {
    action: { in: VERIFICATION_AUDIT_ACTIONS },
    ...(districtScoped && user.district
      ? {
          user: {
            OR: [
              { id: user.id },
              { district: user.district },
            ],
          },
        }
      : {}),
  };

  const [history, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            district: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    history,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

module.exports = {
  submitFamily,
  verifyFamily,
  verifyMember,
  listPendingFamilies,
  getStatistics,
  getVerificationHistory,
  VERIFICATION_AUDIT_ACTIONS,
  DECISIONS,
};
