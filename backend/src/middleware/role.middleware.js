const AppError = require('../utils/AppError');

const ROLES = {
  CITIZEN: 'CITIZEN',
  VERIFICATION_OFFICER: 'VERIFICATION_OFFICER',
  DISTRICT_OFFICER: 'DISTRICT_OFFICER',
  ADMIN: 'ADMIN',
};

/** Any role that acts on behalf of the government rather than a citizen. */
const OFFICER_ROLES = [
  ROLES.VERIFICATION_OFFICER,
  ROLES.DISTRICT_OFFICER,
  ROLES.ADMIN,
];

/**
 * Restricts a route to the given roles. Must run after `authenticate`.
 *
 * Returns 401 when there is no authenticated user and 403 when there is one
 * without the required role -- the distinction matters to the client, which
 * redirects to login on 401 but shows a refusal on 403.
 */
function authorize(...allowedRoles) {
  const allowed = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (!allowed.includes(req.user.role)) {
      return next(
        new AppError(403, 'You do not have permission to perform this action')
      );
    }

    return next();
  };
}

module.exports = { authorize, ROLES, OFFICER_ROLES };
