const request = require('supertest');

const app = require('../../src/app');
const { prisma, resetDatabase, disconnectDatabase } = require('../helpers/db');
const {
  createCitizen,
  createOfficer,
  createAdmin,
  bearer,
} = require('../helpers/auth');
const { registerFamily, validMember } = require('../helpers/family');
const { MAX_MEMBERS_PER_FAMILY } = require('../../src/services/member.service');

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

const postMember = (user, familyId, body = validMember) =>
  request(app)
    .post(`/api/families/${familyId}/members`)
    .set('Authorization', bearer(user))
    .send(body);

describe('POST /api/families/:familyId/members — happy path', () => {
  it('adds a member to the family', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await postMember(citizen, family.id);

    expect(res.status).toBe(201);
    expect(res.body.data.member).toMatchObject({
      name: 'Priya Patel',
      gender: 'FEMALE',
      familyId: family.id,
    });
  });

  it('starts a new member ACTIVE and PENDING verification', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await postMember(citizen, family.id);

    expect(res.body.data.member.status).toBe('ACTIVE');
    expect(res.body.data.member.verificationStatus).toBe('PENDING');
    expect(res.body.data.member.verifiedAt).toBeNull();
  });

  it('accepts the public Family ID in the path', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await postMember(citizen, family.familyId);

    expect(res.status).toBe(201);
    expect(res.body.data.member.familyId).toBe(family.id);
  });

  it('stores the demographic details used for duplicate matching', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await postMember(citizen, family.id, {
      ...validMember,
      fatherName: 'Suresh Patel',
      motherName: 'Meena Patel',
      spouseName: 'Rahul Patel',
      isStudent: true,
    });

    expect(res.body.data.member).toMatchObject({
      fatherName: 'Suresh Patel',
      motherName: 'Meena Patel',
      spouseName: 'Rahul Patel',
      isStudent: true,
    });
  });

  it('records an audit entry', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await postMember(citizen, family.id);

    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'FamilyMember', entityId: res.body.data.member.id },
    });

    expect(log).not.toBeNull();
    expect(log.action).toBe('MEMBER_ADDED');
    expect(log.userId).toBe(citizen.id);
    expect(log.newValue).toMatchObject({ name: 'Priya Patel' });
  });

  it('does not change the family status or Family ID', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    await postMember(citizen, family.id);

    const stored = await prisma.family.findUnique({ where: { id: family.id } });
    expect(stored.status).toBe('DRAFT');
    expect(stored.familyId).toBe(family.familyId);
    expect(stored.familyHeadId).toBe(family.familyHeadId);
  });

  it('allows adding a member to an already verified family', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    await prisma.family.update({
      where: { id: family.id },
      data: { status: 'VERIFIED' },
    });

    // Births and marriages happen after verification; the platform must
    // record them rather than freeze the household.
    const res = await postMember(citizen, family.id, {
      name: 'Newborn Patel',
      dateOfBirth: '2026-01-15',
      gender: 'MALE',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.member.verificationStatus).toBe('PENDING');

    const stored = await prisma.family.findUnique({ where: { id: family.id } });
    expect(stored.status).toBe('VERIFIED');
  });
});

describe('POST /api/families/:familyId/members — authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .post(`/api/families/${family.id}/members`)
      .send(validMember);

    expect(res.status).toBe(401);
    expect(await prisma.familyMember.count()).toBe(1);
  });

  it('stops another citizen adding to a family they do not own', async () => {
    const owner = await createCitizen();
    const stranger = await createCitizen();
    const family = await registerFamily(owner);

    const res = await postMember(stranger, family.id);

    expect(res.status).toBe(404);
    expect(await prisma.familyMember.count()).toBe(1);
  });

  it('forbids an officer from adding members', async () => {
    const citizen = await createCitizen();
    const officer = await createOfficer();
    const family = await registerFamily(citizen);

    const res = await postMember(officer, family.id);

    expect(res.status).toBe(403);
  });

  it('forbids an admin from adding members', async () => {
    const citizen = await createCitizen();
    const admin = await createAdmin();
    const family = await registerFamily(citizen);

    const res = await postMember(admin, family.id);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a family that does not exist', async () => {
    const citizen = await createCitizen();
    await registerFamily(citizen);

    const res = await postMember(
      citizen,
      '00000000-0000-0000-0000-000000000000'
    );

    expect(res.status).toBe(404);
  });
});

describe('POST /api/families/:familyId/members — validation', () => {
  const invalidCases = [
    ['missing everything', {}, ['name', 'dateOfBirth', 'gender']],
    ['missing name', { ...validMember, name: undefined }, ['name']],
    ['name too short', { ...validMember, name: 'P' }, ['name']],
    ['unknown gender', { ...validMember, gender: 'ROBOT' }, ['gender']],
    [
      'future date of birth',
      { ...validMember, dateOfBirth: '2999-01-01' },
      ['dateOfBirth'],
    ],
    [
      'unparseable date of birth',
      { ...validMember, dateOfBirth: 'yesterday' },
      ['dateOfBirth'],
    ],
    ['unknown status', { ...validMember, status: 'ASLEEP' }, ['status']],
  ];

  it.each(invalidCases)('rejects %s', async (_label, body, expectedFields) => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await postMember(citizen, family.id, body);

    expect(res.status).toBe(422);
    const fields = res.body.errors.map((e) => e.field);
    for (const field of expectedFields) {
      expect(fields).toContain(field);
    }
    // Only the head created at registration.
    expect(await prisma.familyMember.count()).toBe(1);
  });

  it('ignores a client-supplied verification status', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await postMember(citizen, family.id, {
      ...validMember,
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
    });

    expect(res.status).toBe(201);
    expect(res.body.data.member.verificationStatus).toBe('PENDING');
    expect(res.body.data.member.verifiedAt).toBeNull();
  });

  it('ignores an attempt to plant the member in another family', async () => {
    const citizen = await createCitizen();
    const other = await createCitizen();
    const family = await registerFamily(citizen);
    const otherFamily = await registerFamily(other);

    const res = await postMember(citizen, family.id, {
      ...validMember,
      familyId: otherFamily.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.member.familyId).toBe(family.id);
  });

  it('ignores an attempt to link the member to another user account', async () => {
    const citizen = await createCitizen();
    const other = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await postMember(citizen, family.id, {
      ...validMember,
      userId: other.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.member.userId).toBeNull();
  });
});

describe('POST /api/families/:familyId/members — limits', () => {
  it('refuses to exceed the member cap', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    // The head already occupies one slot.
    await prisma.familyMember.createMany({
      data: Array.from({ length: MAX_MEMBERS_PER_FAMILY - 1 }, (_, i) => ({
        familyId: family.id,
        name: `Filler Member ${i}`,
        dateOfBirth: new Date('1990-01-01'),
        gender: 'OTHER',
      })),
    });

    const res = await postMember(citizen, family.id);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/more than 50 members/i);
    expect(await prisma.familyMember.count()).toBe(MAX_MEMBERS_PER_FAMILY);
  });
});
