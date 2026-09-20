const familyService = require('../services/family.service');
const { success } = require('../utils/apiResponse');

async function create(req, res) {
  const family = await familyService.createFamily({
    user: req.user,
    data: req.body,
  });
  return success(res, 201, 'Family registered', { family });
}

async function getById(req, res) {
  const family = await familyService.getFamily({
    user: req.user,
    id: req.params.id,
  });
  return success(res, 200, 'Family retrieved', { family });
}

async function update(req, res) {
  const family = await familyService.updateFamily({
    user: req.user,
    id: req.params.id,
    data: req.body,
  });
  return success(res, 200, 'Family updated', { family });
}

async function mine(req, res) {
  const family = await familyService.getMyFamily(req.user);
  return success(res, 200, family ? 'Family retrieved' : 'No family registered yet', {
    family,
  });
}

async function list(req, res) {
  const result = await familyService.listFamilies({
    user: req.user,
    ...req.validated?.query,
  });
  return success(res, 200, 'Families retrieved', result);
}

module.exports = { create, getById, update, mine, list };
