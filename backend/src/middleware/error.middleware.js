const AppError = require('../utils/AppError');
const { failure } = require('../utils/apiResponse');

/** 404 handler for unmatched routes. Runs before the error handler. */
function notFoundHandler(req, res) {
  return failure(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

/**
 * Centralized error middleware.
 * Never leaks stack traces, DB errors or secrets to the client.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isOperational = err instanceof AppError;
  const statusCode = isOperational ? err.statusCode : 500;

  if (!isOperational) {
    // Unexpected failure: log the detail server-side only.
    console.error('[unhandled error]', err);
  }

  const message = isOperational ? err.message : 'Something went wrong';
  return failure(res, statusCode, message, isOperational ? err.errors : undefined);
}

module.exports = { notFoundHandler, errorHandler };
