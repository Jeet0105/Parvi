const userService = require('../services/user.service');
const { success } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await userService.listUsers(req.validated?.query);
  return success(res, 200, 'Users retrieved', result);
}

async function getById(req, res) {
  const user = await userService.getUser(req.params.id);
  return success(res, 200, 'User retrieved', { user });
}

async function updateRole(req, res) {
  const result = await userService.updateUserRole({
    id: req.params.id,
    role: req.body.role,
    actingUserId: req.user.id,
  });
  return success(res, 200, 'User role updated', result);
}

module.exports = { list, getById, updateRole };
