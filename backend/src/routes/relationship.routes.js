const express = require('express');

const relationshipController = require('../controllers/relationship.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, ROLES, OFFICER_ROLES } = require('../middleware/role.middleware');
const {
  validateBody,
  validateParams,
  validateQuery,
} = require('../middleware/validation.middleware');
const {
  createRelationshipSchema,
  verifyRelationshipSchema,
  relationshipIdParamSchema,
  pendingQuerySchema,
} = require('../validators/relationship.validator');

const router = express.Router();

router.use(authenticate);

// Officer queue, declared before "/:id" so it is not treated as an id.
router.get(
  '/pending',
  authorize(OFFICER_ROLES),
  validateQuery(pendingQuerySchema),
  relationshipController.pending
);

router.post(
  '/',
  authorize(ROLES.CITIZEN),
  validateBody(createRelationshipSchema),
  relationshipController.create
);

router.get(
  '/:id',
  validateParams(relationshipIdParamSchema),
  relationshipController.getById
);

// Verification is an officer responsibility: a family cannot approve itself.
router.put(
  '/:id/verify',
  authorize(ROLES.VERIFICATION_OFFICER, ROLES.ADMIN),
  validateParams(relationshipIdParamSchema),
  validateBody(verifyRelationshipSchema),
  relationshipController.verify
);

module.exports = router;
