/**
 * Rate Limiting Middleware.
 *
 * Protects auth routes from brute-force password guessing and prevents
 * flooding of critical mutation endpoints.
 * Supports Redis-based rate limiting with in-memory sliding window fallback.
 */
const { isRedisConnected, redisClient } = require('../config/redis');

// In-memory sliding window store
const memoryStore = new Map();

function cleanMemoryStore() {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetTime) {
      memoryStore.delete(key);
    }
  }
}

// Clean old buckets every 5 minutes
setInterval(cleanMemoryStore, 5 * 60 * 1000).unref();

/**
 * Creates a rate limiter middleware.
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 mins)
 * @param {number} options.max - Max requests per window per IP (default: 100)
 * @param {string} options.message - Error message when exceeded
 */
function rateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Too many requests, please try again later.',
} = {}) {
  return async function rateLimit(req, res, next) {
    // In test environment, do not throttle
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${req.baseUrl || ''}:${req.path}:${ip}`;

    if (isRedisConnected() && redisClient) {
      try {
        const current = await redisClient.incr(key);
        if (current === 1) {
          await redisClient.pexpire(key, windowMs);
        }
        const ttl = await redisClient.pttl(key);
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
        res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + ttl) / 1000));

        if (current > max) {
          return res.status(429).json({
            success: false,
            message,
            statusCode: 429,
          });
        }
        return next();
      } catch (err) {
        // Fallback to in-memory below
      }
    }

    // In-memory rate limiting fallback
    const now = Date.now();
    let record = memoryStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      memoryStore.set(key, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        message,
        statusCode: 429,
      });
    }

    return next();
  };
}

// Strict limiter for authentication endpoints: 10 requests per 15 minutes per IP
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

// General API limiter: 300 requests per 15 minutes
const generalLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'API rate limit exceeded. Please slow down your requests.',
});

module.exports = {
  rateLimiter,
  authLimiter,
  generalLimiter,
};
