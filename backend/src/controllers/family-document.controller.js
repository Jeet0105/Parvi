const documentService = require('../services/document.service');
const { success } = require('../utils/apiResponse');

/** Documents belonging to every member of one family. */
async function listForFamily(req, res) {
  const { family, documents } = await documentService.listForFamily({
    user: req.user,
    familyId: req.params.familyId,
    verificationStatus: req.validated?.query?.verificationStatus,
  });
  return success(res, 200, 'Documents retrieved', {
    familyId: family.familyId,
    documents,
  });
}

module.exports = { listForFamily };
