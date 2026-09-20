/**
 * Redis client configuration with graceful degradation.
 *
 * Redis is used for rate limiting, background job queuing (BullMQ), and dashboard caching.
 * If Redis is not reachable or disabled in the environment, the platform falls back
 * smoothly to in-memory caching and in-process execution without failing API requests.
 */
require('dotenv').config({ quiet: true });

let redisClient = null;
let isRedisConnected = false;

// We use ioredis or redis client if available, or lightweight mock
try {
  const Redis = require('ioredis');
  if (process.env.REDIS_URL || process.env.ENABLE_REDIS === 'true') {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null; // stop reconnecting after 3 attempts in dev
        return Math.min(times * 200, 1000);
      },
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('Connected to Redis');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      // Suppress noisy stack trace when redis is simply not started locally
      if (process.env.NODE_ENV !== 'production') {
        // quiet warning
      }
    });
  }
} catch (e) {
  // Redis package or connection not present, fallback enabled
  isRedisConnected = false;
}

// In-memory cache fallback
const memoryCache = new Map();

async function getCache(key) {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      // fallback to memory
    }
  }
  const item = memoryCache.get(key);
  if (!item) return null;
  if (item.expiresAt && Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

async function setCache(key, value, ttlSeconds = 60) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch (err) {
      // fallback to memory
    }
  }
  memoryCache.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

async function invalidateCache(patternOrKey) {
  if (isRedisConnected && redisClient) {
    try {
      if (patternOrKey.includes('*')) {
        const keys = await redisClient.keys(patternOrKey);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } else {
        await redisClient.del(patternOrKey);
      }
    } catch (err) {
      // ignore
    }
  }

  // Clear memory cache matching prefix or key
  const prefix = patternOrKey.replace('*', '');
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix) || k === patternOrKey) {
      memoryCache.delete(k);
    }
  }
}

module.exports = {
  redisClient,
  isRedisConnected: () => isRedisConnected,
  getCache,
  setCache,
  invalidateCache,
};
