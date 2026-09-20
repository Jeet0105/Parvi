const { z } = require('zod');

const RELATIONSHIP_TYPES = [
  'FATHER',
  'MOTHER',
  'SON',
  'DAUGHTER',
  'SPOUSE',
  'BROTHER',
  'SISTER',
  'GRANDFATHER',
  'GRANDMOTHER',
  'GRANDSON',
  'GRANDDAUGHTER',
];

const VERIFICATION_ACTIONS = ['APPROVE', 'REJECT', 'REQUEST_DOCUMENT'];

const VERIFICATION_STATUSES = [
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
];

const createRelationshipSchema = z.object({
  fromMemberId: z.uuid('Invalid member id'),
  toMemberId: z.uuid('Invalid member id'),
  relationshipType: z.enum(RELATIONSHIP_TYPES, {
    error: 'Unknown relationship type',
  }),
});

const verifyRelationshipSchema = z.object({
  action: z.enum(VERIFICATION_ACTIONS, {
    error: 'Action must be APPROVE, REJECT or REQUEST_DOCUMENT',
  }),
  reason: z.string().trim().min(3).max(500).optional(),
});

const relationshipIdParamSchema = z.object({
  id: z.uuid('Invalid relationship id'),
});

const listRelationshipsQuerySchema = z.object({
  verificationStatus: z
    .enum(VERIFICATION_STATUSES, { error: 'Unknown verification status' })
    .optional(),
});

const pendingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

module.exports = {
  createRelationshipSchema,
  verifyRelationshipSchema,
  relationshipIdParamSchema,
  listRelationshipsQuerySchema,
  pendingQuerySchema,
  RELATIONSHIP_TYPES,
  VERIFICATION_ACTIONS,
};
