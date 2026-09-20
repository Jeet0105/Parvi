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

### Tests

```bash
cd backend
npm test
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

## Build status

| Phase | Feature | Status |
| --- | --- | --- |
| 1 | Project init + health endpoint | Done |
| 2 | Database + Prisma schema | Done |
| 3 | Authentication | In progress |
| 4 | RBAC | Pending |
| 5 | Family registration + Family ID | Pending |
| 6 | Family members | Pending |
| 7 | Relationships | Pending |
| 8 | Family tree | Pending |
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
