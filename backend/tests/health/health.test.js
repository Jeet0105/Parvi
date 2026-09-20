const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/health', () => {
  it('returns 200 with the running message', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Family Identity Platform API is running',
    });
  });

  it('responds as JSON', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('sets helmet security headers', async () => {
    const res = await request(app).get('/api/health');
    // Helmet's signature headers; proves the middleware is actually wired in.
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('unmatched routes', () => {
  it('returns a consistent 404 envelope', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Route not found');
  });

  it('returns 404 for the bare root path', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
