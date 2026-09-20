const { z } = require('zod');

const VERIFICATION_ACTIONS = ['APPROVE', 'REJECT', 'REQUEST_DOCUMENT'];

const verifyActionSchema = z.object({
  action: z.enum(VERIFICATION_ACTIONS, {
    error: 'Action must be APPROVE, REJECT or REQUEST_DOCUMENT',
  }),
  reason: z.string().trim().min(3).max(500).optional(),
});

const pendingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

module.exports = { verifyActionSchema, pendingQuerySchema, VERIFICATION_ACTIONS };
