const express = require('express');

const duplicateController = require('../controllers/duplicate.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, OFFICER_ROLES, ROLES } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(OFFICER_ROLES), duplicateController.list);
router.put(
  '/:id',
  authorize(ROLES.VERIFICATION_OFFICER, ROLES.ADMIN),
  duplicateController.decide
);
router.post('/scan', authorize(ROLES.ADMIN), duplicateController.scan);

module.exports = router;
