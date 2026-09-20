const { prisma } = require('../config/database');
const { success } = require('../utils/apiResponse');

async function list(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 25, 100);

  const where = {};
  if (req.query.entityType) where.entityType = req.query.entityType;
  if (req.query.action) where.action = req.query.action;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    }),
  ]);

  return success(res, 200, 'Audit logs retrieved', {
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

async function getEntityAudit(req, res) {
  const { entityType, entityId } = req.params;

  const logs = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  return success(res, 200, 'Entity audit history retrieved', { logs });
}

module.exports = { list, getEntityAudit };
