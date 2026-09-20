/**
 * OpenAPI 3.0 Specification & Swagger UI Handler.
 *
 * Provides complete API documentation for all endpoints across Citizen,
 * Verification Officer, District Officer, and Administrator roles.
 */

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Family Identity & Beneficiary Management Platform API',
    version: '1.0.0',
    description:
      'Authoritative State Family Identity and Government Welfare Beneficiary Management System.',
    contact: {
      name: 'Government IT Services & Digital Transformation Division',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT token in format: Bearer <token>',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          mobile: { type: 'string' },
          role: {
            type: 'string',
            enum: ['CITIZEN', 'VERIFICATION_OFFICER', 'DISTRICT_OFFICER', 'ADMIN'],
          },
          district: { type: 'string', nullable: true },
        },
      },
      Family: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          familyId: { type: 'string', example: 'GJ-FAM-8A72K91X' },
          status: {
            type: 'string',
            enum: ['DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'],
          },
          state: { type: 'string', example: 'Gujarat' },
          district: { type: 'string', example: 'Ahmedabad' },
          taluka: { type: 'string', example: 'Daskroi' },
          village: { type: 'string', example: 'Ghatlodiya' },
          address: { type: 'string' },
          annualIncome: { type: 'number', example: 180000 },
          ownsHouse: { type: 'boolean', example: false },
        },
      },
      FamilyMember: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Priya Patel' },
          dateOfBirth: { type: 'string', format: 'date', example: '1998-05-12' },
          gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'] },
          fatherName: { type: 'string', nullable: true },
          motherName: { type: 'string', nullable: true },
          spouseName: { type: 'string', nullable: true },
          isStudent: { type: 'boolean', example: false },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'DECEASED', 'MIGRATED', 'SEPARATED'],
          },
          verificationStatus: {
            type: 'string',
            enum: ['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'],
          },
        },
      },
      Scheme: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          eligibilityRule: { type: 'object' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
        },
      },
      BeneficiaryApplication: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          familyId: { type: 'string' },
          memberId: { type: 'string' },
          schemeId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['APPLIED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
          },
          appliedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register Citizen account',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'mobile', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  mobile: { type: 'string' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Registration successful' },
          400: { description: 'Validation error or duplicate account' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Log in with email & password',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/families': {
      get: {
        summary: 'List families (Officer queue or Citizen own family)',
        tags: ['Families'],
        responses: {
          200: { description: 'Families list retrieved' },
        },
      },
      post: {
        summary: 'Register new Family',
        tags: ['Families'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['district', 'taluka', 'village', 'address'],
                properties: {
                  state: { type: 'string', default: 'Gujarat' },
                  district: { type: 'string' },
                  taluka: { type: 'string' },
                  village: { type: 'string' },
                  address: { type: 'string' },
                  annualIncome: { type: 'number' },
                  ownsHouse: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Family registered with unique Family ID' },
        },
      },
    },
    '/families/{id}/members': {
      post: {
        summary: 'Add member to family',
        tags: ['Members'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'dateOfBirth', 'gender'],
                properties: {
                  name: { type: 'string' },
                  dateOfBirth: { type: 'string', format: 'date' },
                  gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'] },
                  fatherName: { type: 'string' },
                  motherName: { type: 'string' },
                  spouseName: { type: 'string' },
                  isStudent: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Member added to family' },
        },
      },
    },
    '/families/{id}/tree': {
      get: {
        summary: 'Get family tree graph structure (Nodes & Edges)',
        tags: ['Family Tree'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Family tree hierarchy retrieved' },
        },
      },
    },
    '/schemes': {
      get: {
        summary: 'List active government schemes with eligibility evaluation',
        tags: ['Schemes & Beneficiaries'],
        responses: {
          200: { description: 'List of welfare schemes with eligibility status' },
        },
      },
    },
    '/schemes/{id}/apply': {
      post: {
        summary: 'Apply family member for welfare scheme',
        tags: ['Schemes & Beneficiaries'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['memberId'],
                properties: {
                  memberId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Application submitted' },
        },
      },
    },
    '/duplicates': {
      get: {
        summary: 'List duplicate detection alerts for officer review',
        tags: ['Duplicate Detection'],
        responses: {
          200: { description: 'Duplicate candidates list' },
        },
      },
    },
    '/audit': {
      get: {
        summary: 'List audit trail logs with filtering & pagination',
        tags: ['Audit Trail'],
        responses: {
          200: { description: 'Audit trail entries' },
        },
      },
    },
  },
};

function renderSwaggerHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>API Documentation - Family Identity & Beneficiary Management Platform</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(swaggerSpec)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
}

module.exports = {
  swaggerSpec,
  renderSwaggerHtml,
};
