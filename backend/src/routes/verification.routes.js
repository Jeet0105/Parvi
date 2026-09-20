const express = require('express');

const verificationController = require('../controllers/verification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, OFFICER_ROLES, ROLES } = require('../middleware/role.middleware');
const {
  validateBody,
  validateQuery,
} = require('../middleware/validation.middleware');
const {
  verifyActionSchema,
  pendingQuerySchema,
} = require('../validators/verification.validator');

const router = express.Router();

router.use(authenticate);

router.get(
  '/families/pending',
  authorize(OFFICER_ROLES),
  validateQuery(pendingQuerySchema),
  verificationController.pendingFamilies
);

// Deciding is reserved for the roles responsible for verification; a district
// officer reviews and reports but does not approve.
router.put(
  '/members/:id',
  authorize(ROLES.VERIFICATION_OFFICER, ROLES.ADMIN),
  validateBody(verifyActionSchema),
  verificationController.verifyMember
);

router.put(
  '/families/:familyId',
  authorize(ROLES.VERIFICATION_OFFICER, ROLES.ADMIN),
  validateBody(verifyActionSchema),
  verificationController.verifyFamily
);

module.exports = router;
