require('dotenv').config();

const app = require('./src/app');
const { testConnection } = require('./src/config/db');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;

async function start() {
  // Test DB connection before starting
  await testConnection();

  app.listen(PORT, () => {
    logger.info(`🚀 Chronologicon Engine running on http://localhost:${PORT}`);
    logger.info(`📖 Health check: http://localhost:${PORT}/health`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

