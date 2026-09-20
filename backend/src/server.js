require('dotenv').config({ quiet: true });

const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { initDuplicateWorker } = require('./jobs/duplicateWorker');

const PORT = process.env.PORT || 5000;

async function start() {
  // Fail fast and loudly if PostgreSQL is unreachable, rather than serving
  // requests that will all error at the database layer.
  await connectDatabase();
  console.log('Connected to PostgreSQL');

  // Initialize background queues / workers
  initDuplicateWorker();

  const server = app.listen(PORT, () => {
    console.log(`Family Identity Platform API listening on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
