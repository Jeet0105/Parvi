const express = require('express');

const beneficiaryController = require('../controllers/beneficiary.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, OFFICER_ROLES } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

// Apply for a scheme
router.post('/apply', beneficiaryController.apply);

// Citizen: list own applications
router.get('/mine', beneficiaryController.myApplications);

// Officer/Admin: list all applications (with optional status filter)
router.get('/', authorize(OFFICER_ROLES), beneficiaryController.list);

// Officer/Admin: approve/reject an application
router.patch('/:id/review', authorize(OFFICER_ROLES), beneficiaryController.review);

module.exports = router;
