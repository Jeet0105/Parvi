const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = require('../../src/app');
const { prisma, resetDatabase, disconnectDatabase } = require('../helpers/db');

const validPayload = {
  name: 'Rahul Patel',
  email: 'rahul@example.com',
  mobile: '9876543210',
  password: 'Password123',
};

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

describe('POST /api/auth/register — happy path', () => {
  it('registers a citizen and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Registration successful');
    expect(res.body.data.user).toMatchObject({
      name: 'Rahul Patel',
      email: 'rahul@example.com',
      mobile: '9876543210',
      role: 'CITIZEN',
    });
    expect(res.body.data.user.id).toEqual(expect.any(String));
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it('persists the user to the database', async () => {
    await request(app).post('/api/auth/register').send(validPayload);

    const user = await prisma.user.findUnique({
      where: { email: 'rahul@example.com' },
    });
    expect(user).not.toBeNull();
    expect(user.role).toBe('CITIZEN');
  });

  it('stores the password as a bcrypt hash, never plaintext', async () => {
    await request(app).post('/api/auth/register').send(validPayload);

    const user = await prisma.user.findUnique({
      where: { email: 'rahul@example.com' },
    });

    expect(user.passwordHash).not.toBe(validPayload.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    await expect(
      bcrypt.compare(validPayload.password, user.passwordHash)
    ).resolves.toBe(true);
  });

  it('never returns the password or its hash', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload);

    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain(validPayload.password);
    expect(serialised).not.toContain('passwordHash');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('issues a JWT carrying only the user id and role', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload);

    const payload = jwt.verify(res.body.data.token, process.env.JWT_SECRET);

    expect(payload.sub).toBe(res.body.data.user.id);
    expect(payload.role).toBe('CITIZEN');
    // No personal or secret data in a signed-but-readable token.
    expect(payload.email).toBeUndefined();
    expect(payload.mobile).toBeUndefined();
    expect(payload.password).toBeUndefined();
    expect(payload.passwordHash).toBeUndefined();
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('normalises email casing and trims whitespace', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: '  RAHUL@Example.COM  ', name: '  Rahul Patel  ' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('rahul@example.com');
    expect(res.body.data.user.name).toBe('Rahul Patel');
  });
});

describe('POST /api/auth/register — conflicts', () => {
  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(validPayload);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, mobile: '9876500000' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/email/i);
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects a duplicate email regardless of casing', async () => {
    await request(app).post('/api/auth/register').send(validPayload);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: 'RAHUL@EXAMPLE.COM', mobile: '9876500000' });

    expect(res.status).toBe(409);
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects a duplicate mobile with 409', async () => {
    await request(app).post('/api/auth/register').send(validPayload);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: 'other@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/mobile/i);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe('POST /api/auth/register — validation', () => {
  const invalidCases = [
    ['missing every field', {}, ['name', 'email', 'mobile', 'password']],
    ['missing password', { ...validPayload, password: undefined }, ['password']],
    ['invalid email', { ...validPayload, email: 'not-an-email' }, ['email']],
    ['email without domain', { ...validPayload, email: 'rahul@' }, ['email']],
    ['short password', { ...validPayload, password: 'Pass1' }, ['password']],
    ['password without a digit', { ...validPayload, password: 'PasswordOnly' }, ['password']],
    ['password without a letter', { ...validPayload, password: '12345678' }, ['password']],
    ['mobile too short', { ...validPayload, mobile: '98765' }, ['mobile']],
    ['mobile with letters', { ...validPayload, mobile: '98765abcde' }, ['mobile']],
    ['mobile starting below 6', { ...validPayload, mobile: '1234567890' }, ['mobile']],
    ['name too short', { ...validPayload, name: 'R' }, ['name']],
  ];

  it.each(invalidCases)('rejects %s', async (_label, payload, expectedFields) => {
    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');

    const fields = res.body.errors.map((e) => e.field);
    for (const field of expectedFields) {
      expect(fields).toContain(field);
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects malformed JSON with 400, not 500', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name": "broken"');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/malformed json/i);
  });
});

describe('POST /api/auth/register — privilege escalation', () => {
  it('ignores a role supplied in the request body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('CITIZEN');

    const user = await prisma.user.findUnique({
      where: { email: validPayload.email },
    });
    expect(user.role).toBe('CITIZEN');
  });

  it('ignores an id supplied in the request body', async () => {
    const injectedId = '11111111-1111-1111-1111-111111111111';
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, id: injectedId });

    expect(res.status).toBe(201);
    expect(res.body.data.user.id).not.toBe(injectedId);
  });
});

describe('POST /api/auth/register — error message quality', () => {
  it('reports missing fields in plain language', async () => {
    const res = await request(app).post('/api/auth/register').send({});

    const byField = Object.fromEntries(
      res.body.errors.map((e) => [e.field, e.message])
    );

    expect(byField.name).toBe('Name is required');
    expect(byField.email).toBe('Email is required');
    expect(byField.mobile).toBe('Mobile is required');
    expect(byField.password).toBe('Password is required');
  });

  it('reports a wrong type without leaking internals', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, name: 12345 });

    const nameError = res.body.errors.find((e) => e.field === 'name');
    expect(nameError.message).toBe('Name must be text');
  });
});
