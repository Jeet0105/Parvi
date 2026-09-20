const express = require('express');

const familyController = require('../controllers/family.controller');
const memberController = require('../controllers/member.controller');
const relationshipController = require('../controllers/relationship.controller');
const treeController = require('../controllers/tree.controller');
const documentServiceController = require('../controllers/family-document.controller');
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
const {
  createMemberSchema,
  familyIdParamSchema: memberFamilyIdParamSchema,
  listMembersQuerySchema,
  changeHeadSchema,
} = require('../validators/member.validator');
const {
  listRelationshipsQuerySchema,
} = require('../validators/relationship.validator');

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

// Members, scoped to a family.
router.post(
  '/:familyId/members',
  authorize(ROLES.CITIZEN),
  validateParams(memberFamilyIdParamSchema),
  validateBody(createMemberSchema),
  memberController.create
);

router.get(
  '/:familyId/members',
  validateParams(memberFamilyIdParamSchema),
  validateQuery(listMembersQuerySchema),
  memberController.list
);

router.put(
  '/:familyId/head',
  authorize(ROLES.CITIZEN),
  validateParams(memberFamilyIdParamSchema),
  validateBody(changeHeadSchema),
  memberController.changeHead
);

router.get(
  '/:familyId/relationships',
  validateParams(memberFamilyIdParamSchema),
  validateQuery(listRelationshipsQuerySchema),
  relationshipController.listForFamily
);

router.get(
  '/:familyId/tree',
  validateParams(memberFamilyIdParamSchema),
  validateQuery(listRelationshipsQuerySchema),
  treeController.getTree
);

router.get(
  '/:familyId/documents',
  validateParams(memberFamilyIdParamSchema),
  validateQuery(listRelationshipsQuerySchema),
  documentServiceController.listForFamily
);

module.exports = router;
