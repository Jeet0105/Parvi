const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const { verifyToken } = require('../utils/jwt');

/** Pulls the bearer token out of the Authorization header. */
function extractToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (!/^Bearer$/i.test(scheme) || !token) return null;

  return token.trim() || null;
}

/**
 * Verifies the bearer token and loads the current user onto `req.user`.
 *
 * The user is re-read from the database on every request rather than trusted
 * from the token, so a deleted account or a role change takes effect
 * immediately instead of lingering until the token expires.
 */
async function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return next(new AppError(401, 'Authentication required'));
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Session expired, please sign in again'
        : 'Invalid authentication token';
    return next(new AppError(401, message));
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: true,
      district: true,
    },
  });

  if (!user) {
    return next(new AppError(401, 'Invalid authentication token'));
  }

  req.user = user;
  return next();
}

module.exports = { authenticate, extractToken };
