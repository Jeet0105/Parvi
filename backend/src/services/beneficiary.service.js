const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const familyService = require('./family.service');
const { evaluateMember } = require('./eligibility.service');
const { ROLES } = require('../middleware/role.middleware');

/**
 * Submits an application for a government scheme on behalf of a family member.
 */
async function apply({ user, schemeId, memberId }) {
  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
    include: { family: true },
  });

  if (!member) {
    throw new AppError(404, 'Family member not found');
  }

  if (!familyService.canEditFamily(user, member.family)) {
    throw new AppError(403, 'Only the family owner can apply for welfare schemes');
  }

  const scheme = await prisma.scheme.findUnique({
    where: { id: schemeId },
  });

  if (!scheme || scheme.status !== 'ACTIVE') {
    throw new AppError(404, 'Scheme not found or currently inactive');
  }

  // Check if this member already has an application
  const existing = await prisma.beneficiaryApplication.findUnique({
    where: {
      memberId_schemeId: {
        memberId: member.id,
        schemeId: scheme.id,
      },
    },
  });

  if (existing) {
    throw new AppError(409, `An application for ${scheme.name} already exists for this member`, [
      { field: 'schemeId', message: `Current status: ${existing.status}` },
    ]);
  }

  // Evaluate eligibility rules
  const evaluation = evaluateMember(member, member.family, scheme.eligibilityRule);
  if (!evaluation.eligible) {
    throw new AppError(
      422,
      `Member does not meet eligibility criteria for ${scheme.name}: ${evaluation.reasons.join('; ')}`,
      evaluation.reasons.map((r) => ({ field: 'eligibility', message: r }))
    );
  }

  return prisma.$transaction(async (tx) => {
    const application = await tx.beneficiaryApplication.create({
      data: {
        familyId: member.familyId,
        memberId: member.id,
        schemeId: scheme.id,
        status: 'APPLIED',
      },
      include: {
        scheme: true,
        member: true,
        family: { select: { id: true, familyId: true, district: true } },
      },
    });

    await audit.record(
      {
        userId: user.id,
        action: audit.AUDIT_ACTIONS.BENEFICIARY_APPLIED,
        entityType: 'BeneficiaryApplication',
        entityId: application.id,
        newValue: {
          schemeName: scheme.name,
          memberName: member.name,
          familyId: member.family.familyId,
          status: 'APPLIED',
        },
      },
      tx
    );

    return application;
  });
}

/**
 * Citizen view of all applications submitted for their family.
 */
async function listMyApplications({ user }) {
  const family = await prisma.family.findFirst({
    where: { ownerId: user.id },
  });

  if (!family) return [];

  return prisma.beneficiaryApplication.findMany({
    where: { familyId: family.id },
    include: {
      scheme: true,
      member: true,
    },
    orderBy: { appliedAt: 'desc' },
  });
}

/**
 * Officer queue for reviewing beneficiary applications.
 */
async function listApplications({
  user,
  status,
  schemeId,
  page = 1,
  pageSize = 25,
}) {
  const districtScoped = user.role === ROLES.DISTRICT_OFFICER;
  const where = {
    ...(status ? { status } : {}),
    ...(schemeId ? { schemeId } : {}),
    ...(districtScoped && user.district ? { family: { district: user.district } } : {}),
  };

  const [applications, total] = await Promise.all([
    prisma.beneficiaryApplication.findMany({
      where,
      include: {
        scheme: true,
        member: true,
        family: { select: { id: true, familyId: true, district: true, taluka: true, village: true } },
        reviewedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { appliedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.beneficiaryApplication.count({ where }),
  ]);

  return {
    applications,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Officer reviews an application: APPROVE or REJECT.
 */
async function reviewApplication({ user, id, action, decisionReason }) {
  const statusMap = {
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
    UNDER_REVIEW: 'UNDER_REVIEW',
  };

  const nextStatus = statusMap[action];
  if (!nextStatus) {
    throw new AppError(422, 'Action must be APPROVE, REJECT, or UNDER_REVIEW');
  }

  if (action === 'REJECT' && !decisionReason) {
    throw new AppError(422, 'A reason is required when rejecting an application', [
      { field: 'decisionReason', message: 'Provide explanation for applicant' },
    ]);
  }

  const app = await prisma.beneficiaryApplication.findUnique({
    where: { id },
    include: { family: true, scheme: true, member: true },
  });

  if (!app) {
    throw new AppError(404, 'Beneficiary application not found');
  }

  if (user.role === ROLES.DISTRICT_OFFICER && app.family.district !== user.district) {
    throw new AppError(403, 'Cannot review applications from another district');
  }

  const auditAction =
    nextStatus === 'APPROVED'
      ? audit.AUDIT_ACTIONS.BENEFICIARY_APPROVED
      : nextStatus === 'REJECTED'
      ? audit.AUDIT_ACTIONS.BENEFICIARY_REJECTED
      : 'BENEFICIARY_REVIEW';

  return prisma.$transaction(async (tx) => {
    const updated = await tx.beneficiaryApplication.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewedById: user.id,
        reviewedAt: new Date(),
        decisionReason: decisionReason || null,
      },
      include: {
        scheme: true,
        member: true,
        family: true,
        reviewedBy: { select: { id: true, name: true, role: true } },
      },
    });

    await audit.record(
      {
        userId: user.id,
        action: auditAction,
        entityType: 'BeneficiaryApplication',
        entityId: id,
        oldValue: { status: app.status },
        newValue: { status: nextStatus, decisionReason },
        reason: decisionReason,
      },
      tx
    );

    return updated;
  });
}

module.exports = {
  apply,
  listMyApplications,
  listApplications,
  reviewApplication,
};
