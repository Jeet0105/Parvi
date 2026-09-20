const { prisma, resetDatabase, disconnectDatabase } = require('../helpers/db');

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await disconnectDatabase();
});

describe('database connection', () => {
  it('connects to PostgreSQL', async () => {
    const result = await prisma.$queryRaw`SELECT 1 AS ok`;
    expect(result[0].ok).toBe(1);
  });

  it('runs against the test database, not the development one', async () => {
    const [{ current_database: dbName }] =
      await prisma.$queryRaw`SELECT current_database()`;
    expect(dbName).toMatch(/_test$/);
  });
});

describe('migration state', () => {
  const expectedTables = [
    'User',
    'Family',
    'FamilyMember',
    'Relationship',
    'Document',
    'Scheme',
    'BeneficiaryApplication',
    'DuplicateReview',
    'AuditLog',
  ];

  it('created every model table', async () => {
    const rows = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const tables = rows.map((r) => r.table_name);

    for (const table of expectedTables) {
      expect(tables).toContain(table);
    }
  });

  it('records the applied migration', async () => {
    const rows = await prisma.$queryRaw`
      SELECT migration_name, finished_at FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
    `;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.migration_name.endsWith('_init'))).toBe(true);
  });

  it('enforces the unique constraint on Family.familyId', async () => {
    const rows = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes WHERE tablename = 'Family'
    `;
    const names = rows.map((r) => r.indexname).join(' ');
    expect(names).toMatch(/familyId/);
  });
});

describe('basic CRUD', () => {
  it('creates, reads, updates and deletes a user', async () => {
    const created = await prisma.user.create({
      data: {
        name: 'Rahul Patel',
        email: 'rahul@example.com',
        mobile: '9999900001',
        passwordHash: 'not-a-real-hash',
      },
    });
    expect(created.id).toEqual(expect.any(String));
    expect(created.role).toBe('CITIZEN'); // enum default applied
    expect(created.createdAt).toBeInstanceOf(Date);

    const found = await prisma.user.findUnique({ where: { id: created.id } });
    expect(found.email).toBe('rahul@example.com');

    const updated = await prisma.user.update({
      where: { id: created.id },
      data: { role: 'VERIFICATION_OFFICER' },
    });
    expect(updated.role).toBe('VERIFICATION_OFFICER');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.updatedAt.getTime()
    );

    await prisma.user.delete({ where: { id: created.id } });
    expect(await prisma.user.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it('rejects a duplicate email', async () => {
    const data = {
      name: 'A',
      email: 'dup@example.com',
      mobile: '9999900002',
      passwordHash: 'x',
    };
    await prisma.user.create({ data });

    await expect(
      prisma.user.create({ data: { ...data, mobile: '9999900003' } })
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a duplicate mobile', async () => {
    const data = {
      name: 'A',
      email: 'a@example.com',
      mobile: '9999900004',
      passwordHash: 'x',
    };
    await prisma.user.create({ data });

    await expect(
      prisma.user.create({ data: { ...data, email: 'b@example.com' } })
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('relational integrity', () => {
  async function createFamilyWithMember() {
    const owner = await prisma.user.create({
      data: {
        name: 'Owner',
        email: 'owner@example.com',
        mobile: '9999911111',
        passwordHash: 'x',
      },
    });

    const family = await prisma.family.create({
      data: {
        familyId: 'GJ-FAM-TEST0001',
        ownerId: owner.id,
        district: 'Ahmedabad',
        taluka: 'Daskroi',
        village: 'Example Village',
        address: 'Example Address',
      },
    });

    const member = await prisma.familyMember.create({
      data: {
        familyId: family.id,
        name: 'Rahul Patel',
        dateOfBirth: new Date('1985-04-12'),
        gender: 'MALE',
      },
    });

    return { owner, family, member };
  }

  it('links a family to its owner and head member', async () => {
    const { family, member } = await createFamilyWithMember();

    const withHead = await prisma.family.update({
      where: { id: family.id },
      data: { familyHeadId: member.id },
      include: { familyHead: true, members: true, owner: true },
    });

    expect(withHead.familyHead.name).toBe('Rahul Patel');
    expect(withHead.members).toHaveLength(1);
    expect(withHead.owner.email).toBe('owner@example.com');
    expect(withHead.status).toBe('DRAFT');
  });

  it('rejects a family whose owner does not exist', async () => {
    await expect(
      prisma.family.create({
        data: {
          familyId: 'GJ-FAM-TEST0002',
          ownerId: '00000000-0000-0000-0000-000000000000',
          district: 'D',
          taluka: 'T',
          village: 'V',
          address: 'A',
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects a duplicate familyId', async () => {
    const { owner } = await createFamilyWithMember();

    await expect(
      prisma.family.create({
        data: {
          familyId: 'GJ-FAM-TEST0001',
          ownerId: owner.id,
          district: 'D',
          taluka: 'T',
          village: 'V',
          address: 'A',
        },
      })
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('cascades member deletion when a family is removed', async () => {
    const { family, member } = await createFamilyWithMember();

    await prisma.family.delete({ where: { id: family.id } });

    expect(
      await prisma.familyMember.findUnique({ where: { id: member.id } })
    ).toBeNull();
  });

  it('enforces one directed relationship per type', async () => {
    const { family, member } = await createFamilyWithMember();
    const second = await prisma.familyMember.create({
      data: {
        familyId: family.id,
        name: 'Priya Patel',
        dateOfBirth: new Date('1988-05-12'),
        gender: 'FEMALE',
      },
    });

    const data = {
      familyId: family.id,
      fromMemberId: member.id,
      toMemberId: second.id,
      relationshipType: 'SPOUSE',
    };
    await prisma.relationship.create({ data });

    await expect(prisma.relationship.create({ data })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('stores JSON columns on scheme and audit records', async () => {
    const scheme = await prisma.scheme.create({
      data: {
        name: 'Education Support',
        description: 'Support for students under 25',
        eligibilityRule: { maxAge: 25, isStudent: true },
      },
    });
    expect(scheme.eligibilityRule).toEqual({ maxAge: 25, isStudent: true });
    expect(scheme.status).toBe('ACTIVE');

    const log = await prisma.auditLog.create({
      data: {
        action: 'SCHEME_CREATED',
        entityType: 'Scheme',
        entityId: scheme.id,
        oldValue: null,
        newValue: { name: scheme.name },
      },
    });
    expect(log.newValue).toEqual({ name: 'Education Support' });
    expect(log.userId).toBeNull(); // system-generated events carry no actor
  });

  it('keeps decimal precision on family income', async () => {
    const { family } = await createFamilyWithMember();

    const updated = await prisma.family.update({
      where: { id: family.id },
      data: { annualIncome: '125000.50' },
    });

    expect(updated.annualIncome.toString()).toBe('125000.5');
  });
});
