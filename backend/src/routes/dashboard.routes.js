const express = require('express');

const verificationController = require('../controllers/verification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, OFFICER_ROLES } = require('../middleware/role.middleware');

const router = express.Router();

// Dashboard figures are for officers; citizens see their own family instead.
router.use(authenticate, authorize(OFFICER_ROLES));

router.get('/statistics', verificationController.statistics);

module.exports = router;
