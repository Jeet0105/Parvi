const { z } = require('zod');

const DOCUMENT_TYPES = [
  'BIRTH_CERTIFICATE',
  'MARRIAGE_CERTIFICATE',
  'RATION_CARD',
  'AFFIDAVIT',
  'IDENTITY_PROOF',
  'ADDRESS_PROOF',
  'OTHER',
];

const VERIFICATION_ACTIONS = ['APPROVE', 'REJECT', 'REQUEST_DOCUMENT'];

// Multipart fields arrive as strings, so this validates the text form.
const uploadDocumentSchema = z.object({
  memberId: z.uuid('Invalid member id'),
  documentType: z.enum(DOCUMENT_TYPES, { error: 'Unknown document type' }),
  relationshipId: z.uuid('Invalid relationship id').optional(),
});

const verifyDocumentSchema = z.object({
  action: z.enum(VERIFICATION_ACTIONS, {
    error: 'Action must be APPROVE, REJECT or REQUEST_DOCUMENT',
  }),
  reason: z.string().trim().min(3).max(500).optional(),
});

const documentIdParamSchema = z.object({
  id: z.uuid('Invalid document id'),
});

const memberIdParamSchema = z.object({
  memberId: z.uuid('Invalid member id'),
});

const pendingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

module.exports = {
  uploadDocumentSchema,
  verifyDocumentSchema,
  documentIdParamSchema,
  memberIdParamSchema,
  pendingQuerySchema,
  DOCUMENT_TYPES,
};
