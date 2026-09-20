const duplicateService = require('../services/duplicate.service');
const { success } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await duplicateService.listDuplicateReviews({
    user: req.user,
    ...req.query,
    page: req.query.page ? parseInt(req.query.page, 10) : 1,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize, 10) : 20,
  });

  return success(res, 200, 'Duplicate reviews retrieved', result);
}

async function decide(req, res) {
  const result = await duplicateService.decideDuplicateReview({
    user: req.user,
    id: req.params.id,
    decision: req.body.decision,
    reviewNote: req.body.reviewNote,
  });

  return success(res, 200, 'Duplicate review decision recorded', { review: result });
}

async function scan(req, res) {
  const result = await duplicateService.scanAll();
  return success(res, 200, 'Duplicate scan completed', result);
}

module.exports = {
  list,
  decide,
  scan,
};
