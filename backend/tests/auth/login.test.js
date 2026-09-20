const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../../src/app');
const { prisma, resetDatabase, disconnectDatabase } = require('../helpers/db');

const credentials = {
  name: 'Rahul Patel',
  email: 'rahul@example.com',
  mobile: '9876543210',
  password: 'Password123',
};

async function registerUser(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({ ...credentials, ...overrides });
}

beforeEach(async () => {
  await resetDatabase();
  await registerUser();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

describe('POST /api/auth/login — happy path', () => {
  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.data.user.email).toBe(credentials.email);
    expect(res.body.data.user.role).toBe('CITIZEN');
  });

  it('returns a verifiable JWT bound to the user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    const payload = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { email: credentials.email } });

    expect(payload.sub).toBe(user.id);
    expect(payload.role).toBe('CITIZEN');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('accepts an email with different casing and padding', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  RAHUL@EXAMPLE.COM ', password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('rahul@example.com');
  });

  it('never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain('passwordHash');
    expect(serialised).not.toContain(credentials.password);
    expect(serialised).not.toContain('$2b$');
  });
});

describe('POST /api/auth/login — rejected credentials', () => {
  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeUndefined();
  });

  it('rejects an unknown user with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: credentials.password });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('does not reveal whether an email is registered', async () => {
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: credentials.password });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'WrongPassword1' });

    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body.message).toBe(wrongPassword.body.message);
  });

  it('is case-sensitive on the password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'password123' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/login — validation', () => {
  const invalidCases = [
    ['missing both fields', {}, ['email', 'password']],
    ['missing password', { email: credentials.email }, ['password']],
    ['missing email', { password: credentials.password }, ['email']],
    ['empty password', { email: credentials.email, password: '' }, ['password']],
    ['invalid email', { email: 'not-an-email', password: 'x' }, ['email']],
  ];

  it.each(invalidCases)('rejects %s', async (_label, payload, expectedFields) => {
    const res = await request(app).post('/api/auth/login').send(payload);

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Validation failed');

    const fields = res.body.errors.map((e) => e.field);
    for (const field of expectedFields) {
      expect(fields).toContain(field);
    }
  });
});

describe('POST /api/auth/login — injection-style input', () => {
  it('treats SQL metacharacters as literal text', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: "admin'--@example.com", password: "' OR '1'='1" });

    // Parameterised queries mean this is just a failed lookup, not a breach.
    expect([401, 422]).toContain(res.status);
    expect(await prisma.user.count()).toBe(1);
  });

  it('does not treat a Prisma operator object as a filter', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { not: '' }, password: credentials.password });

    expect(res.status).toBe(422);
    expect(res.body.data).toBeUndefined();
  });
});
