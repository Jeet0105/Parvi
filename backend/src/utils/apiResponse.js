/**
 * Consistent API response envelope used by every controller.
 * Success: { success: true, message, data }
 * Error:   { success: false, message, errors }
 */

function success(res, statusCode, message, data = undefined) {
  const body = { success: true, message };
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
}

function failure(res, statusCode, message, errors = undefined) {
  const body = { success: false, message };
  if (errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { success, failure };
