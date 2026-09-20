const { prisma } = require('../config/database');

/**
 * Audit actions. Kept as constants so a typo becomes a crash at boot rather
 * than a silently unsearchable history entry.
 */
const AUDIT_ACTIONS = {
  FAMILY_CREATED: 'FAMILY_CREATED',
  FAMILY_UPDATED: 'FAMILY_UPDATED',
  FAMILY_SUBMITTED: 'FAMILY_SUBMITTED',
  FAMILY_VERIFIED: 'FAMILY_VERIFIED',
  FAMILY_REJECTED: 'FAMILY_REJECTED',
  FAMILY_HEAD_CHANGED: 'FAMILY_HEAD_CHANGED',
  MEMBER_ADDED: 'MEMBER_ADDED',
  MEMBER_UPDATED: 'MEMBER_UPDATED',
  MEMBER_VERIFIED: 'MEMBER_VERIFIED',
  MEMBER_REJECTED: 'MEMBER_REJECTED',
  RELATIONSHIP_CREATED: 'RELATIONSHIP_CREATED',
  RELATIONSHIP_VERIFIED: 'RELATIONSHIP_VERIFIED',
  RELATIONSHIP_REJECTED: 'RELATIONSHIP_REJECTED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_VERIFIED: 'DOCUMENT_VERIFIED',
  DOCUMENT_REJECTED: 'DOCUMENT_REJECTED',
  DUPLICATE_FLAGGED: 'DUPLICATE_FLAGGED',
  DUPLICATE_REVIEWED: 'DUPLICATE_REVIEWED',
  SCHEME_CREATED: 'SCHEME_CREATED',
  SCHEME_UPDATED: 'SCHEME_UPDATED',
  BENEFICIARY_APPLIED: 'BENEFICIARY_APPLIED',
  BENEFICIARY_APPROVED: 'BENEFICIARY_APPROVED',
  BENEFICIARY_REJECTED: 'BENEFICIARY_REJECTED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
};

/**
 * Appends an audit entry.
 *
 * Pass `client` when the change being recorded runs inside a transaction, so
 * the audit row commits or rolls back together with it -- an audit trail that
 * can disagree with the data it describes is worse than none.
 */
async function record(
  { userId = null, action, entityType, entityId, oldValue, newValue, reason },
  client = prisma
) {
  return client.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      oldValue: oldValue === undefined ? undefined : oldValue,
      newValue: newValue === undefined ? undefined : newValue,
      reason,
    },
  });
}

/** History for one entity, newest first. */
async function listForEntity(entityType, entityId, { limit = 50 } = {}) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { id: true, name: true, role: true } } },
  });
}

module.exports = { record, listForEntity, AUDIT_ACTIONS };
