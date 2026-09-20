const fs = require('node:fs');
const path = require('node:path');

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
const { registerFamily } = require('../helpers/family');
const { uploadDir } = require('../../src/config/upload');

const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake test document\n');

beforeEach(resetDatabase);

afterEach(() => {
  const dir = uploadDir();
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name !== '.gitkeep') {
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        // Already gone.
      }
    }
  }
});

afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

/** A family with one uploaded, still-pending document. */
async function uploadedDocument(familyOverrides = {}) {
  const citizen = await createCitizen();
  const family = await registerFamily(citizen, familyOverrides);

  const res = await request(app)
    .post('/api/documents')
    .set('Authorization', bearer(citizen))
    .field('memberId', family.familyHeadId)
    .field('documentType', 'BIRTH_CERTIFICATE')
    .attach('file', PDF_BYTES, {
      filename: 'proof.pdf',
      contentType: 'application/pdf',
    });

  return { citizen, family, document: res.body.data.document };
}

const verify = (user, id, body) =>
  request(app)
    .put(`/api/documents/${id}/verify`)
    .set('Authorization', bearer(user))
    .send(body);

describe('PUT /api/documents/:id/verify', () => {
  it('approves a document', async () => {
    const { document } = await uploadedDocument();
    const officer = await createOfficer();

    const res = await verify(officer, document.id, { action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.data.document.verificationStatus).toBe('VERIFIED');
    expect(res.body.data.document.verifiedById).toBe(officer.id);
    expect(res.body.data.document.verifiedAt).not.toBeNull();
  });

  it('rejects a document with a reason', async () => {
    const { document } = await uploadedDocument();
    const officer = await createOfficer();

    const res = await verify(officer, document.id, {
      action: 'REJECT',
      reason: 'Scan is illegible',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.document.verificationStatus).toBe('REJECTED');
    expect(res.body.data.document.rejectionReason).toBe('Scan is illegible');
  });

  it('requires a reason when rejecting', async () => {
    const { document } = await uploadedDocument();
    const officer = await createOfficer();

    const res = await verify(officer, document.id, { action: 'REJECT' });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('reason');
  });

  it('refuses to repeat a decision', async () => {
    const { document } = await uploadedDocument();
    const officer = await createOfficer();

    await verify(officer, document.id, { action: 'APPROVE' });
    const res = await verify(officer, document.id, { action: 'APPROVE' });

    expect(res.status).toBe(409);
  });

  it('records the decision in the audit trail', async () => {
    const { document } = await uploadedDocument();
    const officer = await createOfficer();

    await verify(officer, document.id, { action: 'APPROVE' });

    const log = await prisma.auditLog.findFirst({
      where: { entityId: document.id, action: 'DOCUMENT_VERIFIED' },
    });

    expect(log.userId).toBe(officer.id);
    expect(log.oldValue).toEqual({ verificationStatus: 'PENDING' });
    expect(log.newValue).toEqual({ verificationStatus: 'VERIFIED' });
  });

  it('stops a citizen verifying their own document', async () => {
    const { citizen, document } = await uploadedDocument();

    const res = await verify(citizen, document.id, { action: 'APPROVE' });

    expect(res.status).toBe(403);

    const stored = await prisma.document.findUnique({ where: { id: document.id } });
    expect(stored.verificationStatus).toBe('PENDING');
  });

  it('stops a district officer deciding', async () => {
    const { document } = await uploadedDocument({ district: 'Ahmedabad' });
    const officer = await createDistrictOfficer({ district: 'Ahmedabad' });

    const res = await verify(officer, document.id, { action: 'APPROVE' });

    expect(res.status).toBe(403);
  });

  it('lets an admin decide', async () => {
    const { document } = await uploadedDocument();
    const admin = await createAdmin();

    const res = await verify(admin, document.id, { action: 'APPROVE' });

    expect(res.status).toBe(200);
  });
});

describe('GET /api/documents/:id/file', () => {
  it('serves the file to the owning citizen', async () => {
    const { citizen, document } = await uploadedDocument();

    const res = await request(app)
      .get(`/api/documents/${document.id}/file`)
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.toString()).toContain('%PDF');
  });

  it('suggests the original filename on download', async () => {
    const { citizen, document } = await uploadedDocument();

    const res = await request(app)
      .get(`/api/documents/${document.id}/file`)
      .set('Authorization', bearer(citizen));

    expect(res.headers['content-disposition']).toContain('proof.pdf');
  });

  it('serves the file to a verification officer', async () => {
    const { document } = await uploadedDocument();
    const officer = await createOfficer();

    const res = await request(app)
      .get(`/api/documents/${document.id}/file`)
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
  });

  it('refuses an unrelated citizen', async () => {
    const { document } = await uploadedDocument();
    const stranger = await createCitizen();

    const res = await request(app)
      .get(`/api/documents/${document.id}/file`)
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });

  it('refuses an anonymous request', async () => {
    const { document } = await uploadedDocument();

    const res = await request(app).get(`/api/documents/${document.id}/file`);

    // Documents must never be reachable without authentication.
    expect(res.status).toBe(401);
  });

  it('refuses a district officer from another district', async () => {
    const { document } = await uploadedDocument({ district: 'Ahmedabad' });
    const officer = await createDistrictOfficer({ district: 'Surat' });

    const res = await request(app)
      .get(`/api/documents/${document.id}/file`)
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(404);
  });

  it('does not expose the uploads directory statically', async () => {
    const { document } = await uploadedDocument();

    const res = await request(app).get(`/uploads/${document.filePath}`);

    expect(res.status).toBe(404);
  });

  it('reports a missing file rather than crashing', async () => {
    const { citizen, document } = await uploadedDocument();
    fs.unlinkSync(path.join(uploadDir(), document.filePath));

    const res = await request(app)
      .get(`/api/documents/${document.id}/file`)
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no longer available/i);
  });

  it('cannot be tricked into escaping the uploads directory', async () => {
    const { citizen, document } = await uploadedDocument();

    // Simulates a corrupted or tampered row.
    await prisma.document.update({
      where: { id: document.id },
      data: { filePath: '../../../../etc/passwd' },
    });

    const res = await request(app)
      .get(`/api/documents/${document.id}/file`)
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(404);
  });
});

describe('document listings', () => {
  it('lists documents for a member', async () => {
    const { citizen, family } = await uploadedDocument();

    const res = await request(app)
      .get(`/api/documents/member/${family.familyHeadId}`)
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(1);
  });

  it('lists documents across a family', async () => {
    const { citizen, family } = await uploadedDocument();

    const res = await request(app)
      .get(`/api/families/${family.id}/documents`)
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.data.familyId).toBe(family.familyId);
  });

  it('hides another family documents', async () => {
    const { family } = await uploadedDocument();
    const stranger = await createCitizen();

    const res = await request(app)
      .get(`/api/families/${family.id}/documents`)
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });
});

describe('GET /api/documents/pending', () => {
  it('lists documents awaiting a decision', async () => {
    await uploadedDocument();
    const officer = await createOfficer();

    const res = await request(app)
      .get('/api/documents/pending')
      .set('Authorization', bearer(officer));

    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.data.documents[0].member.family.familyId).toEqual(
      expect.any(String)
    );
  });

  it('drops a document from the queue once decided', async () => {
    const { document } = await uploadedDocument();
    const officer = await createOfficer();

    await verify(officer, document.id, { action: 'APPROVE' });

    const res = await request(app)
      .get('/api/documents/pending')
      .set('Authorization', bearer(officer));

    expect(res.body.data.documents).toHaveLength(0);
  });

  it('scopes a district officer to their district', async () => {
    await uploadedDocument({ district: 'Ahmedabad' });
    await uploadedDocument({ district: 'Surat' });
    const officer = await createDistrictOfficer({ district: 'Surat' });

    const res = await request(app)
      .get('/api/documents/pending')
      .set('Authorization', bearer(officer));

    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.data.documents[0].member.family.district).toBe('Surat');
  });

  it('forbids a citizen from reading the queue', async () => {
    const { citizen } = await uploadedDocument();

    const res = await request(app)
      .get('/api/documents/pending')
      .set('Authorization', bearer(citizen));

    expect(res.status).toBe(403);
  });
});
