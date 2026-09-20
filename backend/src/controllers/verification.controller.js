const verificationService = require('../services/verification.service');
const { success } = require('../utils/apiResponse');

async function submit(req, res) {
  const family = await verificationService.submitFamily({
    user: req.user,
    familyId: req.params.familyId,
  });
  return success(res, 200, 'Family submitted for verification', { family });
}

async function verifyFamily(req, res) {
  const family = await verificationService.verifyFamily({
    user: req.user,
    familyId: req.params.familyId,
    action: req.body.action,
    reason: req.body.reason,
  });
  return success(res, 200, 'Family verification updated', { family });
}

async function verifyMember(req, res) {
  const member = await verificationService.verifyMember({
    user: req.user,
    memberId: req.params.id,
    action: req.body.action,
    reason: req.body.reason,
  });
  return success(res, 200, 'Member verification updated', { member });
}

async function pendingFamilies(req, res) {
  const result = await verificationService.listPendingFamilies({
    user: req.user,
    ...req.validated?.query,
  });
  return success(res, 200, 'Pending families retrieved', result);
}

async function statistics(req, res) {
  const stats = await verificationService.getStatistics({ user: req.user });
  return success(res, 200, 'Statistics retrieved', stats);
}

module.exports = {
  submit,
  verifyFamily,
  verifyMember,
  pendingFamilies,
  statistics,
};
