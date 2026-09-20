const fs = require('node:fs/promises');
const path = require('node:path');

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const { uploadDir } = require('../config/upload');
const { ROLES } = require('../middleware/role.middleware');
const audit = require('./audit.service');
const familyService = require('./family.service');

const documentInclude = {
  member: { select: { id: true, name: true, familyId: true } },
  uploadedBy: { select: { id: true, name: true } },
  verifiedBy: { select: { id: true, name: true } },
};

/** Best-effort cleanup of an orphaned upload; never masks the real error. */
async function discardFile(storedPath) {
  if (!storedPath) return;
  try {
    await fs.unlink(storedPath);
  } catch {
    // The row was never created, so a leftover file is harmless.
  }
}

/**
 * Records an uploaded document against a member.
 *
 * The file is already on disk by the time this runs, so any rejection here
 * deletes it rather than leaving an unreferenced file behind.
 */
async function createDocument({ user, file, data }) {
  if (!file) {
    throw new AppError(422, 'A file is required', [
      { field: 'file', message: 'Attach a document to upload' },
    ]);
  }

  try {
    const member = await prisma.familyMember.findUnique({
      where: { id: data.memberId },
      include: { family: true },
    });

    if (!member || !familyService.canAccessFamily(user, member.family)) {
      throw new AppError(404, 'Member not found');
    }

    if (!familyService.canEditFamily(user, member.family)) {
      throw new AppError(403, 'You do not have permission to modify this family');
    }

    // A relationship document must belong to the same family as the member.
    if (data.relationshipId) {
      const relationship = await prisma.relationship.findUnique({
        where: { id: data.relationshipId },
      });
      if (!relationship || relationship.familyId !== member.familyId) {
        throw new AppError(404, 'Relationship not found in this family');
      }
    }

    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          memberId: member.id,
          relationshipId: data.relationshipId || null,
          documentType: data.documentType,
          filePath: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedById: user.id,
        },
        include: documentInclude,
      });

      await audit.record(
        {
          userId: user.id,
          action: audit.AUDIT_ACTIONS.DOCUMENT_UPLOADED,
          entityType: 'Document',
          entityId: created.id,
          newValue: {
            documentType: created.documentType,
            member: member.name,
            originalName: created.originalName,
          },
        },
        tx
      );

      return created;
    });

    return document;
  } catch (err) {
    await discardFile(file.path);
    throw err;
  }
}

async function getDocument({ user, id }) {
  const document = await prisma.document.findUnique({
    where: { id },
    include: { ...documentInclude, member: { include: { family: true } } },
  });

  if (!document || !familyService.canAccessFamily(user, document.member.family)) {
    // 404 rather than 403: document ids must not be probeable.
    throw new AppError(404, 'Document not found');
  }

  return document;
}

/**
 * Resolves the absolute path of a stored file for download.
 *
 * `filePath` is a generated basename, but it is re-checked here so a corrupted
 * or tampered row can never escape the upload directory.
 */
async function getDocumentFile({ user, id }) {
  const document = await getDocument({ user, id });

  const root = uploadDir();
  const absolute = path.resolve(root, path.basename(document.filePath));

  if (!absolute.startsWith(root + path.sep)) {
    throw new AppError(404, 'Document not found');
  }

  try {
    await fs.access(absolute);
  } catch {
    throw new AppError(404, 'Document file is no longer available');
  }

  return { document, absolutePath: absolute };
}

async function listForMember({ user, memberId }) {
  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
    include: { family: true },
  });

  if (!member || !familyService.canAccessFamily(user, member.family)) {
    throw new AppError(404, 'Member not found');
  }

  return prisma.document.findMany({
    where: { memberId },
    include: documentInclude,
    orderBy: { uploadedAt: 'desc' },
  });
}

async function listForFamily({ user, familyId, verificationStatus }) {
  const family = await familyService.getFamily({ user, id: familyId });

  const documents = await prisma.document.findMany({
    where: {
      member: { familyId: family.id },
      ...(verificationStatus ? { verificationStatus } : {}),
    },
    include: documentInclude,
    orderBy: { uploadedAt: 'desc' },
  });

  return { family, documents };
}

const DECISIONS = {
  APPROVE: 'VERIFIED',
  REJECT: 'REJECTED',
  REQUEST_DOCUMENT: 'UNDER_REVIEW',
};

async function verifyDocument({ user, id, action, reason }) {
  const document = await getDocument({ user, id });
  const nextStatus = DECISIONS[action];

  if (!nextStatus) {
    throw new AppError(422, 'Unknown verification action');
  }

  if (document.verificationStatus === nextStatus) {
    throw new AppError(409, `Document is already ${nextStatus}`);
  }

  if (action === 'REJECT' && !reason) {
    throw new AppError(422, 'A reason is required when rejecting', [
      { field: 'reason', message: 'Explain why this document was rejected' },
    ]);
  }

  const auditAction =
    nextStatus === 'REJECTED'
      ? audit.AUDIT_ACTIONS.DOCUMENT_REJECTED
      : audit.AUDIT_ACTIONS.DOCUMENT_VERIFIED;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: document.id },
      data: {
        verificationStatus: nextStatus,
        verifiedById: user.id,
        verifiedAt: nextStatus === 'VERIFIED' ? new Date() : null,
        rejectionReason: nextStatus === 'REJECTED' ? reason : null,
      },
      include: documentInclude,
    });

    await audit.record(
      {
        userId: user.id,
        action: auditAction,
        entityType: 'Document',
        entityId: document.id,
        oldValue: { verificationStatus: document.verificationStatus },
        newValue: { verificationStatus: nextStatus },
        reason,
      },
      tx
    );

    return updated;
  });
}

/** Officer queue of documents awaiting a decision. */
async function listPending({ user, page = 1, pageSize = 25 }) {
  const where = {
    verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] },
    ...(user.role === ROLES.DISTRICT_OFFICER
      ? { member: { family: { district: user.district } } }
      : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, name: true } },
        member: {
          select: {
            id: true,
            name: true,
            family: { select: { id: true, familyId: true, district: true } },
          },
        },
      },
      orderBy: { uploadedAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.document.count({ where }),
  ]);

  return {
    documents,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

module.exports = {
  createDocument,
  getDocument,
  getDocumentFile,
  listForMember,
  listForFamily,
  verifyDocument,
  listPending,
  DECISIONS,
};
