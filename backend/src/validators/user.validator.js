const { z } = require('zod');

const ROLE_VALUES = [
  'CITIZEN',
  'VERIFICATION_OFFICER',
  'DISTRICT_OFFICER',
  'ADMIN',
];

const idParamSchema = z.object({
  id: z.uuid('Invalid user id'),
});

const listUsersQuerySchema = z.object({
  role: z.enum(ROLE_VALUES, { error: 'Unknown role' }).optional(),
  district: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

const updateRoleSchema = z.object({
  role: z.enum(ROLE_VALUES, { error: 'Unknown role' }),
});

module.exports = {
  idParamSchema,
  listUsersQuerySchema,
  updateRoleSchema,
  ROLE_VALUES,
};
