import { PrismaClient } from "@prisma/client";
import logger from "./logger.js";

// Global variable to hold the Prisma client instance
let prisma;

/**
 * Create Prisma client with configuration
 */
function createPrismaClient() {
  const prismaOptions = {
    log: [
      {
        emit: "event",
        level: "query",
      },
      {
        emit: "event",
        level: "error",
      },
      {
        emit: "event",
        level: "info",
      },
      {
        emit: "event",
        level: "warn",
      },
    ],
    errorFormat: "pretty",
  };

  // Add datasource configuration for different environments
  if (process.env.DATABASE_URL) {
    prismaOptions.datasources = {
      db: {
        url: process.env.DATABASE_URL,
      },
    };
  }

  const client = new PrismaClient(prismaOptions);

  // Set up event listeners for logging
  client.$on("query", (e) => {
    if (process.env.NODE_ENV === "development") {
      logger.debug("Database Query", {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
        timestamp: e.timestamp,
      });
    }
  });

  client.$on("error", (e) => {
    logger.error("Database Error", {
      target: e.target,
      timestamp: e.timestamp,
      message: e.message,
    });
  });

  client.$on("info", (e) => {
    logger.info("Database Info", {
      target: e.target,
      timestamp: e.timestamp,
      message: e.message,
    });
  });

  client.$on("warn", (e) => {
    logger.warn("Database Warning", {
      target: e.target,
      timestamp: e.timestamp,
      message: e.message,
    });
  });

  return client;
}

/**
 * Connect to database
 */
export async function connectDatabase() {
  try {
    if (!prisma) {
      prisma = createPrismaClient();
    }

    // Test the connection
    await prisma.$connect();

    // Verify connection with a simple query
    await prisma.$queryRaw`SELECT 1`;

    logger.info("Database connected successfully", {
      provider: "postgresql",
      url:
        process.env.DATABASE_URL?.replace(/:[^:]*@/, ":***@") || "Not provided",
    });

    return prisma;
  } catch (error) {
    logger.error("Database connection failed", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase() {
  try {
    if (prisma) {
      await prisma.$disconnect();
      prisma = null;
      logger.info("Database disconnected successfully");
    }
  } catch (error) {
    logger.error("Database disconnection failed", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get database client instance
 */
export function getDatabaseClient() {
  if (!prisma) {
    throw new Error(
      "Database client not initialized. Call connectDatabase() first."
    );
  }
  return prisma;
}

/**
 * Execute database transaction
 */
export async function executeTransaction(operations) {
  const client = getDatabaseClient();

  try {
    const startTime = Date.now();

    const result = await client.$transaction(operations);

    const duration = Date.now() - startTime;
    logger.logPerformance("database_transaction", duration, {
      operationsCount: operations.length,
    });

    return result;
  } catch (error) {
    logger.error("Database transaction failed", {
      error: error.message,
      stack: error.stack,
      operationsCount: operations.length,
    });
    throw error;
  }
}

/**
 * Health check for database
 */
export async function checkDatabaseHealth() {
  try {
    const client = getDatabaseClient();
    const startTime = Date.now();

    // Simple health check query
    await client.$queryRaw`SELECT 1 as health_check`;

    const duration = Date.now() - startTime;

    return {
      status: "healthy",
      responseTime: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Database health check failed", {
      error: error.message,
    });

    return {
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  try {
    const client = getDatabaseClient();

    // Get table counts
    const stats = await client.$queryRaw`
            SELECT 
                schemaname,
                tablename,
                n_tup_ins as inserts,
                n_tup_upd as updates,
                n_tup_del as deletes,
                n_live_tup as live_tuples,
                n_dead_tup as dead_tuples
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC;
        `;

    // Get database size
    const sizeResult = await client.$queryRaw`
            SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
        `;

    // Get connection count
    const connectionsResult = await client.$queryRaw`
            SELECT count(*) as connection_count 
            FROM pg_stat_activity 
            WHERE state = 'active';
        `;

    return {
      tables: stats,
      databaseSize: sizeResult[0]?.database_size,
      activeConnections: parseInt(connectionsResult[0]?.connection_count) || 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Failed to get database stats", {
      error: error.message,
    });
    return null;
  }
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanupDatabase() {
  try {
    await disconnectDatabase();
    logger.info("Database cleanup completed");
  } catch (error) {
    logger.error("Database cleanup failed", {
      error: error.message,
    });
  }
}

/**
 * Middleware for automatic database client injection
 */
export function injectDatabaseClient(req, res, next) {
  req.db = getDatabaseClient();
  next();
}

// Export the prisma client getter as default
export default getDatabaseClient;
