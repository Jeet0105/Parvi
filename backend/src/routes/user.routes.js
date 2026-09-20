const express = require('express');

const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, ROLES } = require('../middleware/role.middleware');
const {
  validateBody,
  validateParams,
  validateQuery,
} = require('../middleware/validation.middleware');
const {
  idParamSchema,
  listUsersQuerySchema,
  updateRoleSchema,
} = require('../validators/user.validator');

const router = express.Router();

// User administration is reserved for administrators.
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', validateQuery(listUsersQuerySchema), userController.list);
router.get('/:id', validateParams(idParamSchema), userController.getById);
router.put(
  '/:id/role',
  validateParams(idParamSchema),
  validateBody(updateRoleSchema),
  userController.updateRole
);

module.exports = router;
