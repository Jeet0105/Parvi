const express = require('express');

const verificationController = require('../controllers/verification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, OFFICER_ROLES } = require('../middleware/role.middleware');
const { validateQuery } = require('../middleware/validation.middleware');
const { pendingQuerySchema } = require('../validators/verification.validator');

const router = express.Router();

// Dashboard figures and history are for officers; citizens see their own family instead.
router.use(authenticate, authorize(OFFICER_ROLES));

router.get('/statistics', verificationController.statistics);
router.get(
  '/history',
  validateQuery(pendingQuerySchema),
  verificationController.history
);

module.exports = router;
