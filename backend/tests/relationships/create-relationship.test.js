const request = require('supertest');

const app = require('../../src/app');
const { prisma, resetDatabase, disconnectDatabase } = require('../helpers/db');
const {
  createCitizen,
  createOfficer,
  createAdmin,
  bearer,
} = require('../helpers/auth');
const { registerFamily, addMember } = require('../helpers/family');

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

const postRelationship = (user, body) =>
  request(app)
    .post('/api/relationships')
    .set('Authorization', bearer(user))
    .send(body);

/** Father (1985, male) + child (2012, female) + spouse (1988, female). */
async function household() {
  const citizen = await createCitizen();
  const family = await registerFamily(citizen);
  const father = family.familyHeadId;

  const mother = await addMember(citizen, family.id, {
    name: 'Priya Patel',
    dateOfBirth: '1988-05-12',
    gender: 'FEMALE',
  });
  const daughter = await addMember(citizen, family.id, {
    name: 'Riya Patel',
    dateOfBirth: '2012-03-08',
    gender: 'FEMALE',
  });

  return { citizen, family, father, mother: mother.id, daughter: daughter.id };
}

describe('POST /api/relationships — happy path', () => {
  it('records a father-to-daughter relationship', async () => {
    const { citizen, father, daughter } = await household();

    const res = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.relationship).toMatchObject({
      relationshipType: 'FATHER',
      verificationStatus: 'PENDING',
    });
    expect(res.body.data.relationship.fromMember.name).toBe('Rahul Patel');
    expect(res.body.data.relationship.toMember.name).toBe('Riya Patel');
  });

  it('starts every relationship PENDING, never pre-verified', async () => {
    const { citizen, father, mother } = await household();

    const res = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: mother,
      relationshipType: 'SPOUSE',
    });

    expect(res.body.data.relationship.verificationStatus).toBe('PENDING');
    expect(res.body.data.relationship.verifiedAt).toBeNull();
    expect(res.body.data.relationship.verifiedById).toBeNull();
  });

  it('records an audit entry', async () => {
    const { citizen, father, daughter } = await household();

    const res = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    const log = await prisma.auditLog.findFirst({
      where: {
        entityType: 'Relationship',
        entityId: res.body.data.relationship.id,
      },
    });

    expect(log.action).toBe('RELATIONSHIP_CREATED');
    expect(log.userId).toBe(citizen.id);
    expect(log.newValue).toMatchObject({
      from: 'Rahul Patel',
      to: 'Riya Patel',
      relationshipType: 'FATHER',
    });
  });

  it('allows the reverse direction as a separate relationship', async () => {
    const { citizen, father, daughter } = await household();

    const forward = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });
    const reverse = await postRelationship(citizen, {
      fromMemberId: daughter,
      toMemberId: father,
      relationshipType: 'DAUGHTER',
    });

    expect(forward.status).toBe(201);
    expect(reverse.status).toBe(201);
    expect(await prisma.relationship.count()).toBe(2);
  });

  it('allows a spouse relationship in both directions', async () => {
    const { citizen, father, mother } = await household();

    const a = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: mother,
      relationshipType: 'SPOUSE',
    });
    const b = await postRelationship(citizen, {
      fromMemberId: mother,
      toMemberId: father,
      relationshipType: 'SPOUSE',
    });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });
});

describe('POST /api/relationships — integrity rules', () => {
  it('refuses a member related to themselves', async () => {
    const { citizen, father } = await household();

    const res = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: father,
      relationshipType: 'BROTHER',
    });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/cannot be related to themselves/i);
    expect(await prisma.relationship.count()).toBe(0);
  });

  it('refuses a relationship across two families', async () => {
    const { citizen, father } = await household();
    const outsiderCitizen = await createCitizen();
    const outsiderFamily = await registerFamily(outsiderCitizen);

    const res = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: outsiderFamily.familyHeadId,
      relationshipType: 'BROTHER',
    });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/same family/i);
    expect(await prisma.relationship.count()).toBe(0);
  });

  it('refuses the same directed relationship twice', async () => {
    const { citizen, father, mother } = await household();
    // SPOUSE, not FATHER: the single-father rule would reject a repeat FATHER
    // first, which is a different refusal than the duplicate guard.
    const body = {
      fromMemberId: father,
      toMemberId: mother,
      relationshipType: 'SPOUSE',
    };

    await postRelationship(citizen, body);
    const res = await postRelationship(citizen, body);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already been recorded/i);
    expect(await prisma.relationship.count()).toBe(1);
  });

  it('refuses a second father for the same person', async () => {
    const { citizen, family, father, daughter } = await household();
    const uncle = await addMember(citizen, family.id, {
      name: 'Suresh Patel',
      dateOfBirth: '1983-02-02',
      gender: 'MALE',
    });

    await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });
    const res = await postRelationship(citizen, {
      fromMemberId: uncle.id,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already has a recorded father/i);
  });

  it('allows a replacement father once the first was rejected', async () => {
    const { citizen, family, father, daughter } = await household();
    const officer = await createOfficer();
    const uncle = await addMember(citizen, family.id, {
      name: 'Suresh Patel',
      dateOfBirth: '1983-02-02',
      gender: 'MALE',
    });

    const first = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    await request(app)
      .put(`/api/relationships/${first.body.data.relationship.id}/verify`)
      .set('Authorization', bearer(officer))
      .send({ action: 'REJECT', reason: 'Document did not match' });

    const res = await postRelationship(citizen, {
      fromMemberId: uncle.id,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    expect(res.status).toBe(201);
  });

  it('refuses a father younger than his child', async () => {
    const { citizen, daughter, father } = await household();

    // Riya (2012) cannot be the mother of Rahul (1985).
    const res = await postRelationship(citizen, {
      fromMemberId: daughter,
      toMemberId: father,
      relationshipType: 'MOTHER',
    });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/dates of birth/i);
    expect(res.body.errors[0].message).toMatch(/not older than/i);
  });

  it('refuses a son older than his parent', async () => {
    const { citizen, father, daughter } = await household();

    // Rahul (1985) cannot be the son of Riya (2012).
    const res = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'SON',
    });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].message).toMatch(/not younger than/i);
  });

  it('refuses a relationship contradicting recorded gender', async () => {
    const { citizen, mother, daughter } = await household();

    // Priya is recorded FEMALE, so cannot be a father.
    const res = await postRelationship(citizen, {
      fromMemberId: mother,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/recorded gender/i);
  });

  it('accepts a gendered type for a member recorded as OTHER', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    const parent = await addMember(citizen, family.id, {
      name: 'Alex Patel',
      dateOfBirth: '1980-01-01',
      gender: 'OTHER',
    });
    const child = await addMember(citizen, family.id, {
      name: 'Sam Patel',
      dateOfBirth: '2010-01-01',
      gender: 'OTHER',
    });

    const res = await postRelationship(citizen, {
      fromMemberId: parent.id,
      toMemberId: child.id,
      relationshipType: 'FATHER',
    });

    // OTHER is never treated as a contradiction.
    expect(res.status).toBe(201);
  });

  it('allows a spouse relationship regardless of gender', async () => {
    const { citizen, father, mother } = await household();

    const res = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: mother,
      relationshipType: 'SPOUSE',
    });

    expect(res.status).toBe(201);
  });
});

describe('POST /api/relationships — authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const { father, daughter } = await household();

    const res = await request(app).post('/api/relationships').send({
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    expect(res.status).toBe(401);
    expect(await prisma.relationship.count()).toBe(0);
  });

  it('stops another citizen adding relationships to a family', async () => {
    const { father, daughter } = await household();
    const stranger = await createCitizen();

    const res = await postRelationship(stranger, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    expect(res.status).toBe(404);
    expect(await prisma.relationship.count()).toBe(0);
  });

  it('forbids an officer from authoring relationships', async () => {
    const { father, daughter } = await household();
    const officer = await createOfficer();

    const res = await postRelationship(officer, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    expect(res.status).toBe(403);
  });

  it('forbids an admin from authoring relationships', async () => {
    const { father, daughter } = await household();
    const admin = await createAdmin();

    const res = await postRelationship(admin, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
    });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/relationships — validation', () => {
  const invalidCases = [
    ['missing everything', () => ({}), ['fromMemberId', 'toMemberId', 'relationshipType']],
    [
      'unknown type',
      (h) => ({ fromMemberId: h.father, toMemberId: h.daughter, relationshipType: 'NEMESIS' }),
      ['relationshipType'],
    ],
    [
      'malformed member id',
      (h) => ({ fromMemberId: 'nope', toMemberId: h.daughter, relationshipType: 'FATHER' }),
      ['fromMemberId'],
    ],
    [
      'missing relationship type',
      (h) => ({ fromMemberId: h.father, toMemberId: h.daughter }),
      ['relationshipType'],
    ],
  ];

  it.each(invalidCases)('rejects %s', async (_label, buildBody, expectedFields) => {
    const home = await household();
    const { citizen } = home;

    const res = await postRelationship(citizen, buildBody(home));

    expect(res.status).toBe(422);
    const fields = res.body.errors.map((e) => e.field);
    for (const field of expectedFields) {
      expect(fields).toContain(field);
    }
  });

  it('returns 404 for a member that does not exist', async () => {
    const { citizen, father } = await household();

    const res = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: '00000000-0000-0000-0000-000000000000',
      relationshipType: 'FATHER',
    });

    expect(res.status).toBe(404);
  });

  it('ignores a client-supplied verification status', async () => {
    const { citizen, father, daughter } = await household();

    const res = await postRelationship(citizen, {
      fromMemberId: father,
      toMemberId: daughter,
      relationshipType: 'FATHER',
      verificationStatus: 'VERIFIED',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.relationship.verificationStatus).toBe('PENDING');
  });
});
