const express = require('express');

const schemeController = require('../controllers/scheme.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

// Any authenticated user can list/view schemes
router.get('/', schemeController.list);
router.get('/:id', schemeController.getById);

// Eligibility check for a family
router.get('/family/:familyId/eligible', schemeController.getEligibleForFamily);

module.exports = router;
