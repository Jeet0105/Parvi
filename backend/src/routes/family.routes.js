const express = require('express');

const familyController = require('../controllers/family.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, ROLES, OFFICER_ROLES } = require('../middleware/role.middleware');
const {
  validateBody,
  validateParams,
  validateQuery,
} = require('../middleware/validation.middleware');
const {
  createFamilySchema,
  updateFamilySchema,
  familyIdParamSchema,
  listFamiliesQuerySchema,
} = require('../validators/family.validator');

const router = express.Router();

router.use(authenticate);

// Officer-facing list. Declared before "/:id" so "mine" and the list route
// are not swallowed by the parameterised path.
router.get(
  '/',
  authorize(OFFICER_ROLES),
  validateQuery(listFamiliesQuerySchema),
  familyController.list
);

router.get('/mine', authorize(ROLES.CITIZEN), familyController.mine);

router.post(
  '/',
  authorize(ROLES.CITIZEN),
  validateBody(createFamilySchema),
  familyController.create
);

router.get('/:id', validateParams(familyIdParamSchema), familyController.getById);

router.put(
  '/:id',
  validateParams(familyIdParamSchema),
  validateBody(updateFamilySchema),
  familyController.update
);

module.exports = router;
