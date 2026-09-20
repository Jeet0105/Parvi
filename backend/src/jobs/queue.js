/**
 * Background Job Queue abstraction (BullMQ with in-process fallback).
 *
 * If Redis is active and BullMQ is installed, jobs are queued and processed
 * asynchronously in background workers. Otherwise, jobs execute asynchronously
 * in-process via setImmediate/Promise, ensuring seamless operation across local dev,
 * CI/test, and production container environments.
 */
const { isRedisConnected, redisClient } = require('../config/redis');

let Queue = null;
let Worker = null;

try {
  const bullmq = require('bullmq');
  Queue = bullmq.Queue;
  Worker = bullmq.Worker;
} catch (err) {
  // BullMQ not loaded or optional
}

const queues = {};
const localJobHandlers = {};

/**
 * Creates or gets a BullMQ queue or in-memory runner.
 * @param {string} queueName
 */
function getQueue(queueName) {
  if (queues[queueName]) return queues[queueName];

  if (isRedisConnected() && Queue && redisClient) {
    try {
      const bullQueue = new Queue(queueName, {
        connection: redisClient,
      });
      queues[queueName] = {
        add: async (jobName, data) => bullQueue.add(jobName, data),
        bullQueue,
      };
      return queues[queueName];
    } catch (e) {
      // fallback to in-memory below
    }
  }

  // Fallback in-process runner
  queues[queueName] = {
    add: async (jobName, data) => {
      setImmediate(async () => {
        try {
          const handler = localJobHandlers[`${queueName}:${jobName}`] || localJobHandlers[queueName];
          if (handler) {
            await handler({ name: jobName, data });
          }
        } catch (err) {
          console.error(`Background job error (${queueName}:${jobName}):`, err.message);
        }
      });
      return { id: `local_${Date.now()}` };
    },
  };

  return queues[queueName];
}

/**
 * Registers a worker for a queue.
 * @param {string} queueName
 * @param {Function} processor - async function(job)
 */
function registerWorker(queueName, processor) {
  localJobHandlers[queueName] = processor;

  if (isRedisConnected() && Worker && redisClient) {
    try {
      new Worker(queueName, processor, {
        connection: redisClient,
      });
    } catch (err) {
      // in-memory handler already registered
    }
  }
}

// Predefined queues
const DUPLICATE_QUEUE_NAME = 'duplicate-detection';

const duplicateQueue = {
  enqueueDuplicateCheck: async (memberId) => {
    const q = getQueue(DUPLICATE_QUEUE_NAME);
    return q.add('check-member-duplicates', { memberId });
  },
  enqueueFullScan: async () => {
    const q = getQueue(DUPLICATE_QUEUE_NAME);
    return q.add('scan-all-duplicates', {});
  },
};

module.exports = {
  getQueue,
  registerWorker,
  duplicateQueue,
  DUPLICATE_QUEUE_NAME,
};
