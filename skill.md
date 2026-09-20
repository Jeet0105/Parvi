---
name: family-identity-platform
description: Build and maintain the Family Identity & Beneficiary Management Platform MVP. Use this skill whenever implementing, modifying, debugging, testing, or documenting this project.
---

# Family Identity & Beneficiary Management Platform

## 1. Project Goal

Build a hackathon-ready **Family Identity & Beneficiary Management Platform**.

The platform should allow citizens and government officers to:

- Register a family.
- Generate a unique Family ID.
- Designate a Family Head.
- Add and manage family members.
- Define and verify relationships.
- Upload supporting documents.
- Build and visualize a family tree.
- Detect potential duplicate family/member records.
- Allow government officers to verify submitted information.
- Manage government schemes.
- Determine basic scheme eligibility.
- Manage beneficiary applications.
- Maintain an audit trail.
- Provide a Family 360 dashboard.

The project is an MVP. Prefer a working, understandable implementation over unnecessary enterprise complexity.

---

# 2. Non-Negotiable Architecture Decisions

## Backend

Use:

- Node.js
- Express.js
- JavaScript
- Prisma ORM

Do NOT use:

- TypeScript
- Python
- FastAPI
- Laravel

All backend source files must use `.js`.

Example:

```text
src/
├── app.js
├── server.js
├── config/
├── controllers/
├── services/
├── routes/
├── middleware/
└── utils/
```

## Frontend

Use:

- React.js
- JavaScript
- Tailwind CSS
- React Router
- Axios
- React Flow

## Database

Use:

- PostgreSQL
- Prisma

PostgreSQL is the source of truth.

## Optional Infrastructure

Use only when needed:

- Redis
- BullMQ
- Docker

Do not introduce Redis, BullMQ, Kafka, Kubernetes, microservices, Elasticsearch, or complex ML before the core MVP works.

---

# 3. Architecture Style

Use a **modular monolith**.

Do not split the MVP into microservices.

Recommended architecture:

```text
React Frontend
      |
      | HTTP / REST
      v
Express.js API
      |
      +-------------------+
      |                   |
      v                   v
   Services            Middleware
      |
      v
    Prisma
      |
      v
 PostgreSQL

Optional:
Express -> Redis -> BullMQ Worker
```

Use clear separation between:

```text
Routes
  ↓
Controllers
  ↓
Services
  ↓
Prisma
  ↓
PostgreSQL
```

Business logic should primarily live in services, not route files.

---

# 4. Repository Structure

Use this structure:

```text
family-identity-platform/
│
├── frontend/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── redis.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── family.controller.js
│   │   │   ├── member.controller.js
│   │   │   ├── relationship.controller.js
│   │   │   ├── document.controller.js
│   │   │   ├── verification.controller.js
│   │   │   ├── duplicate.controller.js
│   │   │   ├── scheme.controller.js
│   │   │   └── beneficiary.controller.js
│   │   │
│   │   ├── services/
│   │   │   ├── auth.service.js
│   │   │   ├── family.service.js
│   │   │   ├── member.service.js
│   │   │   ├── relationship.service.js
│   │   │   ├── document.service.js
│   │   │   ├── verification.service.js
│   │   │   ├── duplicate.service.js
│   │   │   └── beneficiary.service.js
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── family.routes.js
│   │   │   ├── member.routes.js
│   │   │   ├── relationship.routes.js
│   │   │   ├── document.routes.js
│   │   │   ├── verification.routes.js
│   │   │   ├── duplicate.routes.js
│   │   │   └── scheme.routes.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   ├── role.middleware.js
│   │   │   ├── validation.middleware.js
│   │   │   └── error.middleware.js
│   │   │
│   │   ├── utils/
│   │   │   ├── jwt.js
│   │   │   ├── familyId.js
│   │   │   └── similarity.js
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   ├── uploads/
│   ├── .env
│   ├── .env.example
│   └── package.json
│
├── docs/
└── README.md
```

Do not create unnecessary folders or abstractions.

---

# 5. User Roles

Implement these roles:

```text
CITIZEN
VERIFICATION_OFFICER
DISTRICT_OFFICER
ADMIN
```

## CITIZEN

Can:

- Register.
- Login.
- Create their family.
- View their family.
- Add family members.
- Add relationships.
- Upload documents.
- Submit information for verification.
- View family tree.
- View eligible schemes.
- Apply for schemes.
- View beneficiary status.

## VERIFICATION_OFFICER

Can:

- View assigned/pending verification records.
- Verify/reject families.
- Verify/reject family members.
- Verify/reject relationships.
- Verify/reject documents.
- Review duplicate alerts.

## DISTRICT_OFFICER

Can:

- View district-level families.
- View verification statistics.
- Review beneficiary information.
- View reports.

## ADMIN

Can:

- Manage users.
- Manage schemes.
- Manage system configuration.
- View audit logs.
- Access administrative dashboards.

Always enforce authorization on the backend. Never rely only on frontend role checks.

---

# 6. Database Model

Use Prisma with PostgreSQL.

Required entities:

## User

```text
id
name
email
mobile
passwordHash
role
createdAt
updatedAt
```

## Family

```text
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

## FamilyMember

```text
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

## Relationship

```text
id
familyId
fromMemberId
toMemberId
relationshipType
verificationStatus
createdAt
updatedAt
```

## Document

```text
id
memberId
documentType
filePath
verificationStatus
uploadedAt
verifiedAt
```

## Scheme

```text
id
name
description
eligibilityRule
status
createdAt
updatedAt
```

## BeneficiaryApplication

```text
id
familyId
memberId
schemeId
status
appliedAt
updatedAt
```

## AuditLog

```text
id
userId
action
entityType
entityId
oldValue
newValue
createdAt
```

Use foreign keys and appropriate indexes.

Use enums where they improve data integrity.

---

# 7. Family ID Rules

Family IDs must:

- Be unique.
- Not contain Aadhaar numbers.
- Not contain raw sensitive information.
- Remain stable during the family lifecycle.
- Not depend on the current address.

Example:

```text
GJ-FAM-8A72K91X
```

Generate IDs using secure/random generation.

Do not use:

```text
GJ-AADHAAR-123456789012
```

---

# 8. Authentication

Use:

- bcrypt for password hashing.
- JWT for authentication.
- Middleware for protected routes.

Registration flow:

```text
Request
  ↓
Validate input
  ↓
Check existing user
  ↓
Hash password
  ↓
Create User
  ↓
Return authentication result
```

Login flow:

```text
Email + Password
       ↓
Find User
       ↓
bcrypt.compare()
       ↓
Generate JWT
       ↓
Return token
```

Never store plaintext passwords.

Never put passwords or sensitive personal data inside JWT payloads.

---

# 9. Validation

Use Zod or another lightweight validation approach.

Validate:

- Email.
- Mobile number.
- Password.
- Family information.
- Member information.
- Relationship types.
- Scheme applications.
- Uploaded document metadata.

Return consistent validation errors.

Example response:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

---

# 10. API Conventions

Base path:

```text
/api
```

Endpoints:

```text
/api/auth
/api/users
/api/families
/api/members
/api/relationships
/api/documents
/api/verification
/api/duplicates
/api/schemes
/api/beneficiaries
/api/audit
/api/dashboard
```

Important endpoints:

```http
POST /api/auth/register
POST /api/auth/login

POST /api/families
GET /api/families/:id
PUT /api/families/:id

POST /api/families/:familyId/members
GET /api/families/:familyId/members
PUT /api/members/:id

POST /api/relationships
PUT /api/relationships/:id/verify

POST /api/documents
PUT /api/documents/:id/verify

POST /api/duplicates/check
GET /api/duplicates
PUT /api/duplicates/:id/review

GET /api/schemes
POST /api/schemes/:id/apply

GET /api/families/:id/benefits
GET /api/families/:id/audit

GET /api/families/:familyId/tree
GET /api/dashboard/statistics
```

Use proper HTTP status codes.

Recommended:

```text
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error
```

---

# 11. Family Lifecycle

A family should follow a controlled lifecycle.

Example:

```text
DRAFT
  ↓
PENDING_VERIFICATION
  ↓
VERIFIED
```

Possible rejection:

```text
PENDING_VERIFICATION
  ↓
REJECTED
```

Do not permanently delete important verified historical information.

Prefer status-based lifecycle management.

---

# 12. Member Lifecycle

Use:

```text
ACTIVE
INACTIVE
DECEASED
MIGRATED
SEPARATED
```

Verification status:

```text
PENDING
UNDER_REVIEW
VERIFIED
REJECTED
```

---

# 13. Relationship Lifecycle

Relationship verification:

```text
PENDING
   ↓
UNDER_REVIEW
   ↓
VERIFIED
```

or:

```text
UNDER_REVIEW
   ↓
REJECTED
```

Supported relationship examples:

```text
FATHER
MOTHER
SON
DAUGHTER
SPOUSE
BROTHER
SISTER
GRANDFATHER
GRANDMOTHER
GRANDSON
GRANDDAUGHTER
```

Prevent invalid relationships where practical.

---

# 14. Family Tree

The backend should return graph data.

Example:

```json
{
  "nodes": [
    {
      "id": "M001",
      "name": "Vivek"
    }
  ],
  "relationships": [
    {
      "source": "M001",
      "target": "M002",
      "type": "SPOUSE"
    }
  ]
}
```

React Flow should render:

```text
          Vivek ─── Priya
             │
       ┌─────┴─────┐
       │           │
     Rahul        Riya
```

Keep graph construction logic in a service.

---

# 15. Document Management

Use Multer for uploads.

Development:

```text
backend/uploads/
```

Production:

```text
S3-compatible object storage
```

Do not store large document binaries directly in PostgreSQL.

Store metadata:

```text
documentType
filePath / storageKey
memberId
verificationStatus
uploadedAt
verifiedAt
```

Validate:

- MIME type.
- Extension.
- Maximum size.
- Authorized owner/access.

Never expose unrestricted upload directories publicly.

---

# 16. Duplicate Detection

Duplicate detection is a **potential-match system**, not an automatic merge system.

For a new member, compare:

```text
Name
Date of Birth
Parent Name
Spouse Name
Address
```

Example scoring:

```text
Name             90%
DOB             100%
Parent Name      94%
Address          85%
--------------------
Potential Match  92%
```

If the similarity is high:

```text
Create Duplicate Review
```

Officer makes the final decision:

```text
SAME_PERSON
```

or:

```text
DIFFERENT_PERSON
```

Never automatically merge records solely because a similarity score is high.

Keep duplicate detection deterministic and explainable for the MVP.

---

# 17. Government Schemes

Create 3–4 mock schemes.

Example:

```text
Housing Assistance
Education Support
Health Assistance
Senior Citizen Support
```

For MVP, eligibility can use simple rules.

Example:

```text
age < 25
AND student = true
→ Education Support
```

Another:

```text
income < threshold
AND ownsHouse = false
→ Housing Support
```

Do not build a complex AI eligibility engine unless explicitly required.

---

# 18. Beneficiary Workflow

```text
Family
  ↓
Eligible Schemes
  ↓
Citizen Applies
  ↓
UNDER_REVIEW
  ↓
Officer Decision
  ↓
APPROVED / REJECTED
```

Statuses:

```text
APPLIED
UNDER_REVIEW
APPROVED
REJECTED
```

---

# 19. Audit Trail

Audit important state changes.

Log:

```text
userId
action
entityType
entityId
oldValue
newValue
createdAt
```

Examples:

```text
FAMILY_CREATED
MEMBER_ADDED
RELATIONSHIP_CREATED
RELATIONSHIP_VERIFIED
DOCUMENT_UPLOADED
DOCUMENT_VERIFIED
DUPLICATE_REVIEWED
SCHEME_CREATED
BENEFICIARY_APPLIED
BENEFICIARY_APPROVED
BENEFICIARY_REJECTED
```

Audit logs should be append-oriented and should not be casually deleted.

---

# 20. Redis and BullMQ

These are optional.

First complete:

```text
Authentication
Family
Members
Relationships
Documents
Verification
Family Tree
Duplicate Detection
Schemes
Beneficiaries
Audit
```

Then add Redis.

Good Redis use cases:

```text
Rate limiting
Dashboard caching
Temporary verification data
```

Good BullMQ use cases:

```text
Duplicate detection
Document processing
Notifications
Report generation
```

Do not use Redis as the source of truth.

---

# 21. Security Requirements

Implement:

```text
Helmet
CORS
JWT
RBAC
Input Validation
bcrypt
Rate Limiting
Secure File Upload
Authorization Checks
```

Important rules:

1. Never store plaintext passwords.
2. Never put passwords in logs.
3. Never expose sensitive data unnecessarily.
4. Never trust frontend authorization.
5. Verify ownership before accessing family data.
6. Validate every user-controlled input.
7. Validate uploaded files.
8. Do not use real Aadhaar data for the hackathon.
9. Use dummy/sample identity data.
10. Never put Aadhaar or sensitive identity numbers in Family IDs.

---

# 22. Environment Variables

Use `.env`.

Example:

```env
PORT=5000

DATABASE_URL="postgresql://postgres:password@localhost:5432/family_identity"

JWT_SECRET="change-this-secret"
JWT_EXPIRES_IN="1d"

UPLOAD_DIR="./uploads"

REDIS_URL="redis://localhost:6379"
```

Create `.env.example` without real secrets.

Never commit `.env`.

---

# 23. Error Handling

Use a centralized error middleware.

Expected structure:

```text
Controller
   ↓
Service
   ↓
Error
   ↓
Error Middleware
   ↓
Consistent JSON Response
```

Example:

```json
{
  "success": false,
  "message": "Family not found"
}
```

Do not expose stack traces or internal database errors in production responses.

Log detailed errors server-side.

---

# 24. Frontend Rules

Use reusable components.

Suggested structure:

```text
frontend/
└── src/
    ├── components/
    ├── pages/
    ├── layouts/
    ├── services/
    ├── hooks/
    ├── context/
    ├── utils/
    └── App.jsx
```

Important pages:

```text
Login
Register
Citizen Dashboard
Family Registration
Family Details
Family Members
Family Tree
Document Upload
Scheme List
Beneficiary Applications
Officer Dashboard
Verification Queue
Duplicate Review
Audit Logs
Admin Dashboard
```

Use Axios for API communication.

Keep API calls out of large UI components where practical.

---

# 25. UI Priorities

The most important UI is the Family 360 dashboard.

It should show:

```text
Family ID
Family Head
Family Status
Location
Members
Family Tree
Verification Status
Documents
Potential Duplicate Alerts
Eligible Schemes
Beneficiary Applications
Recent Audit Events
```

The officer dashboard should prioritize pending actions.

---

# 26. Development Order

Implement in this order:

```text
1. Project Setup
2. PostgreSQL + Prisma
3. Express Server
4. Authentication
5. JWT Middleware
6. RBAC
7. Family Registration
8. Family ID
9. Family Members
10. Relationships
11. Family Tree
12. Documents
13. Officer Verification
14. Duplicate Detection
15. Schemes
16. Eligibility
17. Beneficiary Applications
18. Audit Logs
19. Redis
20. BullMQ
21. Swagger
22. Testing
23. Docker
24. Deployment
```

Do not jump ahead before the previous core feature works.

---

# 27. Implementation Discipline

When modifying the codebase:

1. Inspect the existing project structure first.
2. Reuse existing utilities and services.
3. Do not duplicate business logic.
4. Keep controllers thin.
5. Keep business rules in services.
6. Keep Prisma access organized.
7. Validate input at API boundaries.
8. Handle errors consistently.
9. Do not introduce a new dependency unless it solves a real requirement.
10. Do not rewrite working modules unnecessarily.

Before adding a package, check whether the project already has a package that solves the problem.

---

# 28. Testing Requirements

At minimum test:

## Auth

```text
Register
Duplicate email
Login
Wrong password
Missing JWT
Expired JWT
```

## Family

```text
Create
Get
Update
Unauthorized access
Invalid family
```

## Members

```text
Add
Update
Invalid family
Unauthorized modification
```

## Relationships

```text
Create
Verify
Reject
Invalid members
Cross-family relationship prevention
```

## Documents

```text
Valid upload
Invalid type
Oversized file
Unauthorized access
Verification
```

## Duplicate Detection

```text
Exact duplicate
High similarity
Low similarity
Officer review
```

## Schemes

```text
Eligible
Not eligible
Apply
Approve
Reject
```

---

# 29. API Testing

Use Postman during development.

Recommended collection:

```text
Family Identity Platform
├── Auth
│   ├── Register
│   └── Login
├── Families
├── Members
├── Relationships
├── Documents
├── Verification
├── Duplicates
├── Schemes
├── Beneficiaries
└── Dashboard
```

Add Swagger/OpenAPI after the core APIs are stable.

---

# 30. Git Workflow

Use small commits.

Examples:

```text
feat: initialize node backend
feat: add prisma schema
feat: implement user registration
feat: implement login with jwt
feat: add role based authorization
feat: implement family registration
feat: add family member management
feat: implement relationships
feat: add family tree api
feat: add document upload
feat: add officer verification
feat: add duplicate detection
feat: add government schemes
feat: add beneficiary workflow
feat: add audit logging
fix: validate family ownership
fix: handle duplicate family id
```

Do not commit:

```text
.env
node_modules/
uploads/
logs/
```

---

# 31. Claude Coding Workflow

When working on a task, follow this sequence:

```text
1. Understand the requested feature.
2. Inspect relevant existing files.
3. Identify database/API/UI changes.
4. Implement the smallest complete change.
5. Run the relevant tests/checks.
6. Fix errors.
7. Verify API behavior.
8. Update documentation if necessary.
```

For larger features:

```text
Database
   ↓
Service
   ↓
Controller
   ↓
Route
   ↓
Frontend API Service
   ↓
Frontend UI
   ↓
Test
```

Do not generate hundreds of files without implementing and validating them.

---

# 32. Claude Must Preserve Existing Work

Before changing an existing feature:

- Read the relevant files.
- Understand current behavior.
- Avoid unnecessary rewrites.
- Preserve existing API contracts unless the task explicitly changes them.
- If an API contract must change, update both frontend and backend.
- Check Prisma migrations before changing models.
- Do not silently remove existing functionality.

---

# 33. Prisma Rules

Use Prisma migrations for schema changes.

Development workflow:

```bash
npx prisma migrate dev --name <migration-name>
```

Generate Prisma Client:

```bash
npx prisma generate
```

Inspect database:

```bash
npx prisma studio
```

Never manually edit generated Prisma client files.

Do not reset the production database casually.

---

# 34. Definition of Done

A feature is complete only when:

```text
[ ] Database model exists if required
[ ] Prisma migration works
[ ] Service implemented
[ ] Controller implemented
[ ] Route implemented
[ ] Authentication checked
[ ] Authorization checked
[ ] Validation implemented
[ ] Error handling implemented
[ ] Frontend integrated if required
[ ] API tested
[ ] Edge cases tested
[ ] Documentation updated
```

---

# 35. MVP Demo Scenario

Use this exact end-to-end scenario for the hackathon:

```text
Citizen logs in
      ↓
Creates a family
      ↓
System generates Family ID
      ↓
Citizen becomes Family Head
      ↓
Adds spouse and children
      ↓
Creates relationships
      ↓
Uploads supporting documents
      ↓
Submits for verification
      ↓
Officer opens verification dashboard
      ↓
Officer verifies documents
      ↓
Officer verifies relationships
      ↓
System checks potential duplicates
      ↓
Officer reviews duplicate alert
      ↓
Family becomes VERIFIED
      ↓
Family 360 dashboard becomes available
      ↓
System evaluates schemes
      ↓
Citizen applies for eligible scheme
      ↓
Officer reviews application
      ↓
Application becomes APPROVED/REJECTED
      ↓
Audit trail records every important action
```

---

# 36. Important Product Principles

## Family ID

Stable and non-sensitive.

## Verification

Human officer remains the final decision-maker for important identity/relationship verification.

## Duplicate Detection

System flags potential duplicates; it does not automatically merge people.

## Database

PostgreSQL is the authoritative source of truth.

## Architecture

Modular monolith first.

## Privacy

Use dummy data for the hackathon and minimize sensitive data storage.

## Simplicity

Build the smallest complete workflow before adding advanced infrastructure.

---

# 37. First Task for Claude

When starting implementation, do NOT immediately build the entire application.

Start with:

```text
1. Create backend folder.
2. Initialize Node.js.
3. Install Express, Prisma, PostgreSQL client dependencies,
   bcrypt, JWT, CORS, Helmet, Zod, and Multer.
4. Configure JavaScript.
5. Initialize Prisma.
6. Create the initial Prisma schema.
7. Create the Express app.
8. Create the health-check endpoint.
9. Connect Prisma to PostgreSQL.
10. Run the first migration.
11. Verify the backend starts successfully.
```

Health endpoint:

```http
GET /api/health
```

Expected:

```json
{
  "success": true,
  "message": "Family Identity Platform API is running"
}
```

Only after this foundation works should authentication be implemented.

---

# 38. Final Instruction to Claude

You are the primary coding agent for this project.

Follow the architecture and business rules in this skill file.

Use **JavaScript, not TypeScript**.

Prefer simple, production-minded code over overengineering.

Implement features incrementally.

Before changing code, inspect the existing implementation.

After changing code, run relevant tests or validation.

Never use real sensitive government identity data.

Never automatically merge duplicate identity records.

Never bypass backend authorization.

Keep PostgreSQL as the source of truth.

The target is a **working hackathon MVP**, not an unnecessarily complex enterprise platform.
