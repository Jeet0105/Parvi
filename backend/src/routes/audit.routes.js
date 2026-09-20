const express = require('express');

const auditController = require('../controllers/audit.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, OFFICER_ROLES } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate, authorize(OFFICER_ROLES));

// List all audit logs (paginated, filterable)
router.get('/', auditController.list);

// Get audit history for a specific entity
router.get('/:entityType/:entityId', auditController.getEntityAudit);

module.exports = router;
