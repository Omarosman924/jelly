import App from "./app.js";
import logger from "./src/utils/logger.js";

/**
 * Bootstrap the application
 */
async function bootstrap() {
  try {
    // Create app instance
    const app = new App();

    // Start the application
    await app.start();

    logger.info("🎉 Application started successfully!");
  } catch (error) {
    logger.error("💥 Failed to start application:", error);
    process.exit(1);
  }
}

// Start the application
bootstrap();
