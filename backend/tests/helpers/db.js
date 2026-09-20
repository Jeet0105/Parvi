const { prisma, disconnectDatabase } = require('../../src/config/database');

/**
 * Order matters: children before parents. Family.familyHeadId also points at
 * FamilyMember, so the FK is cleared before members are removed.
 */
async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.duplicateReview.deleteMany();
  await prisma.beneficiaryApplication.deleteMany();
  await prisma.document.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.scheme.deleteMany();

  await prisma.family.updateMany({ data: { familyHeadId: null } });

  await prisma.familyMember.deleteMany();
  await prisma.family.deleteMany();
  await prisma.user.deleteMany();
}

module.exports = { prisma, resetDatabase, disconnectDatabase };
