const request = require('supertest');

const app = require('../../src/app');
const { prisma, resetDatabase, disconnectDatabase } = require('../helpers/db');
const {
  createCitizen,
  createOfficer,
  createDistrictOfficer,
  bearer,
} = require('../helpers/auth');
const { registerFamily, addMember } = require('../helpers/family');

const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake\n');

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

async function uploadFor(citizen, memberId) {
  return request(app)
    .post('/api/documents')
    .set('Authorization', bearer(citizen))
    .field('memberId', memberId)
    .field('documentType', 'BIRTH_CERTIFICATE')
    .attach('file', PDF_BYTES, {
      filename: 'proof.pdf',
      contentType: 'application/pdf',
    });
}

async function readyFamily(overrides = {}) {
  const citizen = await createCitizen();
  const family = await registerFamily(citizen, overrides);
  await uploadFor(citizen, family.familyHeadId);
  return { citizen, family };
}

const submit = (user, familyId) =>
  request(app)
    .put(`/api/families/${familyId}/submit`)
    .set('Authorization', bearer(user));

const verifyMember = (user, memberId, body) =>
  request(app)
    .put(`/api/verification/members/${memberId}`)
    .set('Authorization', bearer(user))
    .send(body);

const verifyFamily = (user, familyId, body) =>
  request(app)
    .put(`/api/verification/families/${familyId}`)
    .set('Authorization', bearer(user))
    .send(body);

describe('GET /api/dashboard/statistics with duplicate alerts and applications', () => {
  it('includes duplicate alerts and pending application counts', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);

    // Create a duplicate review record
    const member2 = await addMember(citizen, family.id, {
      name: 'Priya Patel',
      dateOfBirth: '1990-01-01',
      gender: 'FEMALE',
    });

    await prisma.duplicateReview.create({
      data: {
        sourceMemberId: family.familyHeadId,
        matchedMemberId: member2.id,
        score: 88,
        breakdown: { name: 90, dob: 85 },
        status: 'PENDING_REVIEW',
      },
    });

    // Create a sample scheme and application
    const scheme = await prisma.scheme.create({
      data: {
        name: 'Test Scheme',
        description: 'Testing applications',
        eligibilityRule: { minAge: 18 },
      },
    });

    await prisma.beneficiaryApplication.create({
      data: {
        familyId: family.id,
        memberId: family.familyHeadId,
        schemeId: scheme.id,
        status: 'APPLIED',
      },
    });

    const res = await request(app)
      .get('/api/dashboard/statistics')
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
    expect(res.body.data.duplicateAlerts).toBe(1);
    expect(res.body.data.pendingApplications).toBe(1);
  });
});

describe('GET /api/dashboard/history', () => {
  it('returns verification history with officer details and pagination', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);

    // Perform member verification
    await verifyMember(officer, family.familyHeadId, { action: 'APPROVE' });
    // Perform family verification
    await verifyFamily(officer, family.id, { action: 'APPROVE' });

    const res = await request(app)
      .get('/api/dashboard/history')
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
    expect(res.body.data.history.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.history[0].user).toHaveProperty('name', officer.name);
    expect(res.body.data.pagination).toMatchObject({
      page: 1,
      pageSize: 25,
      total: expect.any(Number),
    });

    const actions = res.body.data.history.map((h) => h.action);
    expect(actions).toContain('FAMILY_VERIFIED');
    expect(actions).toContain('MEMBER_VERIFIED');
  });

  it('pages history results correctly', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);

    await verifyMember(officer, family.familyHeadId, { action: 'APPROVE' });
    await verifyFamily(officer, family.id, { action: 'APPROVE' });

    const res = await request(app)
      .get('/api/dashboard/history?page=1&pageSize=1')
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
    expect(res.body.data.history).toHaveLength(1);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.pageSize).toBe(1);
    expect(res.body.data.pagination.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('forbids citizens from viewing verification history', async () => {
    const { citizen } = await readyFamily();

    const res = await request(app)
      .get('/api/dashboard/history')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated requests to history', async () => {
    const res = await request(app).get('/api/dashboard/history');
    expect(res.status).toBe(401);
  });
});
