const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const { calculateMemberSimilarity } = require('../utils/similarity');
const audit = require('./audit.service');
const { ROLES } = require('../middleware/role.middleware');

const DUPLICATE_THRESHOLD = 70; // 70% overall similarity triggers review

/**
 * Checks a specific member against all other active members in the system.
 * Creates DuplicateReview records for candidates above the threshold.
 */
async function findDuplicatesForMember(memberId) {
  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
    include: { family: true },
  });

  if (!member || member.status !== 'ACTIVE') return [];

  const candidates = await prisma.familyMember.findMany({
    where: {
      id: { not: member.id },
      status: 'ACTIVE',
    },
    include: { family: true },
  });

  const flagged = [];

  for (const candidate of candidates) {
    const { score, breakdown } = calculateMemberSimilarity(member, candidate);

    if (score >= DUPLICATE_THRESHOLD) {
      // Ensure deterministic order for composite unique key [sourceMemberId, matchedMemberId]
      const [sourceId, targetId] = member.id < candidate.id
        ? [member.id, candidate.id]
        : [candidate.id, member.id];

      const review = await prisma.duplicateReview.upsert({
        where: {
          sourceMemberId_matchedMemberId: {
            sourceMemberId: sourceId,
            matchedMemberId: targetId,
          },
        },
        update: {
          score,
          breakdown,
        },
        create: {
          sourceMemberId: sourceId,
          matchedMemberId: targetId,
          score,
          breakdown,
          status: 'PENDING_REVIEW',
        },
      });

      await audit.record({
        userId: null,
        action: audit.AUDIT_ACTIONS.DUPLICATE_FLAGGED,
        entityType: 'DuplicateReview',
        entityId: review.id,
        newValue: { sourceMemberId: sourceId, matchedMemberId: targetId, score },
      });

      flagged.push(review);
    }
  }

  return flagged;
}

/**
 * Scans all active members across the database for potential duplicates.
 */
async function scanAll() {
  const allMembers = await prisma.familyMember.findMany({
    where: { status: 'ACTIVE' },
    include: { family: true },
  });

  let newFlaggedCount = 0;

  for (let i = 0; i < allMembers.length; i++) {
    for (let j = i + 1; j < allMembers.length; j++) {
      const m1 = allMembers[i];
      const m2 = allMembers[j];

      const { score, breakdown } = calculateMemberSimilarity(m1, m2);

      if (score >= DUPLICATE_THRESHOLD) {
        const [sourceId, targetId] = m1.id < m2.id
          ? [m1.id, m2.id]
          : [m2.id, m1.id];

        await prisma.duplicateReview.upsert({
          where: {
            sourceMemberId_matchedMemberId: {
              sourceMemberId: sourceId,
              matchedMemberId: targetId,
            },
          },
          update: {
            score,
            breakdown,
          },
          create: {
            sourceMemberId: sourceId,
            matchedMemberId: targetId,
            score,
            breakdown,
            status: 'PENDING_REVIEW',
          },
        });

        newFlaggedCount++;
      }
    }
  }

  return { scanned: allMembers.length, flagged: newFlaggedCount };
}

/**
 * Lists flagged duplicate candidate records for officer review.
 */
async function listDuplicateReviews({
  user,
  status = 'PENDING_REVIEW',
  page = 1,
  pageSize = 20,
}) {
  const districtScoped = user.role === ROLES.DISTRICT_OFFICER;
  const where = {
    ...(status ? { status } : {}),
    ...(districtScoped && user.district
      ? {
          OR: [
            { sourceMember: { family: { district: user.district } } },
            { matchedMember: { family: { district: user.district } } },
          ],
        }
      : {}),
  };

  const [duplicates, total] = await Promise.all([
    prisma.duplicateReview.findMany({
      where,
      include: {
        sourceMember: {
          include: {
            family: { select: { id: true, familyId: true, district: true, taluka: true, village: true } },
          },
        },
        matchedMember: {
          include: {
            family: { select: { id: true, familyId: true, district: true, taluka: true, village: true } },
          },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { score: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.duplicateReview.count({ where }),
  ]);

  return {
    duplicates,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Records an officer's determination on a duplicate alert.
 * The system never automatically merges records.
 */
async function decideDuplicateReview({ user, id, decision, reviewNote }) {
  if (!['SAME_PERSON', 'DIFFERENT_PERSON'].includes(decision)) {
    throw new AppError(422, 'Decision must be SAME_PERSON or DIFFERENT_PERSON');
  }

  const review = await prisma.duplicateReview.findUnique({
    where: { id },
    include: {
      sourceMember: { include: { family: true } },
      matchedMember: { include: { family: true } },
    },
  });

  if (!review) {
    throw new AppError(404, 'Duplicate review record not found');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.duplicateReview.update({
      where: { id },
      data: {
        status: decision,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
      include: {
        sourceMember: { include: { family: true } },
        matchedMember: { include: { family: true } },
        reviewedBy: { select: { id: true, name: true, role: true } },
      },
    });

    await audit.record(
      {
        userId: user.id,
        action: audit.AUDIT_ACTIONS.DUPLICATE_REVIEWED,
        entityType: 'DuplicateReview',
        entityId: id,
        oldValue: { status: review.status },
        newValue: { status: decision, reviewNote },
        reason: reviewNote,
      },
      tx
    );

    return updated;
  });
}

module.exports = {
  findDuplicatesForMember,
  scanAll,
  listDuplicateReviews,
  decideDuplicateReview,
  DUPLICATE_THRESHOLD,
};
