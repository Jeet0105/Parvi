/**
 * Comprehensive Development & Demo Seed Script.
 *
 * Populates realistic, synthetic data across all platform modules:
 * 1. Government & Administrative accounts (Verification Officer, District Officer, Admin)
 * 2. 9 Diverse Citizen households across Gujarat districts (Ahmedabad, Surat, Vadodara, Rajkot, Bhavnagar, Gandhinagar, Anand, Mehsana)
 * 3. 4 Government Welfare Schemes with eligibility evaluation rules
 * 4. Demographics, Students, Senior Citizens, Head designations
 * 5. Full relationship networks (Spouse, Parent-Child, Grandparents)
 * 6. Duplicate review candidate for demonstration
 * 7. Beneficiary Applications for scheme evaluation
 * 8. Audit logs
 *
 * Usage:
 *   npm run db:seed
 */
require('dotenv').config({ quiet: true });

const bcrypt = require('bcrypt');
const { prisma } = require('../src/config/database');

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'Password123';

const GOVERNMENT_ACCOUNTS = [
  {
    name: 'Anand Sharma (Verification Officer)',
    email: 'officer@example.gov',
    mobile: '9800000001',
    role: 'VERIFICATION_OFFICER',
    district: 'Ahmedabad',
  },
  {
    name: 'Meera Desai (District Officer)',
    email: 'district@example.gov',
    mobile: '9800000002',
    role: 'DISTRICT_OFFICER',
    district: 'Ahmedabad',
  },
  {
    name: 'Rajesh Joshi (System Admin)',
    email: 'admin@example.gov',
    mobile: '9800000003',
    role: 'ADMIN',
    district: null,
  },
];

const CITIZEN_ACCOUNTS = [
  { name: 'Rahul Patel', email: 'rahul@example.com', mobile: '9900000001', district: 'Ahmedabad' },
  { name: 'Amit Kumar', email: 'amit@example.com', mobile: '9900000002', district: 'Ahmedabad' },
  { name: 'Ramesh Mehta', email: 'ramesh.mehta@example.com', mobile: '9900000003', district: 'Surat' },
  { name: 'Jignesh Shah', email: 'jignesh.shah@example.com', mobile: '9900000004', district: 'Vadodara' },
  { name: 'Bhavesh Vaghela', email: 'bhavesh.vaghela@example.com', mobile: '9900000005', district: 'Rajkot' },
  { name: 'Harshad Trivedi', email: 'harshad.trivedi@example.com', mobile: '9900000006', district: 'Bhavnagar' },
  { name: 'Sanjay Solanki', email: 'sanjay.solanki@example.com', mobile: '9900000007', district: 'Gandhinagar' },
  { name: 'Manish Prajapati', email: 'manish.prajapati@example.com', mobile: '9900000008', district: 'Anand' },
  { name: 'Devendra Parmar', email: 'devendra.parmar@example.com', mobile: '9900000009', district: 'Mehsana' },
];

const SCHEMES = [
  {
    name: 'Pradhan Mantri Awas Yojana (Housing Assistance)',
    description:
      'Provides financial assistance for affordable housing to families without a pucca house earning under ₹3,00,000 annually.',
    eligibilityRule: {
      maxAnnualIncome: 300000,
      ownsHouse: false,
    },
    status: 'ACTIVE',
  },
  {
    name: 'Mukhyamantri Higher Education Scholarship',
    description:
      'Financial scholarship for enrolled students under the age of 25 to pursue college and vocational degree courses.',
    eligibilityRule: {
      maxAge: 25,
      isStudent: true,
    },
    status: 'ACTIVE',
  },
  {
    name: 'Ayushman Bharat PM-JAY (Health Insurance)',
    description:
      'Universal health coverage up to ₹5,00,000 per family per year for secondary and tertiary care hospitalization.',
    eligibilityRule: {
      maxAnnualIncome: 500000,
    },
    status: 'ACTIVE',
  },
  {
    name: 'Indira Gandhi National Old Age Pension',
    description:
      'Monthly pension stipend for senior citizens aged 60 years and above from low-income families.',
    eligibilityRule: {
      minAge: 60,
    },
    status: 'ACTIVE',
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error('Refusing to seed demo accounts in production environment');
  }

  console.log('🌱 Starting comprehensive multi-family database seeding...\n');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // 1. Seed Government Accounts
  console.log('1. Seeding Officer & Admin Accounts:');
  const seededOfficers = {};
  for (const account of GOVERNMENT_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, role: account.role, district: account.district },
      create: { ...account, passwordHash },
    });
    seededOfficers[account.role] = user;
    console.log(`   ✓ ${user.role.padEnd(22)}: ${user.email}`);
  }

  // 2. Seed Citizen Accounts
  console.log('\n2. Seeding 9 Citizen Accounts:');
  const seededCitizens = {};
  for (const account of CITIZEN_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, role: account.role, district: account.district },
      create: { ...account, passwordHash },
    });
    seededCitizens[account.email] = user;
    console.log(`   ✓ CITIZEN: ${user.name.padEnd(20)} (${user.email}) - ${account.district}`);
  }

  // 3. Seed Schemes
  console.log('\n3. Seeding Welfare Schemes:');
  const seededSchemes = [];
  for (const schemeData of SCHEMES) {
    const scheme = await prisma.scheme.upsert({
      where: { name: schemeData.name },
      update: {
        description: schemeData.description,
        eligibilityRule: schemeData.eligibilityRule,
        status: schemeData.status,
      },
      create: schemeData,
    });
    seededSchemes.push(scheme);
    console.log(`   ✓ Scheme: "${scheme.name}"`);
  }

  const verifierId = seededOfficers['VERIFICATION_OFFICER']?.id;
  const eduScheme = seededSchemes.find((s) => s.name.includes('Education'));
  const houseScheme = seededSchemes.find((s) => s.name.includes('Housing'));
  const healthScheme = seededSchemes.find((s) => s.name.includes('Ayushman'));
  const pensionScheme = seededSchemes.find((s) => s.name.includes('Pension'));

  // 4. Seed 9 Families
  console.log('\n4. Seeding 9 Complete Family Households:');

  // --- Family 1: Rahul Patel (Verified, 4 members) ---
  const user1 = seededCitizens['rahul@example.com'];
  let fam1 = await prisma.family.upsert({
    where: { familyId: 'GJ-FAM-8A72K91X' },
    update: {},
    create: {
      familyId: 'GJ-FAM-8A72K91X',
      status: 'VERIFIED',
      ownerId: user1.id,
      state: 'Gujarat',
      district: 'Ahmedabad',
      taluka: 'Daskroi',
      village: 'Ghatlodiya',
      address: '42, Shanti Nagar, Near Subhash Chowk',
      annualIncome: 240000,
      ownsHouse: false,
      verifiedAt: new Date(),
      verifiedById: verifierId,
    },
  });

  const m1_head = await prisma.familyMember.upsert({
    where: { id: 'm-f1-01' },
    update: {},
    create: {
      id: 'm-f1-01',
      familyId: fam1.id,
      userId: user1.id,
      name: 'Rahul Patel',
      dateOfBirth: new Date('1985-06-15'),
      gender: 'MALE',
      fatherName: 'Kantilal Patel',
      motherName: 'Jasodaben Patel',
      spouseName: 'Priya Patel',
      isStudent: false,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedById: verifierId,
    },
  });
  await prisma.family.update({ where: { id: fam1.id }, data: { familyHeadId: m1_head.id } });

  const m1_spouse = await prisma.familyMember.upsert({
    where: { id: 'm-f1-02' },
    update: {},
    create: {
      id: 'm-f1-02',
      familyId: fam1.id,
      name: 'Priya Patel',
      dateOfBirth: new Date('1988-09-22'),
      gender: 'FEMALE',
      fatherName: 'Ramesh Shah',
      motherName: 'Meenaben Shah',
      spouseName: 'Rahul Patel',
      isStudent: false,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedById: verifierId,
    },
  });

  const m1_son = await prisma.familyMember.upsert({
    where: { id: 'm-f1-03' },
    update: {},
    create: {
      id: 'm-f1-03',
      familyId: fam1.id,
      name: 'Vivek Patel',
      dateOfBirth: new Date('2005-03-10'),
      gender: 'MALE',
      fatherName: 'Rahul Patel',
      motherName: 'Priya Patel',
      isStudent: true,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedById: verifierId,
    },
  });

  const m1_grand = await prisma.familyMember.upsert({
    where: { id: 'm-f1-04' },
    update: {},
    create: {
      id: 'm-f1-04',
      familyId: fam1.id,
      name: 'Kantilal Patel',
      dateOfBirth: new Date('1958-01-05'),
      gender: 'MALE',
      isStudent: false,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedById: verifierId,
    },
  });

  // Family 1 Relationships
  const rels1 = [
    { from: m1_head.id, to: m1_spouse.id, type: 'SPOUSE' },
    { from: m1_head.id, to: m1_son.id, type: 'SON' },
    { from: m1_spouse.id, to: m1_son.id, type: 'SON' },
    { from: m1_grand.id, to: m1_head.id, type: 'SON' },
  ];
  for (const r of rels1) {
    await prisma.relationship.upsert({
      where: {
        fromMemberId_toMemberId_relationshipType: {
          fromMemberId: r.from,
          toMemberId: r.to,
          relationshipType: r.type,
        },
      },
      update: {},
      create: {
        familyId: fam1.id,
        fromMemberId: r.from,
        toMemberId: r.to,
        relationshipType: r.type,
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedById: verifierId,
      },
    });
  }

  // Family 1 Applications
  if (eduScheme) {
    await prisma.beneficiaryApplication.upsert({
      where: { memberId_schemeId: { memberId: m1_son.id, schemeId: eduScheme.id } },
      update: {},
      create: {
        familyId: fam1.id,
        memberId: m1_son.id,
        schemeId: eduScheme.id,
        status: 'APPROVED',
        reviewedById: verifierId,
        reviewedAt: new Date(),
        decisionReason: 'Verified college student enrolled in undergraduate degree.',
      },
    });
  }
  if (houseScheme) {
    await prisma.beneficiaryApplication.upsert({
      where: { memberId_schemeId: { memberId: m1_head.id, schemeId: houseScheme.id } },
      update: {},
      create: {
        familyId: fam1.id,
        memberId: m1_head.id,
        schemeId: houseScheme.id,
        status: 'APPLIED',
      },
    });
  }
  console.log(`   [1/9] ${fam1.familyId} (Verified, 4 members) - Rahul Patel`);

  // --- Family 2: Amit Kumar (Pending + Duplicate Suspect) ---
  const user2 = seededCitizens['amit@example.com'];
  let fam2 = await prisma.family.upsert({
    where: { familyId: 'GJ-FAM-9B83L02Y' },
    update: {},
    create: {
      familyId: 'GJ-FAM-9B83L02Y',
      status: 'PENDING_VERIFICATION',
      ownerId: user2.id,
      state: 'Gujarat',
      district: 'Ahmedabad',
      taluka: 'Daskroi',
      village: 'Ghatlodiya',
      address: '15, Ambica Park, Near Shanti Nagar',
      annualIncome: 180000,
      ownsHouse: false,
    },
  });

  const m2_head = await prisma.familyMember.upsert({
    where: { id: 'm-f2-01' },
    update: {},
    create: {
      id: 'm-f2-01',
      familyId: fam2.id,
      userId: user2.id,
      name: 'Amit Kumar',
      dateOfBirth: new Date('1987-04-18'),
      gender: 'MALE',
      isStudent: false,
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });
  await prisma.family.update({ where: { id: fam2.id }, data: { familyHeadId: m2_head.id } });

  const m2_dup = await prisma.familyMember.upsert({
    where: { id: 'm-f2-dup' },
    update: {},
    create: {
      id: 'm-f2-dup',
      familyId: fam2.id,
      name: 'Rahul K. Patel',
      dateOfBirth: new Date('1985-06-15'),
      gender: 'MALE',
      fatherName: 'Kantilal Patel',
      motherName: 'Jasodaben Patel',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });

  // Duplicate Review Flag
  await prisma.duplicateReview.upsert({
    where: {
      sourceMemberId_matchedMemberId: {
        sourceMemberId: m2_dup.id,
        matchedMemberId: m1_head.id,
      },
    },
    update: {},
    create: {
      sourceMemberId: m2_dup.id,
      matchedMemberId: m1_head.id,
      score: 92,
      breakdown: {
        nameSimilarity: 90,
        dobMatch: 100,
        fatherMatch: 95,
        addressSimilarity: 85,
      },
      status: 'PENDING_REVIEW',
    },
  });
  console.log(`   [2/9] ${fam2.familyId} (Pending, 2 members) - Amit Kumar [Duplicate Candidate Flagged]`);

  // --- Family 3: Ramesh Mehta (Surat, Verified, 4 members) ---
  const user3 = seededCitizens['ramesh.mehta@example.com'];
  let fam3 = await prisma.family.upsert({
    where: { familyId: 'GJ-FAM-1C34M13Z' },
    update: {},
    create: {
      familyId: 'GJ-FAM-1C34M13Z',
      status: 'VERIFIED',
      ownerId: user3.id,
      state: 'Gujarat',
      district: 'Surat',
      taluka: 'Choryasi',
      village: 'Adajan',
      address: 'B-204, Riverview Heights, Adajan',
      annualIncome: 420000,
      ownsHouse: true,
      verifiedAt: new Date(),
      verifiedById: verifierId,
    },
  });

  const m3_head = await prisma.familyMember.upsert({
    where: { id: 'm-f3-01' },
    update: {},
    create: {
      id: 'm-f3-01',
      familyId: fam3.id,
      userId: user3.id,
      name: 'Ramesh Mehta',
      dateOfBirth: new Date('1976-11-12'),
      gender: 'MALE',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });
  await prisma.family.update({ where: { id: fam3.id }, data: { familyHeadId: m3_head.id } });

  const m3_spouse = await prisma.familyMember.upsert({
    where: { id: 'm-f3-02' },
    update: {},
    create: {
      id: 'm-f3-02',
      familyId: fam3.id,
      name: 'Geeta Mehta',
      dateOfBirth: new Date('1979-08-25'),
      gender: 'FEMALE',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });

  const m3_daughter = await prisma.familyMember.upsert({
    where: { id: 'm-f3-03' },
    update: {},
    create: {
      id: 'm-f3-03',
      familyId: fam3.id,
      name: 'Pooja Mehta',
      dateOfBirth: new Date('2006-07-14'),
      gender: 'FEMALE',
      isStudent: true,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });

  const m3_son = await prisma.familyMember.upsert({
    where: { id: 'm-f3-04' },
    update: {},
    create: {
      id: 'm-f3-04',
      familyId: fam3.id,
      name: 'Rohan Mehta',
      dateOfBirth: new Date('2010-02-19'),
      gender: 'MALE',
      isStudent: true,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });

  // Relationships
  await prisma.relationship.upsert({
    where: {
      fromMemberId_toMemberId_relationshipType: {
        fromMemberId: m3_head.id,
        toMemberId: m3_spouse.id,
        relationshipType: 'SPOUSE',
      },
    },
    update: {},
    create: {
      familyId: fam3.id,
      fromMemberId: m3_head.id,
      toMemberId: m3_spouse.id,
      relationshipType: 'SPOUSE',
      verificationStatus: 'VERIFIED',
    },
  });
  await prisma.relationship.upsert({
    where: {
      fromMemberId_toMemberId_relationshipType: {
        fromMemberId: m3_head.id,
        toMemberId: m3_daughter.id,
        relationshipType: 'DAUGHTER',
      },
    },
    update: {},
    create: {
      familyId: fam3.id,
      fromMemberId: m3_head.id,
      toMemberId: m3_daughter.id,
      relationshipType: 'DAUGHTER',
      verificationStatus: 'VERIFIED',
    },
  });

  if (healthScheme) {
    await prisma.beneficiaryApplication.upsert({
      where: { memberId_schemeId: { memberId: m3_head.id, schemeId: healthScheme.id } },
      update: {},
      create: {
        familyId: fam3.id,
        memberId: m3_head.id,
        schemeId: healthScheme.id,
        status: 'APPROVED',
        reviewedById: verifierId,
        reviewedAt: new Date(),
        decisionReason: 'Income below ₹5L threshold verified with tax certificate.',
      },
    });
  }
  console.log(`   [3/9] ${fam3.familyId} (Verified, 4 members) - Ramesh Mehta (Surat)`);

  // --- Family 4: Jignesh Shah (Vadodara, Pending Verification) ---
  const user4 = seededCitizens['jignesh.shah@example.com'];
  let fam4 = await prisma.family.upsert({
    where: { familyId: 'GJ-FAM-2D45N24A' },
    update: {},
    create: {
      familyId: 'GJ-FAM-2D45N24A',
      status: 'PENDING_VERIFICATION',
      ownerId: user4.id,
      state: 'Gujarat',
      district: 'Vadodara',
      taluka: 'Vadodara',
      village: 'Alkapuri',
      address: '12, Sunrise Avenue, Alkapuri',
      annualIncome: 150000,
      ownsHouse: false,
    },
  });

  const m4_head = await prisma.familyMember.upsert({
    where: { id: 'm-f4-01' },
    update: {},
    create: {
      id: 'm-f4-01',
      familyId: fam4.id,
      userId: user4.id,
      name: 'Jignesh Shah',
      dateOfBirth: new Date('1990-05-10'),
      gender: 'MALE',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });
  await prisma.family.update({ where: { id: fam4.id }, data: { familyHeadId: m4_head.id } });

  const m4_spouse = await prisma.familyMember.upsert({
    where: { id: 'm-f4-02' },
    update: {},
    create: {
      id: 'm-f4-02',
      familyId: fam4.id,
      name: 'Anjali Shah',
      dateOfBirth: new Date('1993-11-14'),
      gender: 'FEMALE',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });

  await prisma.relationship.upsert({
    where: {
      fromMemberId_toMemberId_relationshipType: {
        fromMemberId: m4_head.id,
        toMemberId: m4_spouse.id,
        relationshipType: 'SPOUSE',
      },
    },
    update: {},
    create: {
      familyId: fam4.id,
      fromMemberId: m4_head.id,
      toMemberId: m4_spouse.id,
      relationshipType: 'SPOUSE',
      verificationStatus: 'PENDING',
    },
  });
  console.log(`   [4/9] ${fam4.familyId} (Pending, 2 members) - Jignesh Shah (Vadodara)`);

  // --- Family 5: Bhavesh Vaghela (Rajkot, Verified with Senior Citizen Pension) ---
  const user5 = seededCitizens['bhavesh.vaghela@example.com'];
  let fam5 = await prisma.family.upsert({
    where: { familyId: 'GJ-FAM-3E56P35B' },
    update: {},
    create: {
      familyId: 'GJ-FAM-3E56P35B',
      status: 'VERIFIED',
      ownerId: user5.id,
      state: 'Gujarat',
      district: 'Rajkot',
      taluka: 'Rajkot',
      village: 'Mavdi',
      address: '7, Maruti Krupa, Mavdi Main Road',
      annualIncome: 95000,
      ownsHouse: false,
      verifiedAt: new Date(),
      verifiedById: verifierId,
    },
  });

  const m5_head = await prisma.familyMember.upsert({
    where: { id: 'm-f5-01' },
    update: {},
    create: {
      id: 'm-f5-01',
      familyId: fam5.id,
      userId: user5.id,
      name: 'Bhavesh Vaghela',
      dateOfBirth: new Date('1972-03-20'),
      gender: 'MALE',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });
  await prisma.family.update({ where: { id: fam5.id }, data: { familyHeadId: m5_head.id } });

  const m5_mother = await prisma.familyMember.upsert({
    where: { id: 'm-f5-02' },
    update: {},
    create: {
      id: 'm-f5-02',
      familyId: fam5.id,
      name: 'Shardaben Vaghela',
      dateOfBirth: new Date('1950-10-15'),
      gender: 'FEMALE',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });

  const m5_daughter = await prisma.familyMember.upsert({
    where: { id: 'm-f5-03' },
    update: {},
    create: {
      id: 'm-f5-03',
      familyId: fam5.id,
      name: 'Hetal Vaghela',
      dateOfBirth: new Date('2002-12-05'),
      gender: 'FEMALE',
      isStudent: true,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });

  await prisma.relationship.upsert({
    where: {
      fromMemberId_toMemberId_relationshipType: {
        fromMemberId: m5_mother.id,
        toMemberId: m5_head.id,
        relationshipType: 'SON',
      },
    },
    update: {},
    create: {
      familyId: fam5.id,
      fromMemberId: m5_mother.id,
      toMemberId: m5_head.id,
      relationshipType: 'SON',
      verificationStatus: 'VERIFIED',
    },
  });

  if (pensionScheme) {
    await prisma.beneficiaryApplication.upsert({
      where: { memberId_schemeId: { memberId: m5_mother.id, schemeId: pensionScheme.id } },
      update: {},
      create: {
        familyId: fam5.id,
        memberId: m5_mother.id,
        schemeId: pensionScheme.id,
        status: 'APPROVED',
        reviewedById: verifierId,
        reviewedAt: new Date(),
        decisionReason: 'Age > 60 verified via birth records; pension sanctioned.',
      },
    });
  }
  console.log(`   [5/9] ${fam5.familyId} (Verified, 3 members) - Bhavesh Vaghela (Rajkot)`);

  // --- Family 6: Harshad Trivedi (Bhavnagar, REJECTED for correction) ---
  const user6 = seededCitizens['harshad.trivedi@example.com'];
  let fam6 = await prisma.family.upsert({
    where: { familyId: 'GJ-FAM-4F67Q46C' },
    update: {},
    create: {
      familyId: 'GJ-FAM-4F67Q46C',
      status: 'REJECTED',
      rejectionReason: 'Address proof mismatch with village revenue records. Please re-upload valid Ration Card.',
      ownerId: user6.id,
      state: 'Gujarat',
      district: 'Bhavnagar',
      taluka: 'Bhavnagar',
      village: 'Ghogha',
      address: '22, Brahmin Sheri, Ghogha Port',
      annualIncome: 210000,
      ownsHouse: true,
    },
  });

  const m6_head = await prisma.familyMember.upsert({
    where: { id: 'm-f6-01' },
    update: {},
    create: {
      id: 'm-f6-01',
      familyId: fam6.id,
      userId: user6.id,
      name: 'Harshad Trivedi',
      dateOfBirth: new Date('1980-04-12'),
      gender: 'MALE',
      status: 'ACTIVE',
      verificationStatus: 'REJECTED',
      rejectionReason: 'Address discrepancy in supporting doc.',
    },
  });
  await prisma.family.update({ where: { id: fam6.id }, data: { familyHeadId: m6_head.id } });
  console.log(`   [6/9] ${fam6.familyId} (Rejected with reason, 1 member) - Harshad Trivedi (Bhavnagar)`);

  // --- Family 7: Sanjay Solanki (Gandhinagar, Verified, 4 members) ---
  const user7 = seededCitizens['sanjay.solanki@example.com'];
  let fam7 = await prisma.family.upsert({
    where: { familyId: 'GJ-FAM-5G78R57D' },
    update: {},
    create: {
      familyId: 'GJ-FAM-5G78R57D',
      status: 'VERIFIED',
      ownerId: user7.id,
      state: 'Gujarat',
      district: 'Gandhinagar',
      taluka: 'Gandhinagar',
      village: 'Sector 21',
      address: 'Plot 412/1, Sector 21',
      annualIncome: 360000,
      ownsHouse: false,
      verifiedAt: new Date(),
      verifiedById: verifierId,
    },
  });

  const m7_head = await prisma.familyMember.upsert({
    where: { id: 'm-f7-01' },
    update: {},
    create: {
      id: 'm-f7-01',
      familyId: fam7.id,
      userId: user7.id,
      name: 'Sanjay Solanki',
      dateOfBirth: new Date('1986-09-08'),
      gender: 'MALE',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });
  await prisma.family.update({ where: { id: fam7.id }, data: { familyHeadId: m7_head.id } });

  const m7_spouse = await prisma.familyMember.upsert({
    where: { id: 'm-f7-02' },
    update: {},
    create: {
      id: 'm-f7-02',
      familyId: fam7.id,
      name: 'Bhavna Solanki',
      dateOfBirth: new Date('1988-12-19'),
      gender: 'FEMALE',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });

  const m7_daughter = await prisma.familyMember.upsert({
    where: { id: 'm-f7-03' },
    update: {},
    create: {
      id: 'm-f7-03',
      familyId: fam7.id,
      name: 'Neha Solanki',
      dateOfBirth: new Date('2007-01-28'),
      gender: 'FEMALE',
      isStudent: true,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    },
  });

  await prisma.relationship.upsert({
    where: {
      fromMemberId_toMemberId_relationshipType: {
        fromMemberId: m7_head.id,
        toMemberId: m7_spouse.id,
        relationshipType: 'SPOUSE',
      },
    },
    update: {},
    create: {
      familyId: fam7.id,
      fromMemberId: m7_head.id,
      toMemberId: m7_spouse.id,
      relationshipType: 'SPOUSE',
      verificationStatus: 'VERIFIED',
    },
  });

  if (eduScheme) {
    await prisma.beneficiaryApplication.upsert({
      where: { memberId_schemeId: { memberId: m7_daughter.id, schemeId: eduScheme.id } },
      update: {},
      create: {
        familyId: fam7.id,
        memberId: m7_daughter.id,
        schemeId: eduScheme.id,
        status: 'APPROVED',
        reviewedById: verifierId,
        reviewedAt: new Date(),
        decisionReason: 'Passed Class 12, scholarship approved for Polytechnic diploma.',
      },
    });
  }
  console.log(`   [7/9] ${fam7.familyId} (Verified, 3 members) - Sanjay Solanki (Gandhinagar)`);

  // --- Family 8: Manish Prajapati (Anand, DRAFT state) ---
  const user8 = seededCitizens['manish.prajapati@example.com'];
  let fam8 = await prisma.family.upsert({
    where: { familyId: 'GJ-FAM-6H89S68E' },
    update: {},
    create: {
      familyId: 'GJ-FAM-6H89S68E',
      status: 'DRAFT',
      ownerId: user8.id,
      state: 'Gujarat',
      district: 'Anand',
      taluka: 'Anand',
      village: 'Mogar',
      address: '5, Green Park Society, Mogar',
      annualIncome: 160000,
      ownsHouse: false,
    },
  });

  const m8_head = await prisma.familyMember.upsert({
    where: { id: 'm-f8-01' },
    update: {},
    create: {
      id: 'm-f8-01',
      familyId: fam8.id,
      userId: user8.id,
      name: 'Manish Prajapati',
      dateOfBirth: new Date('1995-02-14'),
      gender: 'MALE',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });
  await prisma.family.update({ where: { id: fam8.id }, data: { familyHeadId: m8_head.id } });
  console.log(`   [8/9] ${fam8.familyId} (Draft, 1 member) - Manish Prajapati (Anand)`);

  // --- Family 9: Devendra Parmar (Mehsana, PENDING_VERIFICATION, 4 members) ---
  const user9 = seededCitizens['devendra.parmar@example.com'];
  let fam9 = await prisma.family.upsert({
    where: { familyId: 'GJ-FAM-7J90T79F' },
    update: {},
    create: {
      familyId: 'GJ-FAM-7J90T79F',
      status: 'PENDING_VERIFICATION',
      ownerId: user9.id,
      state: 'Gujarat',
      district: 'Mehsana',
      taluka: 'Kadi',
      village: 'Nandasan',
      address: '18, Sardar Patel Society, Nandasan',
      annualIncome: 280000,
      ownsHouse: false,
    },
  });

  const m9_head = await prisma.familyMember.upsert({
    where: { id: 'm-f9-01' },
    update: {},
    create: {
      id: 'm-f9-01',
      familyId: fam9.id,
      userId: user9.id,
      name: 'Devendra Parmar',
      dateOfBirth: new Date('1978-06-25'),
      gender: 'MALE',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });
  await prisma.family.update({ where: { id: fam9.id }, data: { familyHeadId: m9_head.id } });

  const m9_spouse = await prisma.familyMember.upsert({
    where: { id: 'm-f9-02' },
    update: {},
    create: {
      id: 'm-f9-02',
      familyId: fam9.id,
      name: 'Hansaben Parmar',
      dateOfBirth: new Date('1981-10-18'),
      gender: 'FEMALE',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });

  const m9_son = await prisma.familyMember.upsert({
    where: { id: 'm-f9-03' },
    update: {},
    create: {
      id: 'm-f9-03',
      familyId: fam9.id,
      name: 'Chirag Parmar',
      dateOfBirth: new Date('2003-05-11'),
      gender: 'MALE',
      isStudent: true,
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });

  const m9_father = await prisma.familyMember.upsert({
    where: { id: 'm-f9-04' },
    update: {},
    create: {
      id: 'm-f9-04',
      familyId: fam9.id,
      name: 'Jashwant Parmar',
      dateOfBirth: new Date('1953-08-09'),
      gender: 'MALE',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    },
  });

  await prisma.relationship.upsert({
    where: {
      fromMemberId_toMemberId_relationshipType: {
        fromMemberId: m9_head.id,
        toMemberId: m9_spouse.id,
        relationshipType: 'SPOUSE',
      },
    },
    update: {},
    create: {
      familyId: fam9.id,
      fromMemberId: m9_head.id,
      toMemberId: m9_spouse.id,
      relationshipType: 'SPOUSE',
      verificationStatus: 'PENDING',
    },
  });

  if (houseScheme) {
    await prisma.beneficiaryApplication.upsert({
      where: { memberId_schemeId: { memberId: m9_head.id, schemeId: houseScheme.id } },
      update: {},
      create: {
        familyId: fam9.id,
        memberId: m9_head.id,
        schemeId: houseScheme.id,
        status: 'APPLIED',
      },
    });
  }
  console.log(`   [9/9] ${fam9.familyId} (Pending, 4 members) - Devendra Parmar (Mehsana)`);

  console.log('\n======================================================');
  console.log('✅ ALL 9 CITIZEN FAMILIES SEEDED SUCCESSFULLY!');
  console.log('======================================================');
  console.log(`\nDemo Password for All Accounts: ${DEFAULT_PASSWORD}`);
  console.log('------------------------------------------------------');
  console.log('Officers:');
  console.log('  • Verification Officer : officer@example.gov');
  console.log('  • District Officer     : district@example.gov (Ahmedabad)');
  console.log('  • System Admin         : admin@example.gov');
  console.log('\nCitizens:');
  console.log('  1. rahul@example.com            -> Verified Family (Ahmedabad)');
  console.log('  2. amit@example.com             -> Pending Family & Duplicate Flag (Ahmedabad)');
  console.log('  3. ramesh.mehta@example.com     -> Verified Family (Surat)');
  console.log('  4. jignesh.shah@example.com     -> Pending Family (Vadodara)');
  console.log('  5. bhavesh.vaghela@example.com  -> Verified Family with Pension (Rajkot)');
  console.log('  6. harshad.trivedi@example.com  -> Rejected with Reason (Bhavnagar)');
  console.log('  7. sanjay.solanki@example.com   -> Verified Family (Gandhinagar)');
  console.log('  8. manish.prajapati@example.com -> Draft Family (Anand)');
  console.log('  9. devendra.parmar@example.com  -> Pending Verification (Mehsana)');
  console.log('------------------------------------------------------\n');
}

main()
  .catch((err) => {
    console.error('Seed error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
