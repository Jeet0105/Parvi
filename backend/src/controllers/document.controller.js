const path = require('node:path');

const documentService = require('../services/document.service');
const { success } = require('../utils/apiResponse');

async function upload(req, res) {
  const document = await documentService.createDocument({
    user: req.user,
    file: req.file,
    data: req.body,
  });
  return success(res, 201, 'Document uploaded', { document });
}

async function getById(req, res) {
  const document = await documentService.getDocument({
    user: req.user,
    id: req.params.id,
  });
  return success(res, 200, 'Document retrieved', { document });
}

async function download(req, res) {
  const { document, absolutePath } = await documentService.getDocumentFile({
    user: req.user,
    id: req.params.id,
  });

  // Served through an authorised route, never from a public static directory.
  res.type(document.mimeType);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${path.basename(document.originalName)}"`
  );
  return res.sendFile(absolutePath);
}

async function listForMember(req, res) {
  const documents = await documentService.listForMember({
    user: req.user,
    memberId: req.params.memberId,
  });
  return success(res, 200, 'Documents retrieved', { documents });
}

async function verify(req, res) {
  const document = await documentService.verifyDocument({
    user: req.user,
    id: req.params.id,
    action: req.body.action,
    reason: req.body.reason,
  });
  return success(res, 200, 'Document updated', { document });
}

async function pending(req, res) {
  const result = await documentService.listPending({
    user: req.user,
    ...req.validated?.query,
  });
  return success(res, 200, 'Pending documents retrieved', result);
}

module.exports = { upload, getById, download, listForMember, verify, pending };
