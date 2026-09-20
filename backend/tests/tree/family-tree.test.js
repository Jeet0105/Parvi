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
const { assignGenerations } = require('../../src/services/tree.service');

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

const relate = (user, body) =>
  request(app)
    .post('/api/relationships')
    .set('Authorization', bearer(user))
    .send(body);

const getTree = (user, familyId, query = '') =>
  request(app)
    .get(`/api/families/${familyId}/tree${query}`)
    .set('Authorization', bearer(user));

/**
 * Grandfather (1955) -> father (1985) + mother (1988, spouse)
 *                    -> daughter (2012) + son (2015)
 */
async function threeGenerationFamily() {
  const citizen = await createCitizen();
  const family = await registerFamily(citizen);
  const father = family.familyHeadId;

  const grandfather = await addMember(citizen, family.id, {
    name: 'Vivek Patel',
    dateOfBirth: '1955-01-10',
    gender: 'MALE',
  });
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
  const son = await addMember(citizen, family.id, {
    name: 'Arjun Patel',
    dateOfBirth: '2015-07-20',
    gender: 'MALE',
  });

  await relate(citizen, {
    fromMemberId: grandfather.id,
    toMemberId: father,
    relationshipType: 'FATHER',
  });
  await relate(citizen, {
    fromMemberId: father,
    toMemberId: mother.id,
    relationshipType: 'SPOUSE',
  });
  await relate(citizen, {
    fromMemberId: father,
    toMemberId: daughter.id,
    relationshipType: 'FATHER',
  });
  await relate(citizen, {
    fromMemberId: mother.id,
    toMemberId: son.id,
    relationshipType: 'MOTHER',
  });

  return {
    citizen,
    family,
    ids: {
      grandfather: grandfather.id,
      father,
      mother: mother.id,
      daughter: daughter.id,
      son: son.id,
    },
  };
}

describe('GET /api/families/:familyId/tree', () => {
  it('returns every member as a node', async () => {
    const { citizen, family } = await threeGenerationFamily();

    const res = await getTree(citizen, family.id);

    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toHaveLength(5);
    expect(res.body.data.familyId).toBe(family.familyId);
  });

  it('returns relationships as edges', async () => {
    const { citizen, family } = await threeGenerationFamily();

    const res = await getTree(citizen, family.id);

    expect(res.body.data.relationships).toHaveLength(4);
    expect(res.body.data.relationships[0]).toMatchObject({
      source: expect.any(String),
      target: expect.any(String),
      type: expect.any(String),
      verificationStatus: expect.any(String),
    });
  });

  it('carries the detail each node needs to be drawn', async () => {
    const { citizen, family, ids } = await threeGenerationFamily();

    const res = await getTree(citizen, family.id);
    const head = res.body.data.nodes.find((n) => n.id === ids.father);

    expect(head).toMatchObject({
      name: 'Rahul Patel',
      gender: 'MALE',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
      isHead: true,
    });
    expect(head.age).toBe(41);
  });

  it('marks only the Family Head', async () => {
    const { citizen, family, ids } = await threeGenerationFamily();

    const res = await getTree(citizen, family.id);
    const heads = res.body.data.nodes.filter((n) => n.isHead);

    expect(heads).toHaveLength(1);
    expect(heads[0].id).toBe(ids.father);
  });
});

describe('generation assignment', () => {
  it('places each generation on its own level', async () => {
    const { citizen, family, ids } = await threeGenerationFamily();

    const res = await getTree(citizen, family.id);
    const byId = Object.fromEntries(
      res.body.data.nodes.map((n) => [n.id, n.generation])
    );

    expect(byId[ids.grandfather]).toBe(0);
    expect(byId[ids.father]).toBe(1);
    expect(byId[ids.daughter]).toBe(2);
    expect(byId[ids.son]).toBe(2);
  });

  it('puts spouses on the same level', async () => {
    const { citizen, family, ids } = await threeGenerationFamily();

    const res = await getTree(citizen, family.id);
    const byId = Object.fromEntries(
      res.body.data.nodes.map((n) => [n.id, n.generation])
    );

    // Priya is only linked as a spouse and as a mother, but must sit beside
    // Rahul rather than floating at the top of the tree.
    expect(byId[ids.mother]).toBe(byId[ids.father]);
  });

  it('reports how many generations the tree spans', async () => {
    const { citizen, family } = await threeGenerationFamily();

    const res = await getTree(citizen, family.id);

    expect(res.body.data.generations).toBe(3);
  });

  it('handles a grandparent link spanning two levels', () => {
    const generation = assignGenerations(
      ['grandparent', 'grandchild'],
      [
        {
          fromMemberId: 'grandparent',
          toMemberId: 'grandchild',
          relationshipType: 'GRANDFATHER',
        },
      ]
    );

    expect(generation.get('grandparent')).toBe(0);
    expect(generation.get('grandchild')).toBe(2);
  });

  it('handles child-to-parent direction', () => {
    const generation = assignGenerations(
      ['child', 'parent'],
      [
        {
          fromMemberId: 'child',
          toMemberId: 'parent',
          relationshipType: 'SON',
        },
      ]
    );

    expect(generation.get('parent')).toBe(0);
    expect(generation.get('child')).toBe(1);
  });

  it('puts siblings on the same level', () => {
    const generation = assignGenerations(
      ['a', 'b'],
      [{ fromMemberId: 'a', toMemberId: 'b', relationshipType: 'BROTHER' }]
    );

    expect(generation.get('a')).toBe(generation.get('b'));
  });

  it('terminates on contradictory data rather than looping forever', () => {
    // Citizen-entered data can be self-contradictory; a usable layout still
    // has to come back.
    const generation = assignGenerations(
      ['a', 'b'],
      [
        { fromMemberId: 'a', toMemberId: 'b', relationshipType: 'FATHER' },
        { fromMemberId: 'b', toMemberId: 'a', relationshipType: 'FATHER' },
      ]
    );

    expect(generation.get('a')).toEqual(expect.any(Number));
    expect(generation.get('b')).toEqual(expect.any(Number));
  });

  it('leaves an unconnected member at the top level', () => {
    const generation = assignGenerations(['lonely'], []);
    expect(generation.get('lonely')).toBe(0);
  });
});

describe('tree edges', () => {
  it('flags spouse links as horizontal', async () => {
    const { citizen, family } = await threeGenerationFamily();

    const res = await getTree(citizen, family.id);
    const spouse = res.body.data.relationships.find((r) => r.type === 'SPOUSE');
    const parent = res.body.data.relationships.find((r) => r.type === 'FATHER');

    expect(spouse.isHorizontal).toBe(true);
    expect(parent.isHorizontal).toBe(false);
  });

  it('excludes rejected relationships', async () => {
    const { citizen, family, ids } = await threeGenerationFamily();
    const officer = await createOfficer();

    const relationships = await prisma.relationship.findMany({
      where: { fromMemberId: ids.father, relationshipType: 'FATHER' },
    });
    await request(app)
      .put(`/api/relationships/${relationships[0].id}/verify`)
      .set('Authorization', bearer(officer))
      .send({ action: 'REJECT', reason: 'Certificate did not match' });

    const res = await getTree(citizen, family.id);

    // A rejected claim is not part of the family picture.
    expect(res.body.data.relationships).toHaveLength(3);
    expect(
      res.body.data.relationships.some((r) => r.id === relationships[0].id)
    ).toBe(false);
  });

  it('can show only verified relationships', async () => {
    const { citizen, family, ids } = await threeGenerationFamily();
    const officer = await createOfficer();

    const spouse = await prisma.relationship.findFirst({
      where: { relationshipType: 'SPOUSE' },
    });
    await request(app)
      .put(`/api/relationships/${spouse.id}/verify`)
      .set('Authorization', bearer(officer))
      .send({ action: 'APPROVE' });

    const res = await getTree(citizen, family.id, '?verificationStatus=VERIFIED');

    expect(res.body.data.relationships).toHaveLength(1);
    expect(res.body.data.relationships[0].type).toBe('SPOUSE');
    // Nodes are unaffected by the edge filter.
    expect(res.body.data.nodes).toHaveLength(5);
    expect(ids.father).toEqual(expect.any(String));
  });
});

describe('tree access control', () => {
  it('lets an officer read the tree', async () => {
    const { family } = await threeGenerationFamily();
    const officer = await createOfficer();

    const res = await getTree(officer, family.id);

    expect(res.status).toBe(200);
  });

  it('hides the tree from an unrelated citizen', async () => {
    const { family } = await threeGenerationFamily();
    const stranger = await createCitizen();

    const res = await getTree(stranger, family.id);

    expect(res.status).toBe(404);
  });

  it('hides the tree from a district officer elsewhere', async () => {
    const { family } = await threeGenerationFamily();
    const officer = await createDistrictOfficer({ district: 'Surat' });

    const res = await getTree(officer, family.id);

    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const { family } = await threeGenerationFamily();

    const res = await request(app).get(`/api/families/${family.id}/tree`);

    expect(res.status).toBe(401);
  });

  it('returns 404 for a family that does not exist', async () => {
    const citizen = await createCitizen();

    const res = await getTree(citizen, '00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
  });
});

describe('tree edge cases', () => {
  it('handles a family with only the head and no relationships', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await getTree(citizen, family.id);

    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toHaveLength(1);
    expect(res.body.data.relationships).toHaveLength(0);
    expect(res.body.data.generations).toBe(1);
  });

  it('includes members who have left the household', async () => {
    const { citizen, family, ids } = await threeGenerationFamily();
    await request(app)
      .put(`/api/members/${ids.grandfather}`)
      .set('Authorization', bearer(citizen))
      .send({ status: 'DECEASED' });

    const res = await getTree(citizen, family.id);
    const grandfather = res.body.data.nodes.find((n) => n.id === ids.grandfather);

    // History stays visible in the tree, marked by status.
    expect(grandfather.status).toBe('DECEASED');
    expect(res.body.data.nodes).toHaveLength(5);
  });
});
