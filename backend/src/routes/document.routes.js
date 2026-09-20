const express = require('express');

const documentController = require('../controllers/document.controller');
const { upload, handleUploadErrors } = require('../config/upload');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize, ROLES, OFFICER_ROLES } = require('../middleware/role.middleware');
const {
  validateBody,
  validateParams,
  validateQuery,
} = require('../middleware/validation.middleware');
const {
  uploadDocumentSchema,
  verifyDocumentSchema,
  documentIdParamSchema,
  memberIdParamSchema,
  pendingQuerySchema,
} = require('../validators/document.validator');

const router = express.Router();

router.use(authenticate);

// Declared before "/:id" so it is not treated as a document id.
router.get(
  '/pending',
  authorize(OFFICER_ROLES),
  validateQuery(pendingQuerySchema),
  documentController.pending
);

router.post(
  '/',
  authorize(ROLES.CITIZEN),
  upload.single('file'),
  handleUploadErrors,
  validateBody(uploadDocumentSchema),
  documentController.upload
);

router.get(
  '/member/:memberId',
  validateParams(memberIdParamSchema),
  documentController.listForMember
);

router.get(
  '/:id',
  validateParams(documentIdParamSchema),
  documentController.getById
);

// Files are streamed through an authorised route; the uploads directory is
// never exposed statically.
router.get(
  '/:id/file',
  validateParams(documentIdParamSchema),
  documentController.download
);

router.put(
  '/:id/verify',
  authorize(ROLES.VERIFICATION_OFFICER, ROLES.ADMIN),
  validateParams(documentIdParamSchema),
  validateBody(verifyDocumentSchema),
  documentController.verify
);

module.exports = router;
