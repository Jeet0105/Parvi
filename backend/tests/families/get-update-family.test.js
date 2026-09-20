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

const baseFamily = {
  state: 'Gujarat',
  district: 'Ahmedabad',
  taluka: 'Daskroi',
  village: 'Example Village',
  address: '12 Example Road, Example Village',
  head: { name: 'Rahul Patel', dateOfBirth: '1985-04-12', gender: 'MALE' },
};

/** Registers a family through the API so it goes through the real flow. */
async function registerFamily(citizen, overrides = {}) {
  const res = await request(app)
    .post('/api/families')
    .set('Authorization', bearer(citizen))
    .send({ ...baseFamily, ...overrides });
  return res.body.data.family;
}

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

describe('GET /api/families/:id', () => {
  it('lets the owning citizen read their family', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .get(`/api/families/${family.id}`)
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.body.data.family.id).toBe(family.id);
    expect(res.body.data.family.members).toHaveLength(1);
  });

  it('accepts the public Family ID as well as the database id', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .get(`/api/families/${family.familyId}`)
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.body.data.family.id).toBe(family.id);
  });

  it('hides the family of another citizen behind a 404', async () => {
    const owner = await createCitizen();
    const stranger = await createCitizen();
    const family = await registerFamily(owner);

    const res = await request(app)
      .get(`/api/families/${family.id}`)
      .set('Authorization', bearer(stranger));

    // 404 rather than 403: a 403 would confirm the identifier exists.
    expect(res.status).toBe(404);
    expect(res.body.data).toBeUndefined();
  });

  it('lets a verification officer read any family', async () => {
    const citizen = await createCitizen();
    const officer = await createOfficer();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .get(`/api/families/${family.id}`)
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
  });

  it('lets a district officer read a family in their district', async () => {
    const citizen = await createCitizen();
    const officer = await createDistrictOfficer({ district: 'Ahmedabad' });
    const family = await registerFamily(citizen);

    const res = await request(app)
      .get(`/api/families/${family.id}`)
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
  });

  it('stops a district officer reading outside their district', async () => {
    const citizen = await createCitizen();
    const officer = await createDistrictOfficer({ district: 'Surat' });
    const family = await registerFamily(citizen, { district: 'Ahmedabad' });

    const res = await request(app)
      .get(`/api/families/${family.id}`)
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(404);
  });

  it('returns 404 for a family that does not exist', async () => {
    const citizen = await createCitizen();

    const res = await request(app)
      .get('/api/families/00000000-0000-0000-0000-000000000000')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated read', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app).get(`/api/families/${family.id}`);

    expect(res.status).toBe(401);
  });
});

describe('GET /api/families/mine', () => {
  it('returns the signed-in citizen family', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .get('/api/families/mine')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.body.data.family.id).toBe(family.id);
  });

  it('returns null when nothing is registered yet', async () => {
    const citizen = await createCitizen();

    const res = await request(app)
      .get('/api/families/mine')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.body.data.family).toBeNull();
    expect(res.body.message).toMatch(/no family registered/i);
  });

  it('is not reachable by an officer', async () => {
    const officer = await createOfficer();

    const res = await request(app)
      .get('/api/families/mine')
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/families (officer list)', () => {
  it('lists families for a verification officer', async () => {
    const officer = await createOfficer();
    await registerFamily(await createCitizen());
    await registerFamily(await createCitizen(), { district: 'Surat' });

    const res = await request(app)
      .get('/api/families')
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
    expect(res.body.data.families).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(2);
  });

  it('scopes a district officer to their own district', async () => {
    const officer = await createDistrictOfficer({ district: 'Surat' });
    await registerFamily(await createCitizen(), { district: 'Ahmedabad' });
    await registerFamily(await createCitizen(), { district: 'Surat' });

    const res = await request(app)
      .get('/api/families')
      .set('Authorization', bearer(officer));

    expect(res.body.data.families).toHaveLength(1);
    expect(res.body.data.families[0].district).toBe('Surat');
  });

  it('ignores a district query that would widen a district officer scope', async () => {
    const officer = await createDistrictOfficer({ district: 'Surat' });
    await registerFamily(await createCitizen(), { district: 'Ahmedabad' });

    const res = await request(app)
      .get('/api/families?district=Ahmedabad')
      .set('Authorization', bearer(officer));

    expect(res.body.data.families).toHaveLength(0);
  });

  it('filters by status', async () => {
    const officer = await createOfficer();
    await registerFamily(await createCitizen());

    const draft = await request(app)
      .get('/api/families?status=DRAFT')
      .set('Authorization', bearer(officer));
    const verified = await request(app)
      .get('/api/families?status=VERIFIED')
      .set('Authorization', bearer(officer));

    expect(draft.body.data.families).toHaveLength(1);
    expect(verified.body.data.families).toHaveLength(0);
  });

  it('forbids a citizen from listing all families', async () => {
    const citizen = await createCitizen();

    const res = await request(app)
      .get('/api/families')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/families/:id', () => {
  it('lets the owner update address details', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(citizen))
      .send({ address: '45 New Road, Example Village', village: 'New Village' });

    expect(res.status).toBe(200);
    expect(res.body.data.family.address).toBe('45 New Road, Example Village');
    expect(res.body.data.family.village).toBe('New Village');
  });

  it('keeps the Family ID stable across an address change', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(citizen))
      .send({ district: 'Surat', address: '9 Relocation Street' });

    // The ID must survive the move; that is the whole point of it.
    expect(res.body.data.family.familyId).toBe(family.familyId);
  });

  it('records what changed in the audit trail', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(citizen))
      .send({ village: 'New Village' });

    const log = await prisma.auditLog.findFirst({
      where: { entityId: family.id, action: 'FAMILY_UPDATED' },
    });

    expect(log).not.toBeNull();
    expect(log.oldValue).toEqual({ village: 'Example Village' });
    expect(log.newValue).toEqual({ village: 'New Village' });
    expect(log.userId).toBe(citizen.id);
  });

  it('does not write an audit entry when nothing actually changed', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(citizen))
      .send({ village: 'Example Village' });

    expect(res.status).toBe(200);
    expect(
      await prisma.auditLog.count({ where: { action: 'FAMILY_UPDATED' } })
    ).toBe(0);
  });

  it('stops another citizen updating the family', async () => {
    const owner = await createCitizen();
    const stranger = await createCitizen();
    const family = await registerFamily(owner);

    const res = await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(stranger))
      .send({ village: 'Hijacked' });

    expect(res.status).toBe(404);

    const stored = await prisma.family.findUnique({ where: { id: family.id } });
    expect(stored.village).toBe('Example Village');
  });

  it('stops an officer editing family details', async () => {
    const citizen = await createCitizen();
    const officer = await createOfficer();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(officer))
      .send({ village: 'Officer Edit' });

    // Officers verify families; they do not edit citizen-entered details.
    expect(res.status).toBe(403);
  });

  it('stops an admin editing family details', async () => {
    const citizen = await createCitizen();
    const admin = await createAdmin();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(admin))
      .send({ village: 'Admin Edit' });

    expect(res.status).toBe(403);
  });

  it('refuses to edit a verified family', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);
    await prisma.family.update({
      where: { id: family.id },
      data: { status: 'VERIFIED' },
    });

    const res = await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(citizen))
      .send({ village: 'Changed After Verification' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/verified family cannot be edited/i);
  });

  it('rejects an empty update', async () => {
    const citizen = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(citizen))
      .send({});

    expect(res.status).toBe(422);
  });

  it('ignores attempts to change the Family ID or owner', async () => {
    const citizen = await createCitizen();
    const other = await createCitizen();
    const family = await registerFamily(citizen);

    const res = await request(app)
      .put(`/api/families/${family.id}`)
      .set('Authorization', bearer(citizen))
      .send({
        village: 'New Village',
        familyId: 'GJ-FAM-HACKED01',
        ownerId: other.id,
        status: 'VERIFIED',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.family.familyId).toBe(family.familyId);
    expect(res.body.data.family.ownerId).toBe(citizen.id);
    expect(res.body.data.family.status).toBe('DRAFT');
  });
});
