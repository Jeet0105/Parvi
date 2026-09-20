const memberService = require('../services/member.service');
const { success } = require('../utils/apiResponse');

async function create(req, res) {
  const member = await memberService.addMember({
    user: req.user,
    familyId: req.params.familyId,
    data: req.body,
  });
  return success(res, 201, 'Member added', { member });
}

async function list(req, res) {
  const { family, members } = await memberService.listMembers({
    user: req.user,
    familyId: req.params.familyId,
    includeInactive: req.validated?.query?.includeInactive ?? true,
  });
  return success(res, 200, 'Members retrieved', {
    familyId: family.familyId,
    familyHeadId: family.familyHeadId,
    members,
  });
}

async function getById(req, res) {
  const member = await memberService.getMember({
    user: req.user,
    memberId: req.params.id,
  });
  return success(res, 200, 'Member retrieved', { member });
}

async function update(req, res) {
  const member = await memberService.updateMember({
    user: req.user,
    memberId: req.params.id,
    data: req.body,
  });
  return success(res, 200, 'Member updated', { member });
}

async function changeHead(req, res) {
  const family = await memberService.changeFamilyHead({
    user: req.user,
    familyId: req.params.familyId,
    memberId: req.body.memberId,
  });
  return success(res, 200, 'Family Head updated', { family });
}

module.exports = { create, list, getById, update, changeHead };
