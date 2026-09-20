# Technical decisions

Running log of non-obvious choices made while building the MVP, and why.

## Local PostgreSQL runs in Docker, not the host install

The machine already has PostgreSQL 17 installed and running on port 5432, but its
superuser password was not available. Rather than guess at credentials, the project
ships a `docker-compose.yml` that runs `postgres:17-alpine` on **host port 5433**.

- The host's own PostgreSQL is left completely untouched.
- Credentials live in the repo-root `.env` (gitignored); `.env.example` documents the shape.
- `database/init/01-create-test-db.sh` creates `family_identity_test` alongside
  `family_identity` on first boot, so tests never share a database with development.

```bash
docker compose up -d
```

## Prisma CLI is pinned to 7.10.0

At the time of setup, npm's `latest` dist-tag for the `prisma` package pointed at
`8.0.0-rc.15` — a **release candidate**. `@prisma/client` resolved to stable `7.10.0`.
The CLI is pinned to `7.10.0` so the CLI and client stay on the same stable major.

Do not run `npm i prisma@latest` until 8.x is stable.

## Generator is `prisma-client-js`, not `prisma-client`

Prisma 7 makes `prisma-client` the default generator, but it emits **TypeScript**
source into the output directory. This project is JavaScript-only, so it would have
forced a TypeScript build step purely to consume the ORM.

The legacy `prisma-client-js` generator is still supported in v7 and emits JavaScript
plus `.d.ts` files (which give editor autocomplete without a build step). Output goes
to `src/generated/prisma`, which v7 requires to be explicit.

## A driver adapter is required

Prisma 7 requires an explicit driver adapter for SQL providers, so `@prisma/adapter-pg`
and `pg` are runtime dependencies and the connection string is resolved in
`src/config/database.js` rather than in `schema.prisma`.

This is also what lets tests swap to `TEST_DATABASE_URL` cleanly: `database.js` picks
the URL based on `NODE_ENV`.

## Prisma config is `prisma7.config.js`, not `.ts`

`prisma init` scaffolds `prisma7.config.ts`. It was rewritten as CommonJS JavaScript to
respect the JavaScript-only rule. It resolves `TEST_DATABASE_URL` when `NODE_ENV=test`
so `prisma migrate deploy` can target the test database.

## Known npm audit findings (dev-only)

`npm audit` reports 4 high-severity advisories, all reached through the **`prisma` CLI**,
which is a `devDependency`:

- `deepmerge-ts` (< 8.0.0) — stack exhaustion, via `@prisma/config`
- `mysql2` (<= 3.23.0) — credential leak / decompression DoS

`npm audit fix --force` would downgrade the CLI to `prisma@6.19.3`, mismatching
`@prisma/client@7.10.0`, so it has not been applied. Neither package ships in the
runtime dependency tree, and `mysql2` is a MySQL driver this project never loads —
it is pulled in because the CLI bundles every database driver.

Revisit when Prisma 8 goes stable.

## Schema additions beyond the brief

The source documents list the core entities. These fields were added because a
required feature could not work without them:

| Addition | Needed by |
| --- | --- |
| `DuplicateReview` model | Phase 11 — officer review of flagged duplicates |
| `Family.ownerId` | Ownership checks; `familyHeadId` points at a member, which can change |
| `FamilyMember.fatherName` / `motherName` / `spouseName` | Duplicate detection compares parent and spouse names |
| `FamilyMember.isStudent` | Education Support eligibility rule |
| `Family.annualIncome` / `ownsHouse` | Housing Support eligibility rule |
| `Document.mimeType` / `sizeBytes` / `originalName` | Upload validation and safe download |
| `Document.relationshipId` | Relationship evidence documents |
| `User.district` | Scoping a DISTRICT_OFFICER to their district |
| `verifiedAt` / `verifiedById` / `rejectionReason` | Officer verification workflow and audit trail |
