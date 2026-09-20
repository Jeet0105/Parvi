const relationshipService = require('../services/relationship.service');
const { success } = require('../utils/apiResponse');

async function create(req, res) {
  const relationship = await relationshipService.createRelationship({
    user: req.user,
    data: req.body,
  });
  return success(res, 201, 'Relationship recorded', { relationship });
}

async function listForFamily(req, res) {
  const { family, relationships } = await relationshipService.listForFamily({
    user: req.user,
    familyId: req.params.familyId,
    verificationStatus: req.validated?.query?.verificationStatus,
  });
  return success(res, 200, 'Relationships retrieved', {
    familyId: family.familyId,
    relationships,
  });
}

async function getById(req, res) {
  const relationship = await relationshipService.getRelationship({
    user: req.user,
    id: req.params.id,
  });
  return success(res, 200, 'Relationship retrieved', { relationship });
}

async function verify(req, res) {
  const relationship = await relationshipService.verifyRelationship({
    user: req.user,
    id: req.params.id,
    action: req.body.action,
    reason: req.body.reason,
  });
  return success(res, 200, 'Relationship updated', { relationship });
}

async function pending(req, res) {
  const result = await relationshipService.listPending({
    user: req.user,
    ...req.validated?.query,
  });
  return success(res, 200, 'Pending relationships retrieved', result);
}

module.exports = { create, listForFamily, getById, verify, pending };
