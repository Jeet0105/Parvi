const schemeService = require('../services/scheme.service');
const { success } = require('../utils/apiResponse');

async function list(req, res) {
  const schemes = await schemeService.listSchemes();
  return success(res, 200, 'Schemes retrieved', { schemes });
}

async function getById(req, res) {
  const scheme = await schemeService.getSchemeById(req.params.id);
  return success(res, 200, 'Scheme retrieved', { scheme });
}

async function getEligibleForFamily(req, res) {
  const result = await schemeService.getEligibleSchemesForFamily({
    user: req.user,
    familyId: req.params.familyId,
  });

  return success(res, 200, 'Eligible schemes calculated', result);
}

module.exports = {
  list,
  getById,
  getEligibleForFamily,
};
