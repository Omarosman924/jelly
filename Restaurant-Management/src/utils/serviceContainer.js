// src/utils/serviceContainer.js - Enhanced Version
import { getDatabaseClient, disconnectDatabase } from "./database.js";
import redisClient from "./redis.js";
import logger from "./logger.js";

// Import service classes (not instances)
import StaffService from "../modules/staff/staff.service.js";
import CustomerService from "../modules/customers/customers.service.js";
// Add other services as needed

/**
 * Enhanced Service Container
 * Manages service lifecycle with proper singleton pattern
 */
class ServiceContainer {
  constructor() {
    this.serviceClasses = new Map();
    this.serviceInstances = new Map();
    this.isInitialized = false;
    this.startTime = Date.now();
  }

  /**
   * Initialize service container
   */
  async initialize() {
    try {
      logger.info("🔧 Initializing enhanced service container...");

      // Ensure database is ready
      const db = getDatabaseClient();
      if (!db) {
        throw new Error("Database client not available");
      }

      // Ensure Redis is ready (with fallback)
      try {
        await redisClient.connectWithFallback();
      } catch (error) {
        logger.warn("Redis connection failed, continuing with fallback", {
          error: error.message,
        });
      }

      // Register service classes (not instances)
      this.registerServices();

      this.isInitialized = true;
      const initTime = Date.now() - this.startTime;
      logger.info(
        `✅ Service container initialized successfully in ${initTime}ms`
      );
    } catch (error) {
      logger.error(
        "❌ Service container initialization failed:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Register all service classes
   */
  registerServices() {
    // Register service classes
    this.serviceClasses.set("staffService", StaffService);
    this.serviceClasses.set("customerService", CustomerService);

    // Register other services dynamically
    this.registerDynamicServices();

    logger.info(`📦 Registered ${this.serviceClasses.size} service classes`);
  }

  /**
   * Register services dynamically (lazy loading)
   */
  registerDynamicServices() {
    const serviceMap = {
      userService: () => require("../modules/users/users.service.js").default,
      orderService: () =>
        require("../modules/orders/orders.service.js").default,
      menuService: () => require("../modules/menu/menu.service.js").default,
      inventoryService: () =>
        require("../modules/inventory/inventory.service.js").default,
      partyService: () =>
        require("../modules/parties/parties.service.js").default,
      paymentService: () =>
        require("../modules/payments/payments.service.js").default,
    };

    for (const [name, loader] of Object.entries(serviceMap)) {
      this.serviceClasses.set(name, loader);
    }
  }

  /**
   * Get service instance (lazy instantiation with caching)
   */
  get(serviceName) {
    if (!this.isInitialized) {
      throw new Error(
        "Service container not initialized. Call initialize() first."
      );
    }

    // Return cached instance if exists
    if (this.serviceInstances.has(serviceName)) {
      return this.serviceInstances.get(serviceName);
    }

    // Get service class
    const ServiceClass = this.serviceClasses.get(serviceName);
    if (!ServiceClass) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    try {
      // Handle lazy loading
      let service;
      if (typeof ServiceClass === "function" && ServiceClass.length === 0) {
        // It's a loader function
        try {
          const LoadedClass = ServiceClass();
          service = new LoadedClass();
        } catch (error) {
          logger.error(`Failed to load service '${serviceName}'`, {
            error: error.message,
          });
          throw new Error(
            `Failed to load service '${serviceName}': ${error.message}`
          );
        }
      } else {
        // It's a class, instantiate it
        service = new ServiceClass();
      }

      // Cache the instance
      this.serviceInstances.set(serviceName, service);

      logger.debug(`Service '${serviceName}' instantiated and cached`);

      return service;
    } catch (error) {
      logger.error(`Failed to instantiate service '${serviceName}'`, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if service exists
   */
  has(serviceName) {
    return this.serviceClasses.has(serviceName);
  }

  /**
   * Get all service names
   */
  getServiceNames() {
    return Array.from(this.serviceClasses.keys());
  }

  /**
   * Get service instance count
   */
  getInstanceCount() {
    return this.serviceInstances.size;
  }

  /**
   * Reload specific service
   */
  reload(serviceName) {
    if (this.serviceInstances.has(serviceName)) {
      logger.info(`Reloading service '${serviceName}'`);
      this.serviceInstances.delete(serviceName);
    }
  }

  /**
   * Cleanup specific service
   */
  async cleanupService(serviceName) {
    try {
      const service = this.serviceInstances.get(serviceName);

      if (service && typeof service.cleanup === "function") {
        await service.cleanup();
        logger.info(`✅ Service '${serviceName}' cleaned up`);
      }

      this.serviceInstances.delete(serviceName);
    } catch (error) {
      logger.error(
        `❌ Error cleaning up service '${serviceName}':`,
        error.message
      );
    }
  }

  /**
   * Cleanup all services
   */
  async cleanup() {
    try {
      logger.info("🧹 Starting service cleanup...");

      // Cleanup all service instances
      const cleanupPromises = [];
      for (const [serviceName, service] of this.serviceInstances) {
        if (typeof service.cleanup === "function") {
          cleanupPromises.push(
            this.cleanupService(serviceName).catch((error) => {
              logger.error(`Cleanup failed for ${serviceName}:`, error.message);
            })
          );
        }
      }

      await Promise.all(cleanupPromises);

      // Cleanup Redis
      try {
        if (redisClient && typeof redisClient.disconnect === "function") {
          await redisClient.disconnect();
          logger.info("✅ Redis disconnected");
        }
      } catch (error) {
        logger.error("❌ Error disconnecting Redis:", error.message);
      }

      // Cleanup Database
      try {
        await disconnectDatabase();
        logger.info("✅ Database disconnected");
      } catch (error) {
        logger.error("❌ Error disconnecting database:", error.message);
      }

      // Clear all caches
      this.serviceInstances.clear();
      this.isInitialized = false;

      logger.info("✅ Service cleanup completed");
    } catch (error) {
      logger.error("❌ Service cleanup failed:", error.message);
      throw error;
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck() {
    const health = {
      status: "healthy",
      services: {},
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };

    try {
      // Check database
      try {
        const db = getDatabaseClient();
        await db.$queryRaw`SELECT 1`;
        health.services.database = { status: "healthy" };
      } catch (error) {
        health.services.database = {
          status: "unhealthy",
          error: error.message,
        };
        health.status = "degraded";
      }

      // Check Redis
      const redisHealth = await redisClient.healthCheck();
      health.services.redis = redisHealth;
      if (redisHealth.status !== "healthy") {
        health.status = "degraded";
      }

      // Check instantiated services
      health.services.instantiated = {
        count: this.serviceInstances.size,
        services: Array.from(this.serviceInstances.keys()),
      };

      return health;
    } catch (error) {
      logger.error("Health check failed", { error: error.message });
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get container statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      registeredServices: this.serviceClasses.size,
      instantiatedServices: this.serviceInstances.size,
      availableServices: this.getServiceNames(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Force reload all services (development only)
   */
  async reloadAll() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Reload all is not allowed in production");
    }

    logger.warn("Reloading all services (development mode)");

    // Cleanup existing instances
    await this.cleanup();

    // Clear require cache for service modules
    Object.keys(require.cache).forEach((key) => {
      if (key.includes("/modules/") && key.includes(".service.js")) {
        delete require.cache[key];
      }
    });

    // Re-initialize
    await this.initialize();

    logger.info("All services reloaded successfully");
  }
}

// Export singleton instance
export default ServiceContainer;
