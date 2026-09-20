const AppError = require('../utils/AppError');

/** Flattens a ZodError into the API's { field, message } error shape. */
function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validates a request segment against a Zod schema.
 *
 * Validated output replaces the raw input for `body`, so controllers always
 * receive trimmed, coerced values. Express 5 exposes `query` and `params` as
 * getters, so their parsed values are attached to `req.validated` instead.
 */
function validate(schemas) {
  return (req, res, next) => {
    const issues = [];

    for (const segment of ['body', 'params', 'query']) {
      const schema = schemas[segment];
      if (!schema) continue;

      const result = schema.safeParse(req[segment]);

      if (!result.success) {
        issues.push(...formatIssues(result.error));
        continue;
      }

      if (segment === 'body') {
        req.body = result.data;
      } else {
        req.validated = { ...(req.validated || {}), [segment]: result.data };
      }
    }

    if (issues.length > 0) {
      return next(new AppError(422, 'Validation failed', issues));
    }
    return next();
  };
}

const validateBody = (schema) => validate({ body: schema });
const validateParams = (schema) => validate({ params: schema });
const validateQuery = (schema) => validate({ query: schema });

module.exports = { validate, validateBody, validateParams, validateQuery };
