const jwt = require('jsonwebtoken');

const DEFAULT_EXPIRES_IN = '1d';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

/**
 * Issues an access token.
 *
 * The payload deliberately carries only the user id and role -- never the
 * password hash, email, mobile or any other personal data. A JWT is signed,
 * not encrypted, so anything placed here is readable by the holder.
 */
function signToken(user, options = {}) {
  return jwt.sign({ sub: user.id, role: user.role }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    ...options,
  });
}

/** Returns the decoded payload, or throws a jsonwebtoken error. */
function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken };
