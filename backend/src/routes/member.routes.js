const express = require('express');

const memberController = require('../controllers/member.controller');
const { authenticate } = require('../middleware/auth.middleware');
const {
  validateBody,
  validateParams,
} = require('../middleware/validation.middleware');
const {
  updateMemberSchema,
  memberIdParamSchema,
} = require('../validators/member.validator');

// Routes addressing a member directly, mounted at /api/members.
const router = express.Router();

router.use(authenticate);

router.get('/:id', validateParams(memberIdParamSchema), memberController.getById);

router.put(
  '/:id',
  validateParams(memberIdParamSchema),
  validateBody(updateMemberSchema),
  memberController.update
);

module.exports = router;
