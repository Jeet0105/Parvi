const request = require('supertest');

const app = require('../../src/app');
const { prisma, resetDatabase, disconnectDatabase } = require('../helpers/db');
const {
  createCitizen,
  createOfficer,
  createAdmin,
  bearer,
} = require('../helpers/auth');
const { FAMILY_ID_PATTERN } = require('../../src/utils/familyId');

const validFamily = {
  state: 'Gujarat',
  district: 'Ahmedabad',
  taluka: 'Daskroi',
  village: 'Example Village',
  address: '12 Example Road, Example Village',
  head: {
    name: 'Rahul Patel',
    dateOfBirth: '1985-04-12',
    gender: 'MALE',
  },
};

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

const postFamily = (citizen, body = validFamily) =>
  request(app)
    .post('/api/families')
    .set('Authorization', bearer(citizen))
    .send(body);

describe('POST /api/families — happy path', () => {
  it('registers a family and returns it', async () => {
    const citizen = await createCitizen();
    const res = await postFamily(citizen);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.family).toMatchObject({
      district: 'Ahmedabad',
      taluka: 'Daskroi',
      village: 'Example Village',
      status: 'DRAFT',
    });
  });

  it('generates a valid, unique Family ID', async () => {
    const first = await createCitizen();
    const second = await createCitizen();

    const a = await postFamily(first);
    const b = await postFamily(second);

    expect(a.body.data.family.familyId).toMatch(FAMILY_ID_PATTERN);
    expect(b.body.data.family.familyId).toMatch(FAMILY_ID_PATTERN);
    expect(a.body.data.family.familyId).not.toBe(b.body.data.family.familyId);
  });

  it('derives the Family ID prefix from the state', async () => {
    const citizen = await createCitizen();
    const res = await postFamily(citizen, {
      ...validFamily,
      state: 'Maharashtra',
    });

    expect(res.body.data.family.familyId.startsWith('MH-FAM-')).toBe(true);
  });

  it('assigns the registering citizen as Family Head', async () => {
    const citizen = await createCitizen();
    const res = await postFamily(citizen);
    const { family } = res.body.data;

    expect(family.familyHeadId).not.toBeNull();
    expect(family.familyHead.name).toBe('Rahul Patel');
    expect(family.familyHead.userId).toBe(citizen.id);
    expect(family.members).toHaveLength(1);
    expect(family.members[0].id).toBe(family.familyHeadId);
  });

  it('defaults the head name to the account holder', async () => {
    const citizen = await createCitizen({ name: 'Priya Shah' });
    const res = await postFamily(citizen, {
      ...validFamily,
      head: { dateOfBirth: '1990-01-01', gender: 'FEMALE' },
    });

    expect(res.body.data.family.familyHead.name).toBe('Priya Shah');
  });

  it('starts the head member pending verification', async () => {
    const citizen = await createCitizen();
    const res = await postFamily(citizen);

    expect(res.body.data.family.members[0]).toMatchObject({
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    });
  });

  it('persists the family and its head', async () => {
    const citizen = await createCitizen();
    const res = await postFamily(citizen);

    const stored = await prisma.family.findUnique({
      where: { id: res.body.data.family.id },
      include: { members: true },
    });

    expect(stored.ownerId).toBe(citizen.id);
    expect(stored.members).toHaveLength(1);
    expect(stored.familyHeadId).toBe(stored.members[0].id);
  });

  it('records an audit entry for the creation', async () => {
    const citizen = await createCitizen();
    const res = await postFamily(citizen);

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Family', entityId: res.body.data.family.id },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'FAMILY_CREATED',
      userId: citizen.id,
    });
    expect(logs[0].newValue).toMatchObject({
      familyId: res.body.data.family.familyId,
      district: 'Ahmedabad',
    });
  });

  it('accepts optional eligibility attributes', async () => {
    const citizen = await createCitizen();
    const res = await postFamily(citizen, {
      ...validFamily,
      annualIncome: 120000,
      ownsHouse: false,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.family.annualIncome).toBe('120000');
    expect(res.body.data.family.ownsHouse).toBe(false);
  });
});

describe('POST /api/families — authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/families').send(validFamily);

    expect(res.status).toBe(401);
    expect(await prisma.family.count()).toBe(0);
  });

  it('forbids a verification officer from registering a family', async () => {
    const officer = await createOfficer();
    const res = await postFamily(officer);

    expect(res.status).toBe(403);
    expect(await prisma.family.count()).toBe(0);
  });

  it('forbids an administrator from registering a family', async () => {
    const admin = await createAdmin();
    const res = await postFamily(admin);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/families — conflicts', () => {
  it('stops a citizen registering a second family', async () => {
    const citizen = await createCitizen();
    await postFamily(citizen);

    const res = await postFamily(citizen);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered a family/i);
    expect(await prisma.family.count()).toBe(1);
  });
});

describe('POST /api/families — validation', () => {
  const invalidCases = [
    ['missing everything', {}, ['district', 'taluka', 'village', 'address', 'head']],
    ['missing district', { ...validFamily, district: undefined }, ['district']],
    ['short address', { ...validFamily, address: 'abc' }, ['address']],
    ['short village', { ...validFamily, village: 'A' }, ['village']],
    [
      'missing head date of birth',
      { ...validFamily, head: { gender: 'MALE' } },
      ['head.dateOfBirth'],
    ],
    [
      'unknown gender',
      { ...validFamily, head: { ...validFamily.head, gender: 'ROBOT' } },
      ['head.gender'],
    ],
    [
      'future date of birth',
      { ...validFamily, head: { ...validFamily.head, dateOfBirth: '2999-01-01' } },
      ['head.dateOfBirth'],
    ],
    [
      'unparseable date of birth',
      { ...validFamily, head: { ...validFamily.head, dateOfBirth: 'not-a-date' } },
      ['head.dateOfBirth'],
    ],
    [
      'date of birth before 1900',
      { ...validFamily, head: { ...validFamily.head, dateOfBirth: '1850-01-01' } },
      ['head.dateOfBirth'],
    ],
    ['negative income', { ...validFamily, annualIncome: -5 }, ['annualIncome']],
  ];

  it.each(invalidCases)('rejects %s', async (_label, body, expectedFields) => {
    const citizen = await createCitizen();
    const res = await postFamily(citizen, body);

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Validation failed');

    const fields = res.body.errors.map((e) => e.field);
    for (const field of expectedFields) {
      expect(fields).toContain(field);
    }
    expect(await prisma.family.count()).toBe(0);
  });

  it('ignores a client-supplied familyId', async () => {
    const citizen = await createCitizen();
    const res = await postFamily(citizen, {
      ...validFamily,
      familyId: 'GJ-AADHAAR-123456789012',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.family.familyId).not.toBe('GJ-AADHAAR-123456789012');
    expect(res.body.data.family.familyId).toMatch(FAMILY_ID_PATTERN);
  });

  it('ignores a client-supplied status and ownerId', async () => {
    const citizen = await createCitizen();
    const other = await createCitizen();

    const res = await postFamily(citizen, {
      ...validFamily,
      status: 'VERIFIED',
      ownerId: other.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.family.status).toBe('DRAFT');
    expect(res.body.data.family.ownerId).toBe(citizen.id);
  });

  it('leaves no partial family behind when creation fails', async () => {
    const citizen = await createCitizen();
    await postFamily(citizen, { ...validFamily, address: 'no' });

    expect(await prisma.family.count()).toBe(0);
    expect(await prisma.familyMember.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
