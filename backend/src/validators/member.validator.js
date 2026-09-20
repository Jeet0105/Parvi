const { z } = require('zod');

const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const MEMBER_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'DECEASED',
  'MIGRATED',
  'SEPARATED',
];

const requiredString = (label) =>
  z.string({
    error: (issue) =>
      issue.input === undefined ? `${label} is required` : `${label} must be text`,
  });

const personName = (label) =>
  requiredString(label)
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(100, `${label} must be at most 100 characters`);

const dateOfBirth = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((d) => !Number.isNaN(d.getTime()), 'Date of birth must be a valid date')
  .refine((d) => d <= new Date(), 'Date of birth cannot be in the future')
  .refine((d) => d >= new Date('1900-01-01'), 'Date of birth must be after 1900');

const createMemberSchema = z.object({
  name: personName('Name'),
  dateOfBirth,
  gender: z.enum(GENDERS, { error: 'Gender must be MALE, FEMALE or OTHER' }),
  fatherName: personName('Father name').optional(),
  motherName: personName('Mother name').optional(),
  spouseName: personName('Spouse name').optional(),
  isStudent: z.boolean().optional(),
  status: z.enum(MEMBER_STATUSES, { error: 'Unknown member status' }).optional(),
});

/** Every field optional, but the request must change something. */
const updateMemberSchema = z
  .object({
    name: personName('Name').optional(),
    dateOfBirth: dateOfBirth.optional(),
    gender: z.enum(GENDERS, { error: 'Gender must be MALE, FEMALE or OTHER' }).optional(),
    fatherName: personName('Father name').optional(),
    motherName: personName('Mother name').optional(),
    spouseName: personName('Spouse name').optional(),
    isStudent: z.boolean().optional(),
    status: z.enum(MEMBER_STATUSES, { error: 'Unknown member status' }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Provide at least one field to update',
  });

const memberIdParamSchema = z.object({
  id: z.uuid('Invalid member id'),
});

const familyIdParamSchema = z.object({
  familyId: requiredString('Family id').trim().min(1),
});

const listMembersQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

const changeHeadSchema = z.object({
  memberId: z.uuid('Invalid member id'),
});

module.exports = {
  createMemberSchema,
  updateMemberSchema,
  memberIdParamSchema,
  familyIdParamSchema,
  listMembersQuerySchema,
  changeHeadSchema,
  GENDERS,
  MEMBER_STATUSES,
};
