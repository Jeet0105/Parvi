const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../../src/app');
const { prisma, resetDatabase, disconnectDatabase } = require('../helpers/db');
const { createCitizen, createAdmin, bearer } = require('../helpers/auth');

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

describe('authenticate middleware — GET /api/auth/me', () => {
  it('returns the profile for a valid token', async () => {
    const citizen = await createCitizen();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      id: citizen.id,
      email: citizen.email,
      role: 'CITIZEN',
    });
  });

  it('never exposes the password hash', async () => {
    const citizen = await createCitizen();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', bearer(citizen));

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2b$');
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Authentication required');
  });

  it('rejects a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid authentication token');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const citizen = await createCitizen();
    const forged = jwt.sign({ sub: citizen.id, role: 'ADMIN' }, 'attacker-secret');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid authentication token');
  });

  it('rejects an expired token with a distinct message', async () => {
    const citizen = await createCitizen();
    const expired = jwt.sign(
      { sub: citizen.id, role: citizen.role },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/session expired/i);
  });

  it('rejects a token whose user no longer exists', async () => {
    const citizen = await createCitizen();
    await prisma.user.delete({ where: { id: citizen.id } });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid authentication token');
  });

  it('reflects a role change made after the token was issued', async () => {
    const citizen = await createCitizen();
    await prisma.user.update({
      where: { id: citizen.id },
      data: { role: 'ADMIN' },
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', bearer(citizen));

    // The role comes from the database, not from the stale token payload.
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  it('does not trust a role claim forged into a validly signed token', async () => {
    const citizen = await createCitizen();
    const tampered = jwt.sign(
      { sub: citizen.id, role: 'ADMIN' },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tampered}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('CITIZEN');
  });

  it('blocks admin routes for a token carrying a forged admin role', async () => {
    const citizen = await createCitizen();
    const tampered = jwt.sign(
      { sub: citizen.id, role: 'ADMIN' },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tampered}`);

    expect(res.status).toBe(403);
  });

  const malformedHeaders = [
    ['empty header', ''],
    ['token without a scheme', 'abc.def.ghi'],
    ['wrong scheme', 'Basic abc.def.ghi'],
    ['scheme with no token', 'Bearer'],
    ['scheme with blank token', 'Bearer    '],
  ];

  it.each(malformedHeaders)('rejects a %s', async (_label, header) => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', header);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('accepts a lowercase bearer scheme', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('ADMIN');
  });
});
