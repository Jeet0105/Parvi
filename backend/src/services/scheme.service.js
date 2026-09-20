const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const familyService = require('./family.service');
const { evaluateMember } = require('./eligibility.service');

const DEFAULT_SCHEMES = [
  {
    name: 'Housing Assistance (PM Awas Yojana Gramin)',
    description: 'Financial subsidy assistance for constructing permanent pucca houses for low-income families without homesteads.',
    eligibilityRule: { maxIncome: 180000, ownsHouse: false },
    status: 'ACTIVE',
  },
  {
    name: 'Education Support (Mukhyamantri Yuva Swavalamban)',
    description: 'Tuition waiver, textbook allowance, and hostel expense stipend for students pursuing higher education.',
    eligibilityRule: { maxAge: 25, isStudent: true },
    status: 'ACTIVE',
  },
  {
    name: 'Senior Citizen Support (Vayoshreshtha Samman)',
    description: 'Monthly financial security pension and free geriatric healthcare assistance for senior citizens.',
    eligibilityRule: { minAge: 60 },
    status: 'ACTIVE',
  },
  {
    name: 'Health Assistance (Ayushman Bharat)',
    description: 'Annual cashless hospitalization coverage up to ₹5,00,000 per family for secondary and tertiary healthcare.',
    eligibilityRule: { maxIncome: 250000 },
    status: 'ACTIVE',
  },
];

async function seedDefaultSchemes() {
  for (const item of DEFAULT_SCHEMES) {
    await prisma.scheme.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    });
  }
}

async function listSchemes() {
  await seedDefaultSchemes();
  return prisma.scheme.findMany({
    orderBy: { createdAt: 'asc' },
  });
}

async function getSchemeById(id) {
  const scheme = await prisma.scheme.findUnique({
    where: { id },
    include: {
      _count: { select: { applications: true } },
    },
  });

  if (!scheme) {
    throw new AppError(404, 'Scheme not found');
  }

  return scheme;
}

/**
 * Returns all active schemes with per-member eligibility evaluation for a family.
 */
async function getEligibleSchemesForFamily({ user, familyId }) {
  await seedDefaultSchemes();
  const family = await familyService.getFamily({ user, id: familyId });

  const [schemes, applications] = await Promise.all([
    prisma.scheme.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.beneficiaryApplication.findMany({
      where: { familyId: family.id },
      include: { scheme: true, member: true },
    }),
  ]);

  const appMap = new Map();
  for (const app of applications) {
    appMap.set(`${app.memberId}_${app.schemeId}`, app);
  }

  const result = schemes.map((scheme) => {
    const memberEvaluations = family.members.map((member) => {
      const evaluation = evaluateMember(member, family, scheme.eligibilityRule);
      const existingApp = appMap.get(`${member.id}_${scheme.id}`);

      return {
        member: {
          id: member.id,
          name: member.name,
          dateOfBirth: member.dateOfBirth,
          gender: member.gender,
          isStudent: member.isStudent,
        },
        eligible: evaluation.eligible,
        reasons: evaluation.reasons,
        application: existingApp
          ? {
              id: existingApp.id,
              status: existingApp.status,
              appliedAt: existingApp.appliedAt,
            }
          : null,
      };
    });

    const eligibleCount = memberEvaluations.filter((m) => m.eligible).length;

    return {
      scheme,
      eligibleMembersCount: eligibleCount,
      members: memberEvaluations,
    };
  });

  return { family, schemes: result };
}

module.exports = {
  listSchemes,
  getSchemeById,
  getEligibleSchemesForFamily,
  seedDefaultSchemes,
};
