const request = require('supertest');

const app = require('../../src/app');
const { bearer } = require('./auth');

const baseFamily = {
  state: 'Gujarat',
  district: 'Ahmedabad',
  taluka: 'Daskroi',
  village: 'Example Village',
  address: '12 Example Road, Example Village',
  head: { name: 'Rahul Patel', dateOfBirth: '1985-04-12', gender: 'MALE' },
};

/** Registers a family through the real API so the full flow is exercised. */
async function registerFamily(citizen, overrides = {}) {
  const res = await request(app)
    .post('/api/families')
    .set('Authorization', bearer(citizen))
    .send({ ...baseFamily, ...overrides });

  if (res.status !== 201) {
    throw new Error(
      `registerFamily failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  return res.body.data.family;
}

const validMember = {
  name: 'Priya Patel',
  dateOfBirth: '1988-05-12',
  gender: 'FEMALE',
};

async function addMember(citizen, familyId, overrides = {}) {
  const res = await request(app)
    .post(`/api/families/${familyId}/members`)
    .set('Authorization', bearer(citizen))
    .send({ ...validMember, ...overrides });

  if (res.status !== 201) {
    throw new Error(
      `addMember failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  return res.body.data.member;
}

module.exports = { registerFamily, addMember, baseFamily, validMember };
