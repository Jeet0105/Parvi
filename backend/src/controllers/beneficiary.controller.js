const beneficiaryService = require('../services/beneficiary.service');
const { success } = require('../utils/apiResponse');

async function apply(req, res) {
  const application = await beneficiaryService.apply({
    user: req.user,
    schemeId: req.params.schemeId || req.body.schemeId,
    memberId: req.body.memberId,
  });

  return success(res, 201, 'Beneficiary application submitted successfully', { application });
}

async function myApplications(req, res) {
  const applications = await beneficiaryService.listMyApplications({
    user: req.user,
  });

  return success(res, 200, 'Applications retrieved', { applications });
}

async function list(req, res) {
  const result = await beneficiaryService.listApplications({
    user: req.user,
    ...req.query,
    page: req.query.page ? parseInt(req.query.page, 10) : 1,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize, 10) : 25,
  });

  return success(res, 200, 'Beneficiary applications retrieved', result);
}

async function review(req, res) {
  const application = await beneficiaryService.reviewApplication({
    user: req.user,
    id: req.params.id,
    action: req.body.action,
    decisionReason: req.body.decisionReason,
  });

  return success(res, 200, 'Application decision recorded', { application });
}

module.exports = {
  apply,
  myApplications,
  list,
  review,
};
