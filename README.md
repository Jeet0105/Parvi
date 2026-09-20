# Family Identity & Beneficiary Management Platform

A government digital platform that gives each verified family a stable, non-sensitive
**Family ID**, maintains verified family relationships, and connects eligible members to
government welfare schemes.

Hackathon MVP. Built as a **modular monolith**: React frontend, Express REST API,
PostgreSQL via Prisma.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, JavaScript, Tailwind CSS, React Router, Axios, React Flow |
| Backend | Node.js, Express.js, JavaScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + bcrypt, role-based access control |
| Validation | Zod |
| Uploads | Multer (local disk in dev, S3-compatible in deployment) |
| Tests | Jest + Supertest |

JavaScript only — no TypeScript.

## Repository layout

```
family-identity-platform/
├── backend/
│   ├── src/
│   │   ├── config/        database + redis connections
│   │   ├── controllers/   thin HTTP layer
│   │   ├── services/      business logic
│   │   ├── routes/        express routers
│   │   ├── middleware/    auth, roles, validation, errors
│   │   ├── validators/    zod schemas
│   │   ├── utils/         jwt, familyId, similarity helpers
│   │   ├── jobs/          background jobs (optional)
│   │   ├── app.js
│   │   └── server.js
│   ├── prisma/schema.prisma
│   ├── tests/
│   └── uploads/
├── frontend/
└── docs/
```

## Getting started

### Prerequisites

- Node.js 20+
- Docker (for the local PostgreSQL container)

### Database

PostgreSQL runs in Docker on port **5433**, so it does not collide with any
PostgreSQL already installed on the host.

```bash
cp .env.example .env      # set POSTGRES_PASSWORD
docker compose up -d
```

This creates both `family_identity` and `family_identity_test`.

### Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in DATABASE_URL and JWT_SECRET
npm run dev
```

Apply migrations:

```bash
npm run db:migrate
```

The API listens on `http://localhost:5000`.

Health check:

```bash
curl http://localhost:5000/api/health
```

```json
{ "success": true, "message": "Family Identity Platform API is running" }
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` and proxies `/api` to the backend,
so there is no CORS setup in development.

### Tests

```bash
cd backend  && npm test   # jest + supertest
cd frontend && npm test   # vitest + react testing library
```

## API response format

Every endpoint returns a consistent envelope.

Success:

```json
{ "success": true, "message": "...", "data": {} }
```

Error:

```json
{ "success": false, "message": "...", "errors": [] }
```

## Roles

`CITIZEN`, `VERIFICATION_OFFICER`, `DISTRICT_OFFICER`, `ADMIN`.

Authorization is always enforced on the backend; frontend role checks are presentation only.

Citizens self-register. Government accounts cannot be created through the public API
by design, so seed them:

```bash
cd backend
npm run db:seed
```

| Account | Email | Role |
| --- | --- | --- |
| Verification Officer | officer@example.gov | VERIFICATION_OFFICER |
| District Officer | district@example.gov | DISTRICT_OFFICER |
| Administrator | admin@example.gov | ADMIN |

All seeded accounts use the password `Password123`. Development only — the seed
script refuses to run when NODE_ENV is production.

## API endpoints

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/health` | Public |
| POST | `/api/auth/register` | Public (always creates a CITIZEN) |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Any authenticated user |
| GET | `/api/users` | ADMIN |
| GET | `/api/users/:id` | ADMIN |
| PUT | `/api/users/:id/role` | ADMIN |
| POST | `/api/families` | CITIZEN (one family each) |
| GET | `/api/families` | Officers (district-scoped) |
| GET | `/api/families/mine` | CITIZEN |
| GET | `/api/families/:id` | Owner or permitted officer |
| PUT | `/api/families/:id` | Owning citizen, unless VERIFIED |
| PUT | `/api/families/:familyId/head` | Owning citizen |
| POST | `/api/families/:familyId/members` | Owning citizen |
| GET | `/api/families/:familyId/members` | Owner or permitted officer |
| GET | `/api/members/:id` | Owner or permitted officer |
| PUT | `/api/members/:id` | Owning citizen |
| POST | `/api/relationships` | Owning citizen |
| GET | `/api/relationships/pending` | Officers (district-scoped) |
| GET | `/api/relationships/:id` | Owner or permitted officer |
| PUT | `/api/relationships/:id/verify` | VERIFICATION_OFFICER, ADMIN |
| GET | `/api/families/:familyId/relationships` | Owner or permitted officer |

## Build status

| Phase | Feature | Status |
| --- | --- | --- |
| 1 | Project init + health endpoint | Done |
| 2 | Database + Prisma schema | Done |
| 3 | Authentication | Done |
| 4 | RBAC + admin user management | Done |
| 5 | Family registration + Family ID | Done |
| 6 | Family members | Done |
| 7 | Relationships + officer verification | Done |
| 8 | Family tree | In progress |
| 9 | Documents | Pending |
| 10 | Officer verification | Pending |
| 11 | Duplicate detection | Pending |
| 12 | Government schemes | Pending |
| 13 | Eligibility engine | Pending |
| 14 | Beneficiary applications | Pending |
| 15 | Audit log | Pending |
| 16 | Family 360 dashboard | Pending |
| 17 | Officer dashboard | Pending |

## Privacy

This is a prototype. Only synthetic/dummy identity data is used. Family IDs never
contain Aadhaar or any other sensitive identity number.
