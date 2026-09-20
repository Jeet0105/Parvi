const authService = require('../services/auth.service');
const { success } = require('../utils/apiResponse');

// Express 5 forwards rejected promises to the error middleware, so these
// handlers can stay thin and let the service layer throw AppError.

async function register(req, res) {
  const result = await authService.register(req.body);
  return success(res, 201, 'Registration successful', result);
}

async function login(req, res) {
  const result = await authService.login(req.body);
  return success(res, 200, 'Login successful', result);
}

module.exports = { register, login };
