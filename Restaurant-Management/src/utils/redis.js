import Redis from "ioredis";
import logger from "./logger.js";

class RedisManager {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.isConnected = false;
    this.fallbackMode = false;
    this.fallbackStorage = new Map();
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.reconnectDelay = 1000;
  }

  /**
   * Get Redis configuration from environment variables
   */
  getRedisConfig() {
    const baseConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        logger.warn("Redis reconnecting on error", { error: err.message });
        const targetError = "READONLY";
        return err.message.includes(targetError);
      },
    };

    // Use Redis URL if provided (overrides individual settings)
    if (process.env.REDIS_URL) {
      try {
        const url = new URL(process.env.REDIS_URL);
        const urlConfig = {
          ...baseConfig,
          host: url.hostname,
          port: parseInt(url.port) || 6379,
          password: url.password || null,
        };

        // Extract database number from URL path
        if (url.pathname && url.pathname.length > 1) {
          const dbNumber = parseInt(url.pathname.slice(1));
          if (!isNaN(dbNumber)) {
            urlConfig.db = dbNumber;
          }
        }

        return urlConfig;
      } catch (error) {
        logger.error(
          "Invalid REDIS_URL format, falling back to individual settings",
          {
            error: error.message,
          }
        );
        return baseConfig;
      }
    }

    return baseConfig;
  }

  /**
   * Connect to Redis with connection retry logic
   */
  async connect() {
    if (this.isConnected && this.client) {
      return this.client;
    }

    try {
      const config = this.getRedisConfig();

      // Create Redis clients if they don't exist
      if (!this.client) {
        this.client = new Redis(config);
        this.subscriber = new Redis(config);
        this.publisher = new Redis(config);

        // Setup event listeners
        this.setupEventListeners();
      }

      // Wait for connection to be ready
      if (this.client.status !== "ready") {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Redis connection timeout"));
          }, config.connectTimeout);

          this.client.once("ready", () => {
            clearTimeout(timeout);
            resolve();
          });

          this.client.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }

      this.isConnected = true;
      this.fallbackMode = false;
      this.connectionAttempts = 0;

      logger.info("Redis connected successfully", {
        host: config.host,
        port: config.port,
        db: config.db,
        status: this.client.status,
      });

      return this.client;
    } catch (error) {
      this.connectionAttempts++;
      logger.error("Redis connection failed", {
        error: error.message,
        attempt: this.connectionAttempts,
        maxAttempts: this.maxConnectionAttempts,
      });

      // Enable fallback mode if max attempts exceeded
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        this.enableFallbackMode();
      }

      throw error;
    }
  }

  /**
   * Connect with automatic fallback to in-memory storage
   */
  async connectWithFallback() {
    try {
      await this.connect();
      return this.client;
    } catch (error) {
      logger.warn("Redis connection failed, enabling fallback mode", {
        error: error.message,
      });
      this.enableFallbackMode();
      return null;
    }
  }

  /**
   * Enable fallback mode (in-memory storage)
   */
  enableFallbackMode() {
    this.fallbackMode = true;
    this.isConnected = false;
    this.fallbackStorage = new Map();

    logger.warn("Redis fallback mode enabled - using in-memory storage", {
      note: "Data will not persist across server restarts",
    });
  }

  /**
   * Setup event listeners for Redis clients
   */
  setupEventListeners() {
    // Main client events
    this.client.on("connect", () => {
      logger.info("Redis client connected");
    });

    this.client.on("ready", () => {
      logger.info("Redis client ready");
      this.isConnected = true;
      this.fallbackMode = false;
    });

    this.client.on("error", (error) => {
      logger.error("Redis client error", {
        error: error.message,
        code: error.code,
      });
      this.isConnected = false;

      // Enable fallback mode on persistent errors
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        this.enableFallbackMode();
      }
    });

    this.client.on("close", () => {
      logger.warn("Redis client connection closed");
      this.isConnected = false;
    });

    this.client.on("reconnecting", (ms) => {
      logger.info(`Redis client reconnecting in ${ms}ms`);
    });

    this.client.on("end", () => {
      logger.warn("Redis client connection ended");
      this.isConnected = false;
    });

    // Subscriber events
    this.subscriber.on("error", (error) => {
      logger.error("Redis subscriber error", {
        error: error.message,
      });
    });

    this.subscriber.on("connect", () => {
      logger.debug("Redis subscriber connected");
    });

    // Publisher events
    this.publisher.on("error", (error) => {
      logger.error("Redis publisher error", {
        error: error.message,
      });
    });

    this.publisher.on("connect", () => {
      logger.debug("Redis publisher connected");
    });
  }

  /**
   * Get Redis client with fallback handling
   */
  getClient() {
    if (this.fallbackMode) {
      throw new Error(
        "Redis is in fallback mode - operations should use fallback methods"
      );
    }

    if (!this.client || !this.isConnected) {
      throw new Error("Redis client not connected");
    }

    return this.client;
  }

  /**
   * Set value with expiration (with fallback support)
   */
  async set(key, value, ttl = null) {
    try {
      if (this.fallbackMode) {
        return this.fallbackSet(key, value, ttl);
      }

      const client = this.getClient();
      const serializedValue =
        typeof value === "object" ? JSON.stringify(value) : String(value);

      if (ttl) {
        return await client.setex(key, ttl, serializedValue);
      } else {
        return await client.set(key, serializedValue);
      }
    } catch (error) {
      logger.error("Redis SET operation failed", {
        key,
        error: error.message,
      });

      // Fallback to in-memory storage on error
      if (!this.fallbackMode) {
        logger.warn("Falling back to in-memory storage for SET operation");
        this.enableFallbackMode();
        return this.fallbackSet(key, value, ttl);
      }

      throw error;
    }
  }

  /**
   * Get value from Redis (with fallback support)
   */
  async get(key) {
    try {
      if (this.fallbackMode) {
        return this.fallbackGet(key);
      }

      const client = this.getClient();
      const value = await client.get(key);

      if (value === null) return null;

      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error("Redis GET operation failed", {
        key,
        error: error.message,
      });

      // Fallback to in-memory storage on error
      if (!this.fallbackMode) {
        logger.warn("Falling back to in-memory storage for GET operation");
        this.enableFallbackMode();
        return this.fallbackGet(key);
      }

      throw error;
    }
  }

  /**
   * Delete key from Redis (with fallback support)
   */
  async del(key) {
    try {
      if (this.fallbackMode) {
        return this.fallbackDel(key);
      }

      const client = this.getClient();
      return await client.del(key);
    } catch (error) {
      logger.error("Redis DEL operation failed", {
        key,
        error: error.message,
      });

      // Fallback to in-memory storage on error
      if (!this.fallbackMode) {
        this.enableFallbackMode();
        return this.fallbackDel(key);
      }

      throw error;
    }
  }

  /**
   * Check if key exists (with fallback support)
   */
  async exists(key) {
    try {
      if (this.fallbackMode) {
        return this.fallbackStorage.has(key) ? 1 : 0;
      }

      const client = this.getClient();
      return await client.exists(key);
    } catch (error) {
      logger.error("Redis EXISTS operation failed", {
        key,
        error: error.message,
      });

      if (!this.fallbackMode) {
        this.enableFallbackMode();
        return this.fallbackStorage.has(key) ? 1 : 0;
      }

      throw error;
    }
  }

  /**
   * Set expiration for key (with fallback support)
   */
  async expire(key, seconds) {
    try {
      if (this.fallbackMode) {
        return this.fallbackExpire(key, seconds);
      }

      const client = this.getClient();
      return await client.expire(key, seconds);
    } catch (error) {
      logger.error("Redis EXPIRE operation failed", {
        key,
        seconds,
        error: error.message,
      });

      if (!this.fallbackMode) {
        this.enableFallbackMode();
        return this.fallbackExpire(key, seconds);
      }

      throw error;
    }
  }

  /**
   * Increment counter (with fallback support)
   */
  async incr(key) {
    try {
      if (this.fallbackMode) {
        return this.fallbackIncr(key);
      }

      const client = this.getClient();
      return await client.incr(key);
    } catch (error) {
      logger.error("Redis INCR operation failed", {
        key,
        error: error.message,
      });

      if (!this.fallbackMode) {
        this.enableFallbackMode();
        return this.fallbackIncr(key);
      }

      throw error;
    }
  }

  /**
   * Hash operations (with fallback support)
   */
  async hset(key, field, value) {
    try {
      if (this.fallbackMode) {
        return this.fallbackHset(key, field, value);
      }

      const client = this.getClient();
      const serializedValue =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      return await client.hset(key, field, serializedValue);
    } catch (error) {
      logger.error("Redis HSET operation failed", {
        key,
        field,
        error: error.message,
      });

      if (!this.fallbackMode) {
        this.enableFallbackMode();
        return this.fallbackHset(key, field, value);
      }

      throw error;
    }
  }

  async hget(key, field) {
    try {
      if (this.fallbackMode) {
        return this.fallbackHget(key, field);
      }

      const client = this.getClient();
      const value = await client.hget(key, field);

      if (value === null) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error("Redis HGET operation failed", {
        key,
        field,
        error: error.message,
      });

      if (!this.fallbackMode) {
        this.enableFallbackMode();
        return this.fallbackHget(key, field);
      }

      throw error;
    }
  }

  /**
   * List operations (with fallback support)
   */
  async lpush(key, ...values) {
    try {
      if (this.fallbackMode) {
        return this.fallbackLpush(key, ...values);
      }

      const client = this.getClient();
      const serializedValues = values.map((v) =>
        typeof v === "object" ? JSON.stringify(v) : String(v)
      );
      return await client.lpush(key, ...serializedValues);
    } catch (error) {
      logger.error("Redis LPUSH operation failed", {
        key,
        error: error.message,
      });

      if (!this.fallbackMode) {
        this.enableFallbackMode();
        return this.fallbackLpush(key, ...values);
      }

      throw error;
    }
  }

  async rpop(key) {
    try {
      if (this.fallbackMode) {
        return this.fallbackRpop(key);
      }

      const client = this.getClient();
      const value = await client.rpop(key);

      if (value === null) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error("Redis RPOP operation failed", {
        key,
        error: error.message,
      });

      if (!this.fallbackMode) {
        this.enableFallbackMode();
        return this.fallbackRpop(key);
      }

      throw error;
    }
  }

  /**
   * Publish message to channel
   */
  async publish(channel, message) {
    try {
      if (this.fallbackMode) {
        logger.warn("PubSub not available in fallback mode", { channel });
        return 0;
      }

      const serializedMessage =
        typeof message === "object" ? JSON.stringify(message) : String(message);
      return await this.publisher.publish(channel, serializedMessage);
    } catch (error) {
      logger.error("Redis PUBLISH operation failed", {
        channel,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel, callback) {
    try {
      if (this.fallbackMode) {
        logger.warn("PubSub not available in fallback mode", { channel });
        return;
      }

      await this.subscriber.subscribe(channel);

      this.subscriber.on("message", (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const parsedMessage = JSON.parse(message);
            callback(parsedMessage);
          } catch {
            callback(message);
          }
        }
      });
    } catch (error) {
      logger.error("Redis SUBSCRIBE operation failed", {
        channel,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo() {
    try {
      if (this.fallbackMode) {
        return "# Fallback mode - Redis not available";
      }

      const client = this.getClient();
      return await client.info();
    } catch (error) {
      logger.error("Redis INFO operation failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (this.fallbackMode) {
        return {
          status: "fallback",
          mode: "in-memory",
          responseTime: "N/A",
          isConnected: false,
          timestamp: new Date().toISOString(),
        };
      }

      const client = this.getClient();
      const startTime = Date.now();

      await client.ping();

      const duration = Date.now() - startTime;

      return {
        status: "healthy",
        mode: "redis",
        responseTime: `${duration}ms`,
        isConnected: this.isConnected,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Redis health check failed", {
        error: error.message,
      });

      return {
        status: "unhealthy",
        mode: this.fallbackMode ? "fallback" : "redis",
        error: error.message,
        isConnected: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Fallback methods (in-memory storage)
   */
  fallbackSet(key, value, ttl = null) {
    const entry = {
      value: typeof value === "object" ? JSON.stringify(value) : value,
      expiresAt: ttl ? Date.now() + ttl * 1000 : null,
    };

    this.fallbackStorage.set(key, entry);

    // Set expiration cleanup
    if (ttl) {
      setTimeout(() => {
        const stored = this.fallbackStorage.get(key);
        if (stored && stored.expiresAt <= Date.now()) {
          this.fallbackStorage.delete(key);
        }
      }, ttl * 1000);
    }

    return "OK";
  }

  fallbackGet(key) {
    const entry = this.fallbackStorage.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.fallbackStorage.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value);
    } catch {
      return entry.value;
    }
  }

  fallbackDel(key) {
    const existed = this.fallbackStorage.has(key);
    this.fallbackStorage.delete(key);
    return existed ? 1 : 0;
  }

  fallbackExpire(key, seconds) {
    const entry = this.fallbackStorage.get(key);
    if (!entry) return 0;

    entry.expiresAt = Date.now() + seconds * 1000;
    this.fallbackStorage.set(key, entry);

    setTimeout(() => {
      const stored = this.fallbackStorage.get(key);
      if (stored && stored.expiresAt <= Date.now()) {
        this.fallbackStorage.delete(key);
      }
    }, seconds * 1000);

    return 1;
  }

  fallbackIncr(key) {
    const entry = this.fallbackStorage.get(key);
    let current = 0;

    if (entry) {
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        this.fallbackStorage.delete(key);
      } else {
        current = parseInt(entry.value) || 0;
      }
    }

    const newValue = current + 1;
    this.fallbackStorage.set(key, {
      value: String(newValue),
      expiresAt: entry?.expiresAt || null,
    });
    return newValue;
  }

  fallbackHset(key, field, value) {
    let hash = this.fallbackStorage.get(key);
    if (!hash || typeof hash.value !== "object") {
      hash = { value: {}, expiresAt: null };
    } else {
      hash.value = JSON.parse(hash.value);
    }

    hash.value[field] =
      typeof value === "object" ? JSON.stringify(value) : value;
    this.fallbackStorage.set(key, {
      value: JSON.stringify(hash.value),
      expiresAt: hash.expiresAt,
    });
    return 1;
  }

  fallbackHget(key, field) {
    const entry = this.fallbackStorage.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.fallbackStorage.delete(key);
      return null;
    }

    try {
      const hash = JSON.parse(entry.value);
      const value = hash[field];
      if (value === undefined) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch {
      return null;
    }
  }

  fallbackLpush(key, ...values) {
    let entry = this.fallbackStorage.get(key);
    let list = [];

    if (entry) {
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        this.fallbackStorage.delete(key);
      } else {
        try {
          list = JSON.parse(entry.value);
        } catch {
          list = [];
        }
      }
    }

    const serializedValues = values.map((v) =>
      typeof v === "object" ? JSON.stringify(v) : String(v)
    );
    list.unshift(...serializedValues);

    this.fallbackStorage.set(key, {
      value: JSON.stringify(list),
      expiresAt: entry?.expiresAt || null,
    });

    return list.length;
  }

  fallbackRpop(key) {
    const entry = this.fallbackStorage.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.fallbackStorage.delete(key);
      return null;
    }

    try {
      const list = JSON.parse(entry.value);
      if (!Array.isArray(list) || list.length === 0) return null;

      const value = list.pop();
      this.fallbackStorage.set(key, {
        value: JSON.stringify(list),
        expiresAt: entry.expiresAt,
      });

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch {
      return null;
    }
  }

  /**
   * Cache middleware functionality
   */
  cache(ttl = 3600) {
    return {
      get: async (key) => {
        return await this.get(`cache:${key}`);
      },

      set: async (key, value, customTtl = ttl) => {
        return await this.set(`cache:${key}`, value, customTtl);
      },

      del: async (key) => {
        return await this.del(`cache:${key}`);
      },

      wrap: async (key, fn, customTtl = ttl) => {
        const cacheKey = `cache:${key}`;
        let value = await this.get(cacheKey);

        if (value === null) {
          value = await fn();
          if (value !== null && value !== undefined) {
            await this.set(cacheKey, value, customTtl);
          }
        }

        return value;
      },
    };
  }

  /**
   * Session management
   */
  session(ttl = 86400) {
    return {
      get: async (sessionId) => {
        return await this.get(`session:${sessionId}`);
      },

      set: async (sessionId, data, customTtl = ttl) => {
        return await this.set(`session:${sessionId}`, data, customTtl);
      },

      del: async (sessionId) => {
        return await this.del(`session:${sessionId}`);
      },

      extend: async (sessionId, customTtl = ttl) => {
        return await this.expire(`session:${sessionId}`, customTtl);
      },
    };
  }

  /**
   * Rate limiting functionality
   */
  rateLimit(windowMs = 900000, maxRequests = 100) {
    return {
      check: async (key) => {
        const now = Date.now();
        const window = Math.floor(now / windowMs);
        const rateLimitKey = `rate_limit:${key}:${window}`;

        const current = await this.incr(rateLimitKey);

        if (current === 1) {
          await this.expire(rateLimitKey, Math.ceil(windowMs / 1000));
        }

        return {
          count: current,
          remaining: Math.max(0, maxRequests - current),
          resetTime: (window + 1) * windowMs,
          exceeded: current > maxRequests,
        };
      },
    };
  }

  /**
   * Flush database (careful with this in production!)
   */
  async flushdb() {
    try {
      if (this.fallbackMode) {
        this.fallbackStorage.clear();
        return "OK";
      }

      const client = this.getClient();
      return await client.flushdb();
    } catch (error) {
      logger.error("Redis FLUSHDB operation failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern = "*") {
    try {
      if (this.fallbackMode) {
        const allKeys = Array.from(this.fallbackStorage.keys());
        if (pattern === "*") return allKeys;

        // Simple pattern matching for fallback mode
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return allKeys.filter((key) => regex.test(key));
      }

      const client = this.getClient();
      return await client.keys(pattern);
    } catch (error) {
      logger.error("Redis KEYS operation failed", {
        pattern,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.disconnect();
      }
      if (this.subscriber) {
        await this.subscriber.disconnect();
      }
      if (this.publisher) {
        await this.publisher.disconnect();
      }

      this.isConnected = false;
      this.client = null;
      this.subscriber = null;
      this.publisher = null;

      logger.info("Redis disconnected successfully");
    } catch (error) {
      logger.error("Redis disconnection failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get connection status
   */
  get status() {
    if (this.fallbackMode) return "fallback";
    if (!this.client) return "not_initialized";
    return this.client.status;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      fallbackMode: this.fallbackMode,
      connectionAttempts: this.connectionAttempts,
      fallbackStorageSize: this.fallbackStorage ? this.fallbackStorage.size : 0,
      status: this.status,
    };
  }
}

// Create and export singleton instance
const redisClient = new RedisManager();

export default redisClient;
