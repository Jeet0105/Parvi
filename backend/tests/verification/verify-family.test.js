const request = require('supertest');

const app = require('../../src/app');
const { prisma, resetDatabase, disconnectDatabase } = require('../helpers/db');
const {
  createCitizen,
  createOfficer,
  createDistrictOfficer,
  createAdmin,
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

/** Family with one document, ready to submit. */
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

const verifyFamily = (user, familyId, body) =>
  request(app)
    .put(`/api/verification/families/${familyId}`)
    .set('Authorization', bearer(user))
    .send(body);

const verifyMember = (user, memberId, body) =>
  request(app)
    .put(`/api/verification/members/${memberId}`)
    .set('Authorization', bearer(user))
    .send(body);

describe('PUT /api/families/:familyId/submit', () => {
  it('moves a family into the verification queue', async () => {
    const { citizen, family } = await readyFamily();

    const res = await submit(citizen, family.id);

    expect(res.status).toBe(200);
    expect(res.body.data.family.status).toBe('PENDING_VERIFICATION');
  });

  it('refuses submission with no documents', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await submit(citizen, family.id);

    // An empty submission would waste an officer's time.
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('documents');
  });

  it('refuses a second submission', async () => {
    const { citizen, family } = await readyFamily();
    await submit(citizen, family.id);

    const res = await submit(citizen, family.id);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already awaiting/i);
  });

  it('records the submission in the audit trail', async () => {
    const { citizen, family } = await readyFamily();

    await submit(citizen, family.id);

    const log = await prisma.auditLog.findFirst({
      where: { entityId: family.id, action: 'FAMILY_SUBMITTED' },
    });
    expect(log.newValue).toEqual({ status: 'PENDING_VERIFICATION' });
  });

  it('stops another citizen submitting the family', async () => {
    const { family } = await readyFamily();
    const stranger = await createCitizen();

    const res = await submit(stranger, family.id);

    expect(res.status).toBe(404);
  });

  it('stops an officer submitting on the family behalf', async () => {
    const { family } = await readyFamily();
    const officer = await createOfficer();

    const res = await submit(officer, family.id);

    expect(res.status).toBe(403);
  });

  it('clears a previous rejection reason on resubmission', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();

    await submit(citizen, family.id);
    await verifyFamily(officer, family.id, {
      action: 'REJECT',
      reason: 'Address proof missing',
    });

    const res = await submit(citizen, family.id);

    expect(res.status).toBe(200);
    expect(res.body.data.family.rejectionReason).toBeNull();
  });
});

describe('PUT /api/verification/members/:id', () => {
  it('verifies a member', async () => {
    const { family } = await readyFamily();
    const officer = await createOfficer();

    const res = await verifyMember(officer, family.familyHeadId, {
      action: 'APPROVE',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.member.verificationStatus).toBe('VERIFIED');
    expect(res.body.data.member.verifiedById).toBe(officer.id);
  });

  it('rejects a member with a reason', async () => {
    const { family } = await readyFamily();
    const officer = await createOfficer();

    const res = await verifyMember(officer, family.familyHeadId, {
      action: 'REJECT',
      reason: 'Name does not match the certificate',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.member.verificationStatus).toBe('REJECTED');
    expect(res.body.data.member.rejectionReason).toMatch(/does not match/i);
  });

  it('requires a reason when rejecting', async () => {
    const { family } = await readyFamily();
    const officer = await createOfficer();

    const res = await verifyMember(officer, family.familyHeadId, {
      action: 'REJECT',
    });

    expect(res.status).toBe(422);
  });

  it('stops a citizen verifying their own member', async () => {
    const { citizen, family } = await readyFamily();

    const res = await verifyMember(citizen, family.familyHeadId, {
      action: 'APPROVE',
    });

    expect(res.status).toBe(403);
  });

  it('stops a district officer deciding', async () => {
    const { family } = await readyFamily({ district: 'Ahmedabad' });
    const officer = await createDistrictOfficer({ district: 'Ahmedabad' });

    const res = await verifyMember(officer, family.familyHeadId, {
      action: 'APPROVE',
    });

    expect(res.status).toBe(403);
  });

  it('records the decision in the audit trail', async () => {
    const { family } = await readyFamily();
    const officer = await createOfficer();

    await verifyMember(officer, family.familyHeadId, { action: 'APPROVE' });

    const log = await prisma.auditLog.findFirst({
      where: { entityId: family.familyHeadId, action: 'MEMBER_VERIFIED' },
    });
    expect(log.userId).toBe(officer.id);
    expect(log.newValue).toEqual({ verificationStatus: 'VERIFIED' });
  });

  it('returns 404 for a member that does not exist', async () => {
    const officer = await createOfficer();

    const res = await verifyMember(
      officer,
      '00000000-0000-0000-0000-000000000000',
      { action: 'APPROVE' }
    );

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/verification/families/:familyId', () => {
  it('refuses to decide on a family that was never submitted', async () => {
    const { family } = await readyFamily();
    const officer = await createOfficer();

    const res = await verifyFamily(officer, family.id, { action: 'APPROVE' });

    // A DRAFT family is still being filled in by the citizen.
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/not been submitted/i);

    const stored = await prisma.family.findUnique({ where: { id: family.id } });
    expect(stored.status).toBe('DRAFT');
  });

  it('refuses to decide again on a rejected family until resubmitted', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);
    await verifyFamily(officer, family.id, {
      action: 'REJECT',
      reason: 'Address proof missing',
    });

    const res = await verifyFamily(officer, family.id, { action: 'APPROVE' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/not been submitted/i);
  });

  it('refuses to verify a family with unverified members', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);

    const res = await verifyFamily(officer, family.id, { action: 'APPROVE' });

    // Family verification must mean its members were actually checked.
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/remaining member/i);

    const stored = await prisma.family.findUnique({ where: { id: family.id } });
    expect(stored.status).toBe('PENDING_VERIFICATION');
  });

  it('verifies a family once every member is verified', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);
    await verifyMember(officer, family.familyHeadId, { action: 'APPROVE' });

    const res = await verifyFamily(officer, family.id, { action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.data.family.status).toBe('VERIFIED');
    expect(res.body.data.family.verifiedAt).not.toBeNull();
    expect(res.body.data.family.verifiedById).toBe(officer.id);
  });

  it('ignores members who have left the household', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();

    const migrated = await addMember(citizen, family.id, {
      name: 'Gone Away',
      dateOfBirth: '1990-01-01',
      gender: 'OTHER',
    });
    await request(app)
      .put(`/api/members/${migrated.id}`)
      .set('Authorization', bearer(citizen))
      .send({ status: 'MIGRATED' });

    await submit(citizen, family.id);
    await verifyMember(officer, family.familyHeadId, { action: 'APPROVE' });

    const res = await verifyFamily(officer, family.id, { action: 'APPROVE' });

    // A migrated member is not blocking the household's verification.
    expect(res.status).toBe(200);
  });

  it('rejects a family with a reason', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);

    const res = await verifyFamily(officer, family.id, {
      action: 'REJECT',
      reason: 'Address proof is missing',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.family.status).toBe('REJECTED');
    expect(res.body.data.family.rejectionReason).toBe('Address proof is missing');
  });

  it('requires a reason when rejecting a family', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);

    const res = await verifyFamily(officer, family.id, { action: 'REJECT' });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('reason');
  });

  it('refuses to verify an already verified family', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);
    await verifyMember(officer, family.familyHeadId, { action: 'APPROVE' });
    await verifyFamily(officer, family.id, { action: 'APPROVE' });

    const res = await verifyFamily(officer, family.id, { action: 'APPROVE' });

    expect(res.status).toBe(409);
  });

  it('lets an admin verify', async () => {
    const { citizen, family } = await readyFamily();
    const admin = await createAdmin();
    await submit(citizen, family.id);
    await verifyMember(admin, family.familyHeadId, { action: 'APPROVE' });

    const res = await verifyFamily(admin, family.id, { action: 'APPROVE' });

    expect(res.status).toBe(200);
  });

  it('stops a citizen verifying their own family', async () => {
    const { citizen, family } = await readyFamily();
    await submit(citizen, family.id);

    const res = await verifyFamily(citizen, family.id, { action: 'APPROVE' });

    expect(res.status).toBe(403);
  });

  it('records the decision in the audit trail', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);
    await verifyMember(officer, family.familyHeadId, { action: 'APPROVE' });
    await verifyFamily(officer, family.id, { action: 'APPROVE' });

    const log = await prisma.auditLog.findFirst({
      where: { entityId: family.id, action: 'FAMILY_VERIFIED' },
    });
    expect(log.oldValue).toEqual({ status: 'PENDING_VERIFICATION' });
    expect(log.newValue).toEqual({ status: 'VERIFIED' });
  });
});

describe('GET /api/verification/families/pending', () => {
  it('lists submitted families', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);

    const res = await request(app)
      .get('/api/verification/families/pending')
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
    expect(res.body.data.families).toHaveLength(1);
    expect(res.body.data.families[0].familyId).toBe(family.familyId);
  });

  it('excludes families that were never submitted', async () => {
    await readyFamily();
    const officer = await createOfficer();

    const res = await request(app)
      .get('/api/verification/families/pending')
      .set('Authorization', bearer(officer));

    expect(res.body.data.families).toHaveLength(0);
  });

  it('scopes a district officer to their district', async () => {
    const a = await readyFamily({ district: 'Ahmedabad' });
    const b = await readyFamily({ district: 'Surat' });
    await submit(a.citizen, a.family.id);
    await submit(b.citizen, b.family.id);
    const officer = await createDistrictOfficer({ district: 'Surat' });

    const res = await request(app)
      .get('/api/verification/families/pending')
      .set('Authorization', bearer(officer));

    expect(res.body.data.families).toHaveLength(1);
    expect(res.body.data.families[0].district).toBe('Surat');
  });

  it('forbids a citizen', async () => {
    const { citizen } = await readyFamily();

    const res = await request(app)
      .get('/api/verification/families/pending')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/dashboard/statistics', () => {
  it('counts everything awaiting a decision', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await addMember(citizen, family.id, {
      name: 'Riya Patel',
      dateOfBirth: '2012-03-08',
      gender: 'FEMALE',
    });
    await submit(citizen, family.id);

    const res = await request(app)
      .get('/api/dashboard/statistics')
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      pendingFamilies: 1,
      pendingMembers: 2,
      pendingDocuments: 1,
      totalFamilies: 1,
      verifiedFamilies: 0,
      scope: 'All districts',
    });
  });

  it('scopes counts to a district officer district', async () => {
    const a = await readyFamily({ district: 'Ahmedabad' });
    const b = await readyFamily({ district: 'Surat' });
    await submit(a.citizen, a.family.id);
    await submit(b.citizen, b.family.id);
    const officer = await createDistrictOfficer({ district: 'Surat' });

    const res = await request(app)
      .get('/api/dashboard/statistics')
      .set('Authorization', bearer(officer));

    // The numbers must match the queues this officer can actually open.
    expect(res.body.data.pendingFamilies).toBe(1);
    expect(res.body.data.totalFamilies).toBe(1);
    expect(res.body.data.pendingDocuments).toBe(1);
    expect(res.body.data.scope).toBe('Surat');
  });

  it('counts verified families once approved', async () => {
    const { citizen, family } = await readyFamily();
    const officer = await createOfficer();
    await submit(citizen, family.id);
    await verifyMember(officer, family.familyHeadId, { action: 'APPROVE' });
    await verifyFamily(officer, family.id, { action: 'APPROVE' });

    const res = await request(app)
      .get('/api/dashboard/statistics')
      .set('Authorization', bearer(officer));

    expect(res.body.data.verifiedFamilies).toBe(1);
    expect(res.body.data.pendingFamilies).toBe(0);
  });

  it('forbids a citizen', async () => {
    const { citizen } = await readyFamily();

    const res = await request(app)
      .get('/api/dashboard/statistics')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/dashboard/statistics');
    expect(res.status).toBe(401);
  });
});
