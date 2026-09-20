const treeService = require('../services/tree.service');
const { success } = require('../utils/apiResponse');

async function getTree(req, res) {
  const tree = await treeService.getFamilyTree({
    user: req.user,
    familyId: req.params.familyId,
    verificationStatus: req.validated?.query?.verificationStatus,
  });
  return success(res, 200, 'Family tree retrieved', tree);
}

module.exports = { getTree };
