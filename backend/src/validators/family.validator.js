const { z } = require('zod');

const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const FAMILY_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'];

const requiredString = (label) =>
  z.string({
    error: (issue) =>
      issue.input === undefined ? `${label} is required` : `${label} must be text`,
  });

const placeName = (label) =>
  requiredString(label).trim().min(2, `${label} must be at least 2 characters`).max(100);

/** A past date. Rejects future births and implausible ages. */
const dateOfBirth = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((d) => !Number.isNaN(d.getTime()), 'Date of birth must be a valid date')
  .refine((d) => d <= new Date(), 'Date of birth cannot be in the future')
  .refine(
    (d) => d >= new Date('1900-01-01'),
    'Date of birth must be after 1900'
  );

const personName = z.string().trim().min(2).max(100);

const headSchema = z.object({
  // Defaults to the registering citizen's own name when omitted.
  name: personName.optional(),
  dateOfBirth,
  gender: z.enum(GENDERS, { error: 'Gender must be MALE, FEMALE or OTHER' }),
  fatherName: personName.optional(),
  motherName: personName.optional(),
  spouseName: personName.optional(),
  isStudent: z.boolean().optional(),
});

const createFamilySchema = z.object({
  state: placeName('State').default('Gujarat'),
  district: placeName('District'),
  taluka: placeName('Taluka'),
  village: placeName('Village'),
  address: requiredString('Address').trim().min(5, 'Address must be at least 5 characters').max(300),
  annualIncome: z.coerce.number().nonnegative().max(1e10).optional(),
  ownsHouse: z.boolean().optional(),
  head: headSchema,
});

/** Every field optional, but at least one must be present. */
const updateFamilySchema = z
  .object({
    state: placeName('State').optional(),
    district: placeName('District').optional(),
    taluka: placeName('Taluka').optional(),
    village: placeName('Village').optional(),
    address: requiredString('Address').trim().min(5).max(300).optional(),
    annualIncome: z.coerce.number().nonnegative().max(1e10).optional(),
    ownsHouse: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Provide at least one field to update',
  });

const familyIdParamSchema = z.object({
  id: requiredString('Family id').trim().min(1),
});

const listFamiliesQuerySchema = z.object({
  status: z.enum(FAMILY_STATUSES, { error: 'Unknown family status' }).optional(),
  district: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

module.exports = {
  createFamilySchema,
  updateFamilySchema,
  familyIdParamSchema,
  listFamiliesQuerySchema,
  GENDERS,
  FAMILY_STATUSES,
};
