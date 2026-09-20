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

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

/** A family with one PENDING father-to-daughter relationship. */
async function pendingRelationship(familyOverrides = {}) {
  const citizen = await createCitizen();
  const family = await registerFamily(citizen, familyOverrides);
  const daughter = await addMember(citizen, family.id, {
    name: 'Riya Patel',
    dateOfBirth: '2012-03-08',
    gender: 'FEMALE',
  });

  const res = await request(app)
    .post('/api/relationships')
    .set('Authorization', bearer(citizen))
    .send({
      fromMemberId: family.familyHeadId,
      toMemberId: daughter.id,
      relationshipType: 'FATHER',
    });

  return { citizen, family, daughter, relationship: res.body.data.relationship };
}

const verify = (user, id, body) =>
  request(app)
    .put(`/api/relationships/${id}/verify`)
    .set('Authorization', bearer(user))
    .send(body);

describe('PUT /api/relationships/:id/verify — officer decisions', () => {
  it('approves a relationship', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    const res = await verify(officer, relationship.id, { action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.data.relationship.verificationStatus).toBe('VERIFIED');
    expect(res.body.data.relationship.verifiedById).toBe(officer.id);
    expect(res.body.data.relationship.verifiedAt).not.toBeNull();
  });

  it('rejects a relationship with a reason', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    const res = await verify(officer, relationship.id, {
      action: 'REJECT',
      reason: 'Birth certificate does not match',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.relationship.verificationStatus).toBe('REJECTED');
    expect(res.body.data.relationship.rejectionReason).toBe(
      'Birth certificate does not match'
    );
    expect(res.body.data.relationship.verifiedAt).toBeNull();
  });

  it('returns a relationship for more documents', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    const res = await verify(officer, relationship.id, {
      action: 'REQUEST_DOCUMENT',
      reason: 'Please upload the birth certificate',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.relationship.verificationStatus).toBe('UNDER_REVIEW');
  });

  it('supports the full PENDING to UNDER_REVIEW to VERIFIED path', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    await verify(officer, relationship.id, {
      action: 'REQUEST_DOCUMENT',
      reason: 'Need the certificate',
    });
    const res = await verify(officer, relationship.id, { action: 'APPROVE' });

    expect(res.body.data.relationship.verificationStatus).toBe('VERIFIED');
  });

  it('lets an admin verify as well', async () => {
    const { relationship } = await pendingRelationship();
    const admin = await createAdmin();

    const res = await verify(admin, relationship.id, { action: 'APPROVE' });

    expect(res.status).toBe(200);
  });

  it('requires a reason when rejecting', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    const res = await verify(officer, relationship.id, { action: 'REJECT' });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('reason');

    const stored = await prisma.relationship.findUnique({
      where: { id: relationship.id },
    });
    expect(stored.verificationStatus).toBe('PENDING');
  });

  it('refuses to repeat a decision already recorded', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    await verify(officer, relationship.id, { action: 'APPROVE' });
    const res = await verify(officer, relationship.id, { action: 'APPROVE' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already verified/i);
  });

  it('refuses to send a verified relationship back for documents', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    await verify(officer, relationship.id, { action: 'APPROVE' });
    const res = await verify(officer, relationship.id, {
      action: 'REQUEST_DOCUMENT',
      reason: 'Changed my mind',
    });

    expect(res.status).toBe(409);
  });

  it('allows a verified relationship to be later rejected', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    await verify(officer, relationship.id, { action: 'APPROVE' });
    const res = await verify(officer, relationship.id, {
      action: 'REJECT',
      reason: 'Document later found to be forged',
    });

    // Verification must be reversible when evidence turns out to be false.
    expect(res.status).toBe(200);
    expect(res.body.data.relationship.verificationStatus).toBe('REJECTED');
    expect(res.body.data.relationship.verifiedAt).toBeNull();
  });

  it('rejects an unknown action', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    const res = await verify(officer, relationship.id, { action: 'SHRUG' });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('action');
  });
});

describe('PUT /api/relationships/:id/verify — audit trail', () => {
  it('records the approving officer and the status change', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    await verify(officer, relationship.id, { action: 'APPROVE' });

    const log = await prisma.auditLog.findFirst({
      where: { entityId: relationship.id, action: 'RELATIONSHIP_VERIFIED' },
    });

    expect(log.userId).toBe(officer.id);
    expect(log.oldValue).toEqual({ verificationStatus: 'PENDING' });
    expect(log.newValue).toEqual({ verificationStatus: 'VERIFIED' });
  });

  it('records the rejection reason', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    await verify(officer, relationship.id, {
      action: 'REJECT',
      reason: 'Certificate illegible',
    });

    const log = await prisma.auditLog.findFirst({
      where: { entityId: relationship.id, action: 'RELATIONSHIP_REJECTED' },
    });

    expect(log.reason).toBe('Certificate illegible');
    expect(log.newValue).toEqual({ verificationStatus: 'REJECTED' });
  });
});

describe('PUT /api/relationships/:id/verify — authorization', () => {
  it('stops a citizen approving their own relationship', async () => {
    const { citizen, relationship } = await pendingRelationship();

    const res = await verify(citizen, relationship.id, { action: 'APPROVE' });

    // A family verifying itself would defeat the entire workflow.
    expect(res.status).toBe(403);

    const stored = await prisma.relationship.findUnique({
      where: { id: relationship.id },
    });
    expect(stored.verificationStatus).toBe('PENDING');
  });

  it('stops an unrelated citizen approving it', async () => {
    const { relationship } = await pendingRelationship();
    const stranger = await createCitizen();

    const res = await verify(stranger, relationship.id, { action: 'APPROVE' });

    expect(res.status).toBe(403);
  });

  it('stops a district officer approving it', async () => {
    const { relationship } = await pendingRelationship();
    const districtOfficer = await createDistrictOfficer({ district: 'Ahmedabad' });

    // District officers review and report; verification is a separate role.
    const res = await verify(districtOfficer, relationship.id, { action: 'APPROVE' });

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated verification', async () => {
    const { relationship } = await pendingRelationship();

    const res = await request(app)
      .put(`/api/relationships/${relationship.id}/verify`)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(401);
  });

  it('returns 404 for a relationship that does not exist', async () => {
    const officer = await createOfficer();

    const res = await verify(
      officer,
      '00000000-0000-0000-0000-000000000000',
      { action: 'APPROVE' }
    );

    expect(res.status).toBe(404);
  });
});

describe('GET /api/relationships/pending — officer queue', () => {
  it('lists relationships awaiting a decision', async () => {
    await pendingRelationship();
    const officer = await createOfficer();

    const res = await request(app)
      .get('/api/relationships/pending')
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
    expect(res.body.data.relationships).toHaveLength(1);
    expect(res.body.data.relationships[0].family.familyId).toEqual(
      expect.any(String)
    );
  });

  it('drops a relationship from the queue once decided', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    await verify(officer, relationship.id, { action: 'APPROVE' });

    const res = await request(app)
      .get('/api/relationships/pending')
      .set('Authorization', bearer(officer));

    expect(res.body.data.relationships).toHaveLength(0);
  });

  it('keeps an UNDER_REVIEW relationship in the queue', async () => {
    const { relationship } = await pendingRelationship();
    const officer = await createOfficer();

    await verify(officer, relationship.id, {
      action: 'REQUEST_DOCUMENT',
      reason: 'Need the certificate',
    });

    const res = await request(app)
      .get('/api/relationships/pending')
      .set('Authorization', bearer(officer));

    expect(res.body.data.relationships).toHaveLength(1);
  });

  it('scopes a district officer to their own district', async () => {
    await pendingRelationship({ district: 'Ahmedabad' });
    await pendingRelationship({ district: 'Surat' });
    const officer = await createDistrictOfficer({ district: 'Surat' });

    const res = await request(app)
      .get('/api/relationships/pending')
      .set('Authorization', bearer(officer));

    expect(res.body.data.relationships).toHaveLength(1);
    expect(res.body.data.relationships[0].family.district).toBe('Surat');
  });

  it('forbids a citizen from reading the queue', async () => {
    const { citizen } = await pendingRelationship();

    const res = await request(app)
      .get('/api/relationships/pending')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/families/:familyId/relationships', () => {
  it('lists relationships for the owning citizen', async () => {
    const { citizen, family } = await pendingRelationship();

    const res = await request(app)
      .get(`/api/families/${family.id}/relationships`)
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.body.data.relationships).toHaveLength(1);
    expect(res.body.data.relationships[0].fromMember.name).toBe('Rahul Patel');
  });

  it('filters by verification status', async () => {
    const { citizen, family, relationship } = await pendingRelationship();
    const officer = await createOfficer();
    await verify(officer, relationship.id, { action: 'APPROVE' });

    const verified = await request(app)
      .get(`/api/families/${family.id}/relationships?verificationStatus=VERIFIED`)
      .set('Authorization', bearer(citizen));
    const pending = await request(app)
      .get(`/api/families/${family.id}/relationships?verificationStatus=PENDING`)
      .set('Authorization', bearer(citizen));

    expect(verified.body.data.relationships).toHaveLength(1);
    expect(pending.body.data.relationships).toHaveLength(0);
  });

  it('hides relationships from an unrelated citizen', async () => {
    const { family } = await pendingRelationship();
    const stranger = await createCitizen();

    const res = await request(app)
      .get(`/api/families/${family.id}/relationships`)
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });
});
