/**
 * Operational error carrying an HTTP status code.
 * Anything thrown that is NOT an AppError is treated as an unexpected
 * failure and surfaced as a generic 500 by the error middleware.
 */
class AppError extends Error {
  constructor(statusCode, message, errors = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
