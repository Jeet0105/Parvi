const AppError = require('../utils/AppError');
const { failure } = require('../utils/apiResponse');

/** 404 handler for unmatched routes. Runs before the error handler. */
function notFoundHandler(req, res) {
  return failure(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

/**
 * Maps errors raised by express.json() to sensible client errors, so a bad
 * request body does not surface as an opaque 500.
 */
function mapBodyParserError(err) {
  if (err.type === 'entity.parse.failed') {
    return new AppError(400, 'Malformed JSON in request body');
  }
  if (err.type === 'entity.too.large') {
    return new AppError(413, 'Request body too large');
  }
  return null;
}

/**
 * Centralized error middleware.
 * Never leaks stack traces, database errors or secrets to the client.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const mapped = err instanceof AppError ? err : mapBodyParserError(err);

  if (mapped) {
    return failure(res, mapped.statusCode, mapped.message, mapped.errors);
  }

  // Unexpected failure: the detail stays server-side.
  if (process.env.NODE_ENV !== 'test') {
    console.error('[unhandled error]', err);
  }
  return failure(res, 500, 'Something went wrong');
}

module.exports = { notFoundHandler, errorHandler };
