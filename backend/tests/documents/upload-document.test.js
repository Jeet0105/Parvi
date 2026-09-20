const fs = require('node:fs');
const path = require('node:path');

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
const { uploadDir, maxUploadBytes } = require('../../src/config/upload');

/** Smallest bytes that still look like a real PDF / PNG to a reader. */
const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake test document\n');
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

/** Files written during a test, removed afterwards. */
const written = new Set();

function trackStoredFiles() {
  const dir = uploadDir();
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name !== '.gitkeep') written.add(path.join(dir, name));
  }
}

beforeEach(resetDatabase);

afterEach(() => {
  trackStoredFiles();
  for (const file of written) {
    try {
      fs.unlinkSync(file);
    } catch {
      // Already gone.
    }
  }
  written.clear();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

async function household() {
  const citizen = await createCitizen();
  const family = await registerFamily(citizen);
  return { citizen, family, memberId: family.familyHeadId };
}

function postDocument(user, fields, file = PDF_BYTES, filename = 'proof.pdf', contentType = 'application/pdf') {
  const req = request(app)
    .post('/api/documents')
    .set('Authorization', bearer(user));

  for (const [key, value] of Object.entries(fields)) {
    req.field(key, value);
  }
  if (file) req.attach('file', file, { filename, contentType });
  return req;
}

describe('POST /api/documents — happy path', () => {
  it('uploads a PDF against a member', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(citizen, {
      memberId,
      documentType: 'BIRTH_CERTIFICATE',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.document).toMatchObject({
      documentType: 'BIRTH_CERTIFICATE',
      verificationStatus: 'PENDING',
      originalName: 'proof.pdf',
      mimeType: 'application/pdf',
    });
    expect(res.body.data.document.sizeBytes).toBe(PDF_BYTES.length);
  });

  it('accepts a PNG image', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(
      citizen,
      { memberId, documentType: 'IDENTITY_PROOF' },
      PNG_BYTES,
      'card.png',
      'image/png'
    );

    expect(res.status).toBe(201);
  });

  it('writes the file to the uploads directory', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(citizen, {
      memberId,
      documentType: 'BIRTH_CERTIFICATE',
    });

    const stored = path.join(uploadDir(), res.body.data.document.filePath);
    expect(fs.existsSync(stored)).toBe(true);
  });

  it('stores only a reference in PostgreSQL, not the bytes', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(citizen, {
      memberId,
      documentType: 'BIRTH_CERTIFICATE',
    });

    const row = await prisma.document.findUnique({
      where: { id: res.body.data.document.id },
    });

    expect(row.filePath).toEqual(expect.any(String));
    expect(JSON.stringify(row)).not.toContain('%PDF');
  });

  it('never reuses the uploaded filename', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(
      citizen,
      { memberId, documentType: 'OTHER' },
      PDF_BYTES,
      'my document.pdf'
    );

    // The original is display metadata only; the stored name is generated.
    expect(res.body.data.document.originalName).toBe('my document.pdf');
    expect(res.body.data.document.filePath).not.toBe('my document.pdf');
    expect(res.body.data.document.filePath).toMatch(/^\d+-[0-9a-f]{24}\.pdf$/);
  });

  it('records an audit entry', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(citizen, {
      memberId,
      documentType: 'BIRTH_CERTIFICATE',
    });

    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'Document', entityId: res.body.data.document.id },
    });

    expect(log.action).toBe('DOCUMENT_UPLOADED');
    expect(log.userId).toBe(citizen.id);
  });

  it('links a document to a relationship when given one', async () => {
    const { citizen, family, memberId } = await household();
    const child = await addMember(citizen, family.id, {
      name: 'Riya Patel',
      dateOfBirth: '2012-03-08',
      gender: 'FEMALE',
    });

    const relationship = await request(app)
      .post('/api/relationships')
      .set('Authorization', bearer(citizen))
      .send({
        fromMemberId: memberId,
        toMemberId: child.id,
        relationshipType: 'FATHER',
      });

    const res = await postDocument(citizen, {
      memberId: child.id,
      documentType: 'BIRTH_CERTIFICATE',
      relationshipId: relationship.body.data.relationship.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.document.relationshipId).toBe(
      relationship.body.data.relationship.id
    );
  });
});

describe('POST /api/documents — file validation', () => {
  it('rejects an executable disguised by content type', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(
      citizen,
      { memberId, documentType: 'OTHER' },
      Buffer.from('MZ\x90\x00'),
      'payload.exe',
      'application/x-msdownload'
    );

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/unsupported file type/i);
    expect(await prisma.document.count()).toBe(0);
  });

  it('rejects a mismatch between content type and extension', async () => {
    const { citizen, memberId } = await household();

    // Claiming PDF while carrying a .exe extension must not slip through.
    const res = await postDocument(
      citizen,
      { memberId, documentType: 'OTHER' },
      Buffer.from('MZ'),
      'payload.exe',
      'application/pdf'
    );

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/extension does not match/i);
    expect(await prisma.document.count()).toBe(0);
  });

  it('rejects a file with no extension', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(
      citizen,
      { memberId, documentType: 'OTHER' },
      PDF_BYTES,
      'noextension',
      'application/pdf'
    );

    expect(res.status).toBe(422);
  });

  it('rejects an oversized file', async () => {
    const { citizen, memberId } = await household();
    const tooBig = Buffer.alloc(maxUploadBytes() + 1024, 0x41);
    tooBig.write('%PDF-1.4');

    const res = await postDocument(
      citizen,
      { memberId, documentType: 'OTHER' },
      tooBig,
      'huge.pdf'
    );

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too large/i);
    expect(await prisma.document.count()).toBe(0);
  });

  it('rejects a request with no file attached', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(
      citizen,
      { memberId, documentType: 'BIRTH_CERTIFICATE' },
      null
    );

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('file');
  });

  it('rejects an unknown document type', async () => {
    const { citizen, memberId } = await household();

    const res = await postDocument(citizen, {
      memberId,
      documentType: 'SELFIE',
    });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('documentType');
  });

  it('leaves no file behind when the request is rejected', async () => {
    const { citizen } = await household();
    const before = fs.existsSync(uploadDir())
      ? fs.readdirSync(uploadDir()).length
      : 0;

    await postDocument(citizen, {
      memberId: '00000000-0000-0000-0000-000000000000',
      documentType: 'BIRTH_CERTIFICATE',
    });

    const after = fs.existsSync(uploadDir())
      ? fs.readdirSync(uploadDir()).length
      : 0;
    // An orphaned file would accumulate silently forever.
    expect(after).toBe(before);
  });
});

describe('POST /api/documents — authorization', () => {
  it('rejects an unauthenticated upload', async () => {
    const { memberId } = await household();

    const res = await request(app)
      .post('/api/documents')
      .field('memberId', memberId)
      .field('documentType', 'BIRTH_CERTIFICATE')
      .attach('file', PDF_BYTES, { filename: 'proof.pdf' });

    expect(res.status).toBe(401);
    expect(await prisma.document.count()).toBe(0);
  });

  it('stops a citizen uploading against another family', async () => {
    const { memberId } = await household();
    const stranger = await createCitizen();

    const res = await postDocument(stranger, {
      memberId,
      documentType: 'BIRTH_CERTIFICATE',
    });

    expect(res.status).toBe(404);
    expect(await prisma.document.count()).toBe(0);
  });

  it('forbids an officer from uploading', async () => {
    const { memberId } = await household();
    const officer = await createOfficer();

    const res = await postDocument(officer, {
      memberId,
      documentType: 'BIRTH_CERTIFICATE',
    });

    expect(res.status).toBe(403);
  });

  it('forbids an admin from uploading', async () => {
    const { memberId } = await household();
    const admin = await createAdmin();

    const res = await postDocument(admin, {
      memberId,
      documentType: 'BIRTH_CERTIFICATE',
    });

    expect(res.status).toBe(403);
  });

  it('rejects a relationship belonging to a different family', async () => {
    const { citizen, memberId } = await household();
    const other = await createCitizen();
    const otherFamily = await registerFamily(other);
    const otherChild = await addMember(other, otherFamily.id, {
      name: 'Outsider Child',
      dateOfBirth: '2010-01-01',
      gender: 'MALE',
    });

    const foreign = await request(app)
      .post('/api/relationships')
      .set('Authorization', bearer(other))
      .send({
        fromMemberId: otherFamily.familyHeadId,
        toMemberId: otherChild.id,
        relationshipType: 'FATHER',
      });

    const res = await postDocument(citizen, {
      memberId,
      documentType: 'BIRTH_CERTIFICATE',
      relationshipId: foreign.body.data.relationship.id,
    });

    expect(res.status).toBe(404);
  });
});
