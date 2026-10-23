import app from './app.js';
import config from './core/config.js';

const PORT = config.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 ITIMS Node.js Backend listening on port ${PORT}`);
  console.log(`📡 Environment: ${config.NODE_ENV}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log('====================================================');
});

// Graceful shutdown handling
const handleShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
  server.close(() => {
    console.log('✅ Server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default server;
