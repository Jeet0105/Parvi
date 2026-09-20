# Family Identity & Beneficiary Management Platform

## MVP Implementation Roadmap

This document provides the step-by-step implementation path for building the Family Identity & Beneficiary Management Platform MVP.

The recommended MVP architecture is a **modular monolithic Node.js application** with React on the frontend and PostgreSQL as the primary database.

---

# 1. Final MVP Technology Stack

## Frontend

- React.js
- TypeScript
- Tailwind CSS
- React Flow
- Axios
- React Router

## Backend

- Node.js
- Express.js
- TypeScript
- Zod
- JWT
- bcrypt

## Database

- PostgreSQL
- Prisma ORM

## Caching and Background Processing

- Redis
- BullMQ — optional for MVP

## Document Storage

- Local file storage during development
- S3-compatible storage for deployment

## Duplicate Detection

- Node.js-based similarity matching
- RapidFuzz or equivalent string-similarity approach

## Development and Deployment

- Git
- GitHub
- VS Code
- Postman
- Swagger / OpenAPI
- Docker

---

# 2. Overall Product Flow

```text
Authentication
      ↓
User / Roles
      ↓
Family Registration
      ↓
Family ID Generation
      ↓
Family Members
      ↓
Relationships
      ↓
Family Tree
      ↓
Documents
      ↓
Verification
      ↓
Duplicate Detection
      ↓
Government Schemes
      ↓
Beneficiary Management
      ↓
Officer Dashboard
      ↓
Audit Trail
      ↓
Security + Testing
```

---

# 3. Project Structure

```text
family-identity-platform/
│
├── frontend/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   └── redis.ts
│   │   │
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── family.controller.ts
│   │   │   ├── member.controller.ts
│   │   │   ├── relationship.controller.ts
│   │   │   ├── document.controller.ts
│   │   │   ├── verification.controller.ts
│   │   │   ├── duplicate.controller.ts
│   │   │   ├── scheme.controller.ts
│   │   │   └── beneficiary.controller.ts
│   │   │
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── family.service.ts
│   │   │   ├── member.service.ts
│   │   │   ├── relationship.service.ts
│   │   │   ├── document.service.ts
│   │   │   ├── verification.service.ts
│   │   │   ├── duplicate.service.ts
│   │   │   └── beneficiary.service.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── family.routes.ts
│   │   │   ├── member.routes.ts
│   │   │   ├── relationship.routes.ts
│   │   │   ├── document.routes.ts
│   │   │   ├── verification.routes.ts
│   │   │   ├── duplicate.routes.ts
│   │   │   └── scheme.routes.ts
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── role.middleware.ts
│   │   │   └── error.middleware.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── jwt.ts
│   │   │   ├── familyId.ts
│   │   │   └── similarity.ts
│   │   │
│   │   ├── app.ts
│   │   └── server.ts
│   │
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   ├── uploads/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
│
├── database/
├── docs/
└── README.md
```

Do not create every file at once. Add files as the corresponding module is implemented.

---

# 4. Phase 0 — Project Setup

## Step 1: Create Repository

```bash
mkdir family-identity-platform
cd family-identity-platform

mkdir frontend
mkdir backend
mkdir database
mkdir docs
```

Initialize Git:

```bash
git init
git branch -M main
```

Create the GitHub repository and connect the local repository.

---

# 5. Phase 1 — Backend Setup

## Step 2: Initialize Node.js

```bash
cd backend
npm init -y
```

Install runtime dependencies:

```bash
npm install express cors dotenv helmet
npm install jsonwebtoken bcrypt
npm install zod
npm install @prisma/client
npm install multer
npm install redis bullmq
```

Install development dependencies:

```bash
npm install -D typescript ts-node-dev
npm install -D prisma
npm install -D @types/node
npm install -D @types/express
npm install -D @types/cors
npm install -D @types/jsonwebtoken
npm install -D @types/bcrypt
npm install -D @types/multer
```

Initialize TypeScript:

```bash
npx tsc --init
```

Initialize Prisma:

```bash
npx prisma init
```

---

# 6. Phase 2 — Database Design

The database is one of the most important parts of the system.

## Core Entity Relationship

```text
User
  │
  ├── Family
  │
  └── AuditLog

Family
  │
  ├── FamilyMember
  │       │
  │       └── Document
  │
  ├── Relationship
  │
  └── BeneficiaryApplication
              │
              └── Scheme
```

## Main Tables

### User

```text
User
----
id
name
email
mobile
passwordHash
role
createdAt
updatedAt
```

Roles:

```text
CITIZEN
VERIFICATION_OFFICER
DISTRICT_OFFICER
ADMIN
```

### Family

```text
Family
------
id
familyId
familyHeadId
district
taluka
village
address
status
createdAt
updatedAt
```

### FamilyMember

```text
FamilyMember
------------
id
familyId
userId
name
dateOfBirth
gender
status
verificationStatus
createdAt
updatedAt
```

### Relationship

```text
Relationship
------------
id
familyId
fromMemberId
toMemberId
relationshipType
verificationStatus
createdAt
updatedAt
```

### Document

```text
Document
--------
id
memberId
documentType
filePath
verificationStatus
uploadedAt
verifiedAt
```

### Scheme

```text
Scheme
------
id
name
description
eligibilityRule
status
createdAt
```

### BeneficiaryApplication

```text
BeneficiaryApplication
----------------------
id
familyId
memberId
schemeId
status
appliedAt
updatedAt
```

### AuditLog

```text
AuditLog
--------
id
userId
action
entityType
entityId
oldValue
newValue
createdAt
```

---

# 7. Phase 3 — Authentication

Build authentication before family registration.

## Step 3: Registration

Endpoint:

```http
POST /api/auth/register
```

Example request:

```json
{
  "name": "Rahul Patel",
  "email": "rahul@example.com",
  "mobile": "9999999999",
  "password": "password"
}
```

Flow:

```text
Request
   ↓
Zod Validation
   ↓
Check Existing User
   ↓
Hash Password with bcrypt
   ↓
Save to PostgreSQL
   ↓
Return JWT
```

## Step 4: Login

Endpoint:

```http
POST /api/auth/login
```

Flow:

```text
Email + Password
       ↓
Find User
       ↓
bcrypt.compare()
       ↓
Generate JWT
       ↓
Return Token
```

---

# 8. Phase 4 — Role-Based Access Control

Create authentication and authorization middleware:

```text
authenticate()
authorize()
```

Access model:

```text
Citizen
   ↓
Can access own family

Verification Officer
   ↓
Can verify families and documents

District Officer
   ↓
Can access district-level records

Administrator
   ↓
Can manage system configuration
```

Example:

```typescript
router.put(
    "/:id/verify",
    authenticate,
    authorize("VERIFICATION_OFFICER"),
    verifyFamily
);
```

---

# 9. Phase 5 — Family Registration

This is the first major business feature.

## Step 5: Create Family

Endpoint:

```http
POST /api/families
```

Example:

```json
{
  "district": "Ahmedabad",
  "taluka": "Daskroi",
  "village": "Example Village",
  "address": "Example Address"
}
```

Flow:

```text
Citizen
   ↓
Create Family
   ↓
Generate Family ID
   ↓
Set Citizen as Family Head
   ↓
Save Family
```

---

# 10. Phase 6 — Family ID Generation

Create:

```text
backend/src/utils/familyId.ts
```

Example Family ID:

```text
GJ-FAM-8A72K91X
```

The Family ID should:

- Be unique.
- Not contain Aadhaar or other sensitive personal information.
- Remain stable during the family lifecycle.
- Be independent of the family's current address.

---

# 11. Phase 7 — Family Member Management

## Step 6: Add Member

Endpoint:

```http
POST /api/families/:familyId/members
```

Example:

```json
{
  "name": "Priya Patel",
  "dateOfBirth": "1998-05-12",
  "gender": "FEMALE"
}
```

Flow:

```text
Family
  ↓
Validate Family ID
  ↓
Create Member
  ↓
Member Status = PENDING
  ↓
Save
```

## Step 7: Member Operations

```http
GET /api/families/:id/members
PUT /api/members/:id
```

Recommended member statuses:

```text
ACTIVE
INACTIVE
DECEASED
MIGRATED
SEPARATED
```

Important records should generally be retained rather than physically deleted.

---

# 12. Phase 8 — Relationship Management

## Step 8: Create Relationship

Endpoint:

```http
POST /api/relationships
```

Example:

```json
{
  "familyId": "GJ-FAM-8A72K91X",
  "fromMemberId": "M001",
  "toMemberId": "M002",
  "relationshipType": "SON"
}
```

Initial status:

```text
PENDING
```

## Step 9: Relationship Verification

Officer sees:

```text
Rahul → Vivek
Relationship → Son

Document → Birth Certificate

Status → PENDING
```

Officer actions:

```text
APPROVE
REJECT
REQUEST_DOCUMENT
```

---

# 13. Phase 9 — Family Tree

This is one of the most visually important features.

## Backend Endpoint

```http
GET /api/families/:id/tree
```

Example response:

```json
{
  "nodes": [
    {
      "id": "1",
      "name": "Vivek"
    },
    {
      "id": "2",
      "name": "Priya"
    }
  ],
  "relationships": [
    {
      "source": "1",
      "target": "2",
      "type": "SPOUSE"
    }
  ]
}
```

React Flow converts the response into nodes and edges.

Example:

```text
        Vivek
          │
        Spouse
          │
        Priya
```

Extended example:

```text
              Vivek ───── Priya
                 │
          ┌──────┴──────┐
          │             │
        Rahul          Riya
```

---

# 14. Phase 10 — Document Management

## Step 10: Upload Document

Frontend:

```text
Select File
     ↓
Upload
     ↓
POST /api/documents
```

Use Multer on the backend.

Flow:

```text
Request
   ↓
Multer
   ↓
Validate File Type
   ↓
Validate File Size
   ↓
Store File
   ↓
Save Metadata in PostgreSQL
```

For development, local storage is sufficient.

For deployment, use S3-compatible object storage.

Do not store large documents directly inside PostgreSQL unless there is a specific requirement.

---

# 15. Phase 11 — Officer Verification Dashboard

Create an officer dashboard.

Example:

```text
+--------------------------------------+
|       VERIFICATION DASHBOARD         |
+--------------------------------------+
| Pending Families             124     |
| Pending Relationships        87      |
| Pending Documents            52      |
| Duplicate Alerts             13      |
+--------------------------------------+
```

Endpoint:

```http
GET /api/dashboard/statistics
```

The dashboard should provide access to:

- Pending family registrations.
- Pending relationships.
- Pending documents.
- Duplicate alerts.
- Beneficiary applications.
- Verification history.

---

# 16. Phase 12 — Duplicate Detection

This is the main intelligent feature of the MVP.

When a new member is registered:

```text
New Member
    ↓
Search Existing Records
    ↓
Calculate Similarity
    ↓
Generate Match Score
```

Example:

```text
Name                  90%
Date of Birth        100%
Father Name           94%
Address               85%
--------------------------
Potential Match       92%
```

If similarity is high:

```text
DUPLICATE_REVIEW
```

Officer decides:

```text
Same Person
      OR
Different Person
```

The system should **not automatically merge records** based only on similarity.

---

# 17. Phase 13 — Government Schemes

Create a small set of sample schemes for the MVP.

Examples:

```text
Housing Assistance
Education Support
Health Assistance
Senior Citizen Support
```

Endpoint:

```http
GET /api/schemes
```

Each scheme contains:

```text
Scheme
   ├── Name
   ├── Description
   ├── Eligibility Rule
   └── Status
```

---

# 18. Phase 14 — Eligibility Engine

For the MVP, use simple rule-based eligibility rather than complex AI.

Example:

```text
IF age < 25
AND student = true

→ Education Support
```

Another example:

```text
IF familyIncome < threshold
AND ownsHouse = false

→ Housing Support
```

Flow:

```text
Family
   ↓
Eligibility Engine
   ↓
Eligible Schemes
```

---

# 19. Phase 15 — Beneficiary Management

Citizen flow:

```text
Family
  ↓
Available Schemes
  ↓
Apply
```

Endpoint:

```http
POST /api/schemes/:id/apply
```

Application lifecycle:

```text
APPLIED
   ↓
UNDER_REVIEW
   ↓
APPROVED
```

Alternative:

```text
UNDER_REVIEW
      ↓
   REJECTED
```

Officers can update the application status.

---

# 20. Phase 16 — Audit Trail

Every important operation should generate an audit record.

Example:

```text
Officer: OFF-102
Action: RELATIONSHIP_VERIFIED

Entity:
Relationship #R1023

Old:
PENDING

New:
VERIFIED

Time:
20-09-2026 14:35
```

Important audit events:

- Family creation.
- Family modification.
- Member addition.
- Relationship verification.
- Document verification.
- Beneficiary application.
- Scheme status changes.
- Administrative actions.

---

# 21. Phase 17 — Redis

Implement Redis only after the core application works.

Possible uses:

```text
Rate Limiting
      +
Dashboard Cache
      +
Temporary Data
```

Redis should not replace PostgreSQL as the primary database.

---

# 22. Phase 18 — BullMQ

BullMQ is optional for the MVP.

If asynchronous processing is required:

```text
Citizen uploads document
          ↓
API
          ↓
Create Job
          ↓
Redis / BullMQ
          ↓
Worker
          ↓
Process Document
          ↓
Update PostgreSQL
```

Possible jobs:

- Duplicate detection.
- Document processing.
- Notifications.
- Report generation.

---

# 23. Phase 19 — Security

Implement the following before deployment.

## Backend Security

```text
Helmet
CORS
Rate Limiting
JWT
RBAC
Zod Validation
bcrypt
```

## Database Security

Use Prisma's parameterized queries and avoid constructing raw SQL from untrusted input.

## File Security

Validate:

```text
File extension
MIME type
File size
```

Documents should only be accessible through authorized endpoints.

---

# 24. Phase 20 — Testing

## Authentication

Test:

```text
Register
Login
Invalid Password
Expired JWT
Unauthorized Endpoint
```

## Family

Test:

```text
Create Family
Get Family
Update Family
Invalid Family ID
```

## Members

Test:

```text
Add Member
Update Member
Invalid Family
```

## Relationships

Test:

```text
Create Relationship
Approve
Reject
```

## Duplicate Detection

Test:

```text
Same Person
Similar Person
Completely Different Person
```

## Schemes

Test:

```text
Eligible
Not Eligible
Application
Approval
Rejection
```

---

# 25. Phase 21 — Swagger

Expose API documentation at:

```text
/swagger
```

Document:

```text
/auth
/families
/members
/relationships
/documents
/verification
/duplicates
/schemes
/beneficiaries
```

---

# 26. Phase 22 — Docker

Create:

```text
docker-compose.yml
```

Services:

```text
frontend
backend
postgres
redis
```

Architecture:

```text
                    Docker
                      │
       ┌──────────────┼──────────────┐
       │              │              │
       ▼              ▼              ▼
   Frontend        Backend       PostgreSQL
   React           Node.js
                      │
                      ▼
                    Redis
```

---

# 27. Final Demo Flow

The complete hackathon demonstration should follow this sequence:

```text
                 CITIZEN
                    │
                    ▼
              Register/Login
                    │
                    ▼
             Create Family
                    │
                    ▼
             Generate Family ID
                    │
                    ▼
            Add Family Members
                    │
                    ▼
          Define Relationships
                    │
                    ▼
            Upload Documents
                    │
                    ▼
             Submit Verification
                    │
                    ▼
              OFFICER PORTAL
                    │
          ┌─────────┼──────────┐
          ▼         ▼          ▼
      Verify      Duplicate   Review
     Documents    Detection   Family
          │         │          │
          └─────────┼──────────┘
                    ▼
             FAMILY VERIFIED
                    │
                    ▼
              Family Tree
                    │
                    ▼
            Eligibility Engine
                    │
                    ▼
           Available Schemes
                    │
                    ▼
             Apply for Scheme
                    │
                    ▼
            Beneficiary Status
                    │
                    ▼
                Audit Log
```

---

# 28. Recommended Sprint Plan

## Sprint 1 — Foundation

```text
Day 1
├── Git/GitHub
├── React setup
├── Node.js setup
├── PostgreSQL
├── Prisma
└── Basic API
```

## Sprint 2 — Authentication

```text
Day 2
├── Register
├── Login
├── JWT
├── RBAC
└── Protected routes
```

## Sprint 3 — Family

```text
Day 3
├── Create Family
├── Family ID
├── Family Head
├── Family Profile
└── Family APIs
```

## Sprint 4 — Members

```text
Day 4
├── Add Member
├── Update Member
├── Member Status
└── Member APIs
```

## Sprint 5 — Relationships

```text
Day 5
├── Add Relationship
├── Relationship Types
├── Verification Status
└── Officer Approval
```

## Sprint 6 — Family Tree

```text
Day 6
├── React Flow
├── Nodes
├── Edges
├── Parent/Child
└── Spouse relationships
```

## Sprint 7 — Documents

```text
Day 7
├── Multer
├── Upload
├── Document Metadata
├── Officer Review
└── Approve/Reject
```

## Sprint 8 — Officer Dashboard

```text
Day 8
├── Pending Requests
├── Family Verification
├── Document Verification
├── Relationship Verification
└── Statistics
```

## Sprint 9 — Duplicate Detection

```text
Day 9
├── Search Existing Members
├── Name Similarity
├── DOB Matching
├── Address Similarity
└── Duplicate Review
```

## Sprint 10 — Schemes

```text
Day 10
├── Scheme CRUD
├── Eligibility Rules
├── Eligible Schemes
├── Apply
└── Application Status
```

## Sprint 11 — Audit + Redis

```text
Day 11
├── Audit Logs
├── Redis
├── Rate Limiting
└── Dashboard Caching
```

## Sprint 12 — Polish

```text
Day 12
├── Error Handling
├── Loading States
├── Form Validation
├── Security
├── Swagger
└── UI Polish
```

## Sprint 13 — Deployment

```text
Day 13
├── Docker
├── PostgreSQL
├── Redis
├── Backend Deployment
└── Frontend Deployment
```

## Sprint 14 — Demo Preparation

```text
Day 14
├── Seed Realistic Data
├── Test Complete Workflow
├── Prepare Presentation
├── Prepare Architecture Diagram
└── Prepare Judge Questions
```

---

# 29. If Only 2–3 Days Are Available

Prioritize exactly this order:

```text
1. Login / RBAC
       ↓
2. Family Registration
       ↓
3. Family ID
       ↓
4. Add Members
       ↓
5. Relationships
       ↓
6. Family Tree
       ↓
7. Officer Verification
       ↓
8. Duplicate Detection
       ↓
9. Schemes
       ↓
10. Beneficiary Dashboard
```

Leave Redis, BullMQ, advanced AI, advanced analytics, and complex deployment until the core workflow is working.

---

# 30. MVP Definition of Done

The MVP is considered complete when a user can:

- Register and log in.
- Create a family.
- Receive a unique Family ID.
- Add family members.
- Define relationships.
- View the family tree.
- Upload supporting documents.
- Submit the family for verification.
- Allow an officer to verify the family.
- Detect potential duplicate members/families.
- Review duplicate alerts.
- View applicable schemes.
- Apply for a scheme.
- Track beneficiary application status.
- View the complete audit history.

The most important development principle is:

> **Build one complete vertical flow first.**

The first working flow should be:

```text
Citizen
   ↓
Create Family
   ↓
Add Members
   ↓
Create Relationships
   ↓
Upload Documents
   ↓
Officer Verification
   ↓
Verified Family
   ↓
Family 360 Dashboard
```

Once this flow works end-to-end, add duplicate detection, schemes, beneficiaries, Redis, and other advanced features.
