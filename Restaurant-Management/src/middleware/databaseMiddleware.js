// src/middleware/databaseMiddleware.js
import { checkDatabaseHealth, getDatabaseClient } from "../utils/database.js";
import logger from "../utils/logger.js";
import { responseHandler } from "../utils/response.js";

/**
 * Middleware to ensure database is ready before processing requests
 */
export const ensureDatabaseReady = async (req, res, next) => {
  try {
    // Check if database client is initialized
    const client = getDatabaseClient();

    if (!client) {
      logger.error("Database client not initialized");
      return responseHandler.error(
        res,
        "Service temporarily unavailable. Please try again later.",
        503,
        "DATABASE_NOT_INITIALIZED"
      );
    }

    // Quick health check
    const health = await checkDatabaseHealth();

    if (health.status !== "healthy") {
      logger.error("Database health check failed", { health });
      return responseHandler.error(
        res,
        "Service temporarily unavailable. Please try again later.",
        503,
        "DATABASE_UNHEALTHY"
      );
    }

    // Attach database client to request for convenience
    req.db = client;

    next();
  } catch (error) {
    logger.error("Database middleware check failed", {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    return responseHandler.error(
      res,
      "Service temporarily unavailable. Please try again later.",
      503,
      "DATABASE_CONNECTION_ERROR"
    );
  }
};

/**
 * Lightweight database check middleware (for high-frequency endpoints)
 */
export const lightDatabaseCheck = (req, res, next) => {
  try {
    const client = getDatabaseClient();

    if (!client) {
      return responseHandler.error(
        res,
        "Service temporarily unavailable.",
        503,
        "DATABASE_NOT_AVAILABLE"
      );
    }

    req.db = client;
    next();
  } catch (error) {
    logger.error("Light database check failed", {
      error: error.message,
      path: req.path,
    });

    return responseHandler.error(
      res,
      "Service temporarily unavailable.",
      503,
      "DATABASE_ERROR"
    );
  }
};

/**
 * Database transaction middleware
 */
export const withTransaction = (req, res, next) => {
  req.transaction = async (operations) => {
    const client = req.db || getDatabaseClient();
    return await client.$transaction(operations);
  };
  next();
};
