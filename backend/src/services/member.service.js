const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const { ROLES } = require('../middleware/role.middleware');
const audit = require('./audit.service');
const familyService = require('./family.service');

/** Guards against a single family being used as unbounded storage. */
const MAX_MEMBERS_PER_FAMILY = 50;

/** Fields describing who a person is, as opposed to their lifecycle state. */
const IDENTITY_FIELDS = [
  'name',
  'dateOfBirth',
  'gender',
  'fatherName',
  'motherName',
  'spouseName',
  'isStudent',
];

/** Statuses meaning the member is no longer an active part of the household. */
const INACTIVE_STATUSES = ['DECEASED', 'MIGRATED', 'SEPARATED', 'INACTIVE'];

/**
 * Adds a member to a family.
 *
 * Permitted even when the family is already VERIFIED: births and marriages
 * happen, and the platform must record them. The new member simply starts
 * PENDING verification of their own, leaving the family status untouched.
 */
async function addMember({ user, familyId, data }) {
  const family = await familyService.getFamily({ user, id: familyId });

  if (!familyService.canEditFamily(user, family)) {
    throw new AppError(403, 'You do not have permission to modify this family');
  }

  const memberCount = await prisma.familyMember.count({
    where: { familyId: family.id },
  });

  if (memberCount >= MAX_MEMBERS_PER_FAMILY) {
    throw new AppError(
      409,
      `A family cannot have more than ${MAX_MEMBERS_PER_FAMILY} members`
    );
  }

  return prisma.$transaction(async (tx) => {
    const member = await tx.familyMember.create({
      data: {
        familyId: family.id,
        name: data.name,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        fatherName: data.fatherName,
        motherName: data.motherName,
        spouseName: data.spouseName,
        isStudent: data.isStudent ?? false,
        status: data.status ?? 'ACTIVE',
      },
    });

    await audit.record(
      {
        userId: user.id,
        action: audit.AUDIT_ACTIONS.MEMBER_ADDED,
        entityType: 'FamilyMember',
        entityId: member.id,
        newValue: {
          name: member.name,
          familyId: family.familyId,
          status: member.status,
        },
      },
      tx
    );

    return member;
  });
}

async function listMembers({ user, familyId, includeInactive = true }) {
  const family = await familyService.getFamily({ user, id: familyId });

  const members = await prisma.familyMember.findMany({
    where: {
      familyId: family.id,
      ...(includeInactive ? {} : { status: 'ACTIVE' }),
    },
    orderBy: { createdAt: 'asc' },
  });

  return { family, members };
}

/** Loads a member and the family it belongs to, enforcing read access. */
async function getMemberWithFamily({ user, memberId }) {
  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
    include: { family: true },
  });

  if (!member) {
    throw new AppError(404, 'Member not found');
  }

  if (!familyService.canAccessFamily(user, member.family)) {
    // 404, not 403, so member ids cannot be probed from outside the family.
    throw new AppError(404, 'Member not found');
  }

  return member;
}

async function getMember({ user, memberId }) {
  return getMemberWithFamily({ user, memberId });
}

/**
 * Updates a member.
 *
 * Identity details freeze once an officer has verified the member -- changing
 * them afterwards would invalidate that verification. Lifecycle status stays
 * editable, because death and migration happen after verification, not before.
 */
async function updateMember({ user, memberId, data }) {
  const member = await getMemberWithFamily({ user, memberId });

  if (!familyService.canEditFamily(user, member.family)) {
    throw new AppError(403, 'You do not have permission to modify this family');
  }

  const identityChanges = IDENTITY_FIELDS.filter((field) => field in data);

  if (identityChanges.length > 0 && member.verificationStatus === 'VERIFIED') {
    throw new AppError(
      409,
      'A verified member cannot have their details edited. Submit a correction request.'
    );
  }

  // Removing the Family Head from the household would leave the family
  // headless, so the head must be reassigned first.
  if (
    data.status &&
    INACTIVE_STATUSES.includes(data.status) &&
    member.family.familyHeadId === member.id
  ) {
    throw new AppError(
      409,
      'Assign a new Family Head before changing the current head status'
    );
  }

  const changed = Object.keys(data).filter((key) => {
    const before = member[key];
    const after = data[key];
    if (before instanceof Date) {
      return new Date(after).getTime() !== before.getTime();
    }
    return before !== after;
  });

  if (changed.length === 0) {
    return member;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.familyMember.update({
      where: { id: member.id },
      data,
    });

    await audit.record(
      {
        userId: user.id,
        action: audit.AUDIT_ACTIONS.MEMBER_UPDATED,
        entityType: 'FamilyMember',
        entityId: member.id,
        oldValue: Object.fromEntries(changed.map((k) => [k, member[k]])),
        newValue: Object.fromEntries(changed.map((k) => [k, updated[k]])),
      },
      tx
    );

    return updated;
  });
}

/** Moves the Family Head designation to another active member. */
async function changeFamilyHead({ user, familyId, memberId }) {
  const family = await familyService.getFamily({ user, id: familyId });

  if (!familyService.canEditFamily(user, family)) {
    throw new AppError(403, 'You do not have permission to modify this family');
  }

  const member = await prisma.familyMember.findUnique({ where: { id: memberId } });

  if (!member || member.familyId !== family.id) {
    throw new AppError(404, 'Member not found in this family');
  }

  if (member.status !== 'ACTIVE') {
    throw new AppError(409, 'Only an active member can be the Family Head');
  }

  if (family.familyHeadId === member.id) {
    return family;
  }

  const previousHead = family.members.find((m) => m.id === family.familyHeadId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.family.update({
      where: { id: family.id },
      data: { familyHeadId: member.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        familyHead: true,
        members: { orderBy: { createdAt: 'asc' } },
      },
    });

    await audit.record(
      {
        userId: user.id,
        action: audit.AUDIT_ACTIONS.FAMILY_HEAD_CHANGED,
        entityType: 'Family',
        entityId: family.id,
        oldValue: previousHead
          ? { familyHeadId: previousHead.id, name: previousHead.name }
          : null,
        newValue: { familyHeadId: member.id, name: member.name },
      },
      tx
    );

    return updated;
  });
}

module.exports = {
  addMember,
  listMembers,
  getMember,
  updateMember,
  changeFamilyHead,
  MAX_MEMBERS_PER_FAMILY,
  IDENTITY_FIELDS,
  INACTIVE_STATUSES,
};
