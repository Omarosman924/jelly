// src/utils/baseService.js
import { getDatabaseClient } from "./database.js";
import redisClient from "./redis.js";
import logger from "./logger.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * Base Service Class
 * Provides common functionality for all service classes
 */
export class BaseService {
  constructor() {
    this._db = null;
    this._cache = null;
  }

  /**
   * Get database client with lazy loading
   */
  get db() {
    if (!this._db) {
      try {
        this._db = getDatabaseClient();
        if (!this._db) {
          throw new AppError("Database not available", 503);
        }
      } catch (error) {
        logger.error("Failed to get database client", {
          service: this.constructor.name,
          error: error.message,
        });
        throw new AppError("Database connection failed", 503);
      }
    }
    return this._db;
  }

  /**
   * Get cache client with lazy loading
   */
  get cache() {
    if (!this._cache) {
      try {
        this._cache = redisClient.cache(1800); // 30 minutes default
      } catch (error) {
        logger.warn("Cache not available, continuing without cache", {
          service: this.constructor.name,
          error: error.message,
        });
        // Return mock cache that does nothing
        this._cache = {
          get: async () => null,
          set: async () => null,
          del: async () => null,
        };
      }
    }
    return this._cache;
  }

  /**
   * Execute database transaction
   */
  async executeTransaction(callback) {
    try {
      return await this.db.$transaction(callback);
    } catch (error) {
      logger.error("Transaction failed", {
        service: this.constructor.name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clear cache for specific key
   */
  async clearCache(key) {
    try {
      await this.cache.del(key);
    } catch (error) {
      logger.warn("Failed to clear cache", {
        service: this.constructor.name,
        key,
        error: error.message,
      });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this._db = null;
    this._cache = null;
    logger.debug(`${this.constructor.name} cleaned up`);
  }
}

export default BaseService;
