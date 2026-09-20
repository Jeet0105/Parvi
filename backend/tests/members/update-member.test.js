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

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

const putMember = (user, memberId, body) =>
  request(app)
    .put(`/api/members/${memberId}`)
    .set('Authorization', bearer(user))
    .send(body);

describe('GET /api/families/:familyId/members', () => {
  it('lists every member of the family', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    await addMember(citizen, family.id);

    const res = await request(app)
      .get(`/api/families/${family.id}/members`)
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(2);
    expect(res.body.data.familyId).toBe(family.familyId);
    expect(res.body.data.familyHeadId).toBe(family.familyHeadId);
  });

  it('returns members oldest first so the head leads the list', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    await addMember(citizen, family.id, { name: 'Second Member' });

    const res = await request(app)
      .get(`/api/families/${family.id}/members`)
      .set('Authorization', bearer(citizen));

    expect(res.body.data.members[0].id).toBe(family.familyHeadId);
  });

  it('can exclude members who have left the household', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);
    await putMember(citizen, member.id, { status: 'MIGRATED' });

    const all = await request(app)
      .get(`/api/families/${family.id}/members`)
      .set('Authorization', bearer(citizen));
    const activeOnly = await request(app)
      .get(`/api/families/${family.id}/members?includeInactive=false`)
      .set('Authorization', bearer(citizen));

    expect(all.body.data.members).toHaveLength(2);
    expect(activeOnly.body.data.members).toHaveLength(1);
  });

  it('lets an officer read the member list', async () => {
    const citizen = await createCitizen();
    const officer = await createOfficer();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .get(`/api/families/${family.id}/members`)
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
  });

  it('hides the list from an unrelated citizen', async () => {
    const owner = await createCitizen();
    const stranger = await createCitizen();
    const family = await registerFamily(owner);

    const res = await request(app)
      .get(`/api/families/${family.id}/members`)
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });

  it('hides the list from a district officer elsewhere', async () => {
    const citizen = await createCitizen();
    const officer = await createDistrictOfficer({ district: 'Surat' });
    const family = await registerFamily(citizen, { district: 'Ahmedabad' });

    const res = await request(app)
      .get(`/api/families/${family.id}/members`)
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/members/:id — happy path', () => {
  it('updates demographic details', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    const res = await putMember(citizen, member.id, {
      name: 'Priya R Patel',
      fatherName: 'Suresh Patel',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.member.name).toBe('Priya R Patel');
    expect(res.body.data.member.fatherName).toBe('Suresh Patel');
  });

  it('records what changed in the audit trail', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    await putMember(citizen, member.id, { name: 'Priya R Patel' });

    const log = await prisma.auditLog.findFirst({
      where: { entityId: member.id, action: 'MEMBER_UPDATED' },
    });

    expect(log.oldValue).toEqual({ name: 'Priya Patel' });
    expect(log.newValue).toEqual({ name: 'Priya R Patel' });
    expect(log.userId).toBe(citizen.id);
  });

  it('writes no audit entry when nothing actually changed', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    const res = await putMember(citizen, member.id, { name: 'Priya Patel' });

    expect(res.status).toBe(200);
    expect(
      await prisma.auditLog.count({ where: { action: 'MEMBER_UPDATED' } })
    ).toBe(0);
  });

  it('detects a real change to the date of birth', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    const unchanged = await putMember(citizen, member.id, {
      dateOfBirth: '1988-05-12',
    });
    const changed = await putMember(citizen, member.id, {
      dateOfBirth: '1989-06-13',
    });

    expect(unchanged.status).toBe(200);
    expect(changed.status).toBe(200);
    // Only the genuine change is recorded.
    expect(
      await prisma.auditLog.count({ where: { action: 'MEMBER_UPDATED' } })
    ).toBe(1);
  });
});

describe('PUT /api/members/:id — lifecycle', () => {
  const lifecycleStatuses = ['DECEASED', 'MIGRATED', 'SEPARATED', 'INACTIVE'];

  it.each(lifecycleStatuses)('records a member as %s', async (status) => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    const res = await putMember(citizen, member.id, { status });

    expect(res.status).toBe(200);
    expect(res.body.data.member.status).toBe(status);
  });

  it('keeps the record rather than deleting it', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    await putMember(citizen, member.id, { status: 'DECEASED' });

    // Historical integrity: the person stays in the record.
    const stored = await prisma.familyMember.findUnique({
      where: { id: member.id },
    });
    expect(stored).not.toBeNull();
    expect(stored.status).toBe('DECEASED');
  });

  it('allows a lifecycle change even after verification', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);
    await prisma.familyMember.update({
      where: { id: member.id },
      data: { verificationStatus: 'VERIFIED' },
    });

    const res = await putMember(citizen, member.id, { status: 'MIGRATED' });

    expect(res.status).toBe(200);
    expect(res.body.data.member.status).toBe('MIGRATED');
  });

  it('refuses to remove the Family Head from the household', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await putMember(citizen, family.familyHeadId, {
      status: 'DECEASED',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/assign a new family head/i);
  });

  it('allows the head status change once the head is reassigned', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);
    const originalHeadId = family.familyHeadId;

    await request(app)
      .put(`/api/families/${family.id}/head`)
      .set('Authorization', bearer(citizen))
      .send({ memberId: member.id });

    const res = await putMember(citizen, originalHeadId, { status: 'DECEASED' });

    expect(res.status).toBe(200);
    expect(res.body.data.member.status).toBe('DECEASED');
  });
});

describe('PUT /api/members/:id — verified members', () => {
  it('freezes identity details once verified', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);
    await prisma.familyMember.update({
      where: { id: member.id },
      data: { verificationStatus: 'VERIFIED' },
    });

    const res = await putMember(citizen, member.id, { name: 'Different Person' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/correction request/i);

    const stored = await prisma.familyMember.findUnique({
      where: { id: member.id },
    });
    expect(stored.name).toBe('Priya Patel');
  });

  it('freezes the date of birth once verified', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);
    await prisma.familyMember.update({
      where: { id: member.id },
      data: { verificationStatus: 'VERIFIED' },
    });

    const res = await putMember(citizen, member.id, { dateOfBirth: '1970-01-01' });

    expect(res.status).toBe(409);
  });
});

describe('PUT /api/members/:id — authorization', () => {
  it('stops an unrelated citizen updating a member', async () => {
    const owner = await createCitizen();
    const stranger = await createCitizen();
    const family = await registerFamily(owner);
    const member = await addMember(owner, family.id);

    const res = await putMember(stranger, member.id, { name: 'Hijacked' });

    expect(res.status).toBe(404);

    const stored = await prisma.familyMember.findUnique({
      where: { id: member.id },
    });
    expect(stored.name).toBe('Priya Patel');
  });

  it('stops an officer editing member details', async () => {
    const citizen = await createCitizen();
    const officer = await createOfficer();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    // Officers verify members; they do not rewrite citizen-entered details.
    const res = await putMember(officer, member.id, { name: 'Officer Edit' });

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated update', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    const res = await request(app)
      .put(`/api/members/${member.id}`)
      .send({ name: 'Anonymous Edit' });

    expect(res.status).toBe(401);
  });

  it('returns 404 for a member that does not exist', async () => {
    const citizen = await createCitizen();

    const res = await putMember(
      citizen,
      '00000000-0000-0000-0000-000000000000',
      { name: 'Ghost' }
    );

    expect(res.status).toBe(404);
  });

  it('rejects a malformed member id', async () => {
    const citizen = await createCitizen();

    const res = await putMember(citizen, 'not-a-uuid', { name: 'Bad Id' });

    expect(res.status).toBe(422);
  });

  it('rejects an empty update', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    const res = await putMember(citizen, member.id, {});

    expect(res.status).toBe(422);
  });

  it('ignores an attempt to self-verify', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    const res = await putMember(citizen, member.id, {
      name: 'Priya R Patel',
      verificationStatus: 'VERIFIED',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.member.verificationStatus).toBe('PENDING');
  });

  it('ignores an attempt to move a member to another family', async () => {
    const citizen = await createCitizen();
    const other = await createCitizen();
    const family = await registerFamily(citizen);
    const otherFamily = await registerFamily(other);
    const member = await addMember(citizen, family.id);

    const res = await putMember(citizen, member.id, {
      name: 'Priya R Patel',
      familyId: otherFamily.id,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.member.familyId).toBe(family.id);
  });
});

describe('PUT /api/families/:familyId/head', () => {
  it('moves the head designation to another member', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    const res = await request(app)
      .put(`/api/families/${family.id}/head`)
      .set('Authorization', bearer(citizen))
      .send({ memberId: member.id });

    expect(res.status).toBe(200);
    expect(res.body.data.family.familyHeadId).toBe(member.id);
    expect(res.body.data.family.familyHead.name).toBe('Priya Patel');
  });

  it('records the change in the audit trail', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    await request(app)
      .put(`/api/families/${family.id}/head`)
      .set('Authorization', bearer(citizen))
      .send({ memberId: member.id });

    const log = await prisma.auditLog.findFirst({
      where: { entityId: family.id, action: 'FAMILY_HEAD_CHANGED' },
    });

    expect(log.oldValue).toMatchObject({ name: 'Rahul Patel' });
    expect(log.newValue).toMatchObject({ name: 'Priya Patel' });
  });

  it('refuses a member who is not active', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);
    await putMember(citizen, member.id, { status: 'MIGRATED' });

    const res = await request(app)
      .put(`/api/families/${family.id}/head`)
      .set('Authorization', bearer(citizen))
      .send({ memberId: member.id });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/only an active member/i);
  });

  it('refuses a member from a different family', async () => {
    const citizen = await createCitizen();
    const other = await createCitizen();
    const family = await registerFamily(citizen);
    const otherFamily = await registerFamily(other);
    const outsider = await addMember(other, otherFamily.id);

    const res = await request(app)
      .put(`/api/families/${family.id}/head`)
      .set('Authorization', bearer(citizen))
      .send({ memberId: outsider.id });

    expect(res.status).toBe(404);

    const stored = await prisma.family.findUnique({ where: { id: family.id } });
    expect(stored.familyHeadId).toBe(family.familyHeadId);
  });

  it('stops an officer reassigning the head', async () => {
    const citizen = await createCitizen();
    const officer = await createOfficer();
    const family = await registerFamily(citizen);
    const member = await addMember(citizen, family.id);

    const res = await request(app)
      .put(`/api/families/${family.id}/head`)
      .set('Authorization', bearer(officer))
      .send({ memberId: member.id });

    expect(res.status).toBe(403);
  });
});
