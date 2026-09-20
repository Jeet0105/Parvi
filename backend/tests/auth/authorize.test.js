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

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

describe('authorize middleware — admin-only /api/users', () => {
  it('allows an administrator', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.pagination).toMatchObject({ total: 1, page: 1 });
  });

  const forbiddenRoles = [
    ['a citizen', createCitizen],
    ['a verification officer', createOfficer],
    ['a district officer', createDistrictOfficer],
  ];

  it.each(forbiddenRoles)('forbids %s with 403', async (_label, factory) => {
    const user = await factory();

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', bearer(user));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/permission/i);
    expect(res.body.data).toBeUndefined();
  });

  it('returns 401, not 403, when there is no token at all', async () => {
    const res = await request(app).get('/api/users');

    // The client redirects to login on 401 but shows a refusal on 403,
    // so the two must stay distinct.
    expect(res.status).toBe(401);
  });

  it('never leaks password hashes in the directory', async () => {
    const admin = await createAdmin();
    await createCitizen();

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', bearer(admin));

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2b$');
  });
});

describe('authorize middleware — filtering and paging', () => {
  it('filters the directory by role', async () => {
    const admin = await createAdmin();
    await createCitizen();
    await createOfficer();

    const res = await request(app)
      .get('/api/users?role=CITIZEN')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].role).toBe('CITIZEN');
  });

  it('filters by district', async () => {
    const admin = await createAdmin();
    await createOfficer({ district: 'Ahmedabad' });
    await createOfficer({ district: 'Surat' });

    const res = await request(app)
      .get('/api/users?district=Surat')
      .set('Authorization', bearer(admin));

    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].district).toBe('Surat');
  });

  it('pages results', async () => {
    const admin = await createAdmin();
    await createCitizen();
    await createCitizen();

    const res = await request(app)
      .get('/api/users?page=1&pageSize=2')
      .set('Authorization', bearer(admin));

    expect(res.body.data.users).toHaveLength(2);
    expect(res.body.data.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('rejects an unknown role filter', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/users?role=SUPERUSER')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('role');
  });

  it('rejects a non-positive page size', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/users?pageSize=0')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(422);
  });

  it('rejects an oversized page size rather than serving it', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/users?pageSize=5000')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(422);
  });
});

describe('authorize middleware — role changes', () => {
  it('lets an admin promote a citizen to officer', async () => {
    const admin = await createAdmin();
    const citizen = await createCitizen();

    const res = await request(app)
      .put(`/api/users/${citizen.id}/role`)
      .set('Authorization', bearer(admin))
      .send({ role: 'VERIFICATION_OFFICER' });

    expect(res.status).toBe(200);
    expect(res.body.data.previousRole).toBe('CITIZEN');
    expect(res.body.data.user.role).toBe('VERIFICATION_OFFICER');

    const stored = await prisma.user.findUnique({ where: { id: citizen.id } });
    expect(stored.role).toBe('VERIFICATION_OFFICER');
  });

  it('stops an admin from changing their own role', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .put(`/api/users/${admin.id}/role`)
      .set('Authorization', bearer(admin))
      .send({ role: 'CITIZEN' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/your own role/i);

    const stored = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(stored.role).toBe('ADMIN');
  });

  it('stops a citizen from promoting themselves', async () => {
    const citizen = await createCitizen();

    const res = await request(app)
      .put(`/api/users/${citizen.id}/role`)
      .set('Authorization', bearer(citizen))
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(403);

    const stored = await prisma.user.findUnique({ where: { id: citizen.id } });
    expect(stored.role).toBe('CITIZEN');
  });

  it('rejects an unknown role value', async () => {
    const admin = await createAdmin();
    const citizen = await createCitizen();

    const res = await request(app)
      .put(`/api/users/${citizen.id}/role`)
      .set('Authorization', bearer(admin))
      .send({ role: 'SUPERUSER' });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('role');
  });

  it('returns 404 for a user that does not exist', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .put('/api/users/00000000-0000-0000-0000-000000000000/role')
      .set('Authorization', bearer(admin))
      .send({ role: 'CITIZEN' });

    expect(res.status).toBe(404);
  });

  it('rejects a malformed user id', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/users/not-a-uuid')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('id');
  });
});
