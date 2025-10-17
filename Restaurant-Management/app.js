import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import morgan from "morgan";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

// Utils
import { responseHandler } from "./src/utils/response.js";
import redisClient from "./src/utils/redis.js";
import logger from "./src/utils/logger.js";
import { connectDatabase, checkDatabaseHealth } from "./src/utils/database.js";

// Middleware
import { errorHandler } from "./src/middleware/errorHandler.js";
import { authMiddleware } from "./src/middleware/authMiddleware.js";
import { requestLogger } from "./src/middleware/requestLogger.js";

// Routes - يمكن استيرادها بشكل عادي
import authRoutes from "./src/modules/auth/auth.routes.js";
import emailAuthRoutes from "./src/modules/auth/emailAuth.routes.js";
import categoryRoutes from "./src/modules/categories/categories.routes.js";
import userRoutes from "./src/modules/users/users.routes.js";
import staffRoutes from "./src/modules/staff/staff.routes.js";
import customerRoutes from "./src/modules/customers/customers.routes.js";
import inventoryRoutes from "./src/modules/inventory/inventory.routes.js";
import menuRoutes from "./src/modules/menu/menu.routes.js";
import orderRoutes from "./src/modules/orders/orders.routes.js";
import partyRoutes from "./src/modules/parties/parties.routes.js";
import paymentRoutes from "./src/modules/payments/payments.routes.js";
import tableRoutes from "./src/modules/tables/tables.routes.js";
import deliveryAreasRoutes from "./src/modules/deliveryAreas/deliveryAreas.routes.js";
// Service Container
import ServiceContainer from "./src/utils/serviceContainer.js";
// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

class App {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.serviceContainer = new ServiceContainer();

    // تهيئة الـ middlewares والـ routes مباشرة
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Initialize all services
   */
  async initializeServices() {
    try {
      logger.info("🔧 Initializing services...");

      // Initialize Database
      logger.info("🗄️  Connecting to database...");
      await connectDatabase();
      logger.info("✅ Database connected successfully");

      // Initialize Redis
      logger.info("📡 Connecting to Redis...");
      try {
        await redisClient.connectWithFallback();
        if (redisClient.fallbackMode) {
          logger.warn("⚠️  Redis unavailable - running in fallback mode");
        } else {
          logger.info("✅ Redis connected successfully");
        }
      } catch (error) {
        logger.warn(
          "⚠️  Redis connection failed, continuing without Redis:",
          error.message
        );
      }

      // Initialize service container
      await this.serviceContainer.initialize();

      logger.info("🎉 All services initialized successfully");
    } catch (error) {
      logger.error("💥 Service initialization failed:", error.message);
      throw error;
    }
  }

  /**
   * Initialize middlewares
   */
  initializeMiddlewares() {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      })
    );

    // CORS
    const corsOptions = {
      origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true,
      maxAge: 86400,
    };
    this.app.use(cors(corsOptions));

    // Compression
    this.app.use(
      compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) =>
          !req.headers["x-no-compression"] && compression.filter(req, res),
      })
    );

    // Rate limiting
    if (process.env.ENABLE_RATE_LIMITING === "true") {
      this.initializeRateLimiting();
    }

    // Logging
    this.initializeLogging();

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Static files
    this.app.use("/uploads", express.static(join(__dirname, "../uploads")));
    this.app.use("/public", express.static(join(__dirname, "../public")));

    // Custom middleware
    this.app.use(requestLogger);

    // Make service container available in requests
    this.app.use((req, res, next) => {
      req.services = this.serviceContainer;
      next();
    });

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.removeHeader("X-Powered-By");
      next();
    });

    // API versioning
    this.app.use((req, res, next) => {
      req.apiVersion = process.env.API_VERSION || "v2";
      next();
    });
  }

  /**
   * Initialize rate limiting
   */
  initializeRateLimiting() {
    const globalLimiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(process.env.GLOBAL_RATE_LIMIT) || 1000,
      message: {
        error: "Too many requests from this IP, please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === "/health" || req.path === "/api/health",
    });

    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000,
      delayAfter: 50,
      delayMs: () => 500,
      maxDelayMs: 20000,
    });

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.AUTH_RATE_LIMIT) || 5,
      message: {
        error: "Too many authentication attempts, please try again later.",
        code: "AUTH_RATE_LIMIT_EXCEEDED",
      },
    });

    this.app.use(globalLimiter);
    this.app.use(speedLimiter);
    this.app.use("/api/auth", authLimiter);
  }

  /**
   * Initialize logging
   */
  initializeLogging() {
    if (process.env.NODE_ENV === "development") {
      this.app.use(morgan("dev"));
    } else {
      this.app.use(
        morgan("combined", {
          stream: { write: (message) => logger.info(message.trim()) },
        })
      );
    }
  }

  /**
   * Initialize routes
   */
  initializeRoutes() {
    // Health check
    this.app.get("/health", this.healthCheckHandler.bind(this));

    // API routes
    const apiRouter = express.Router();

    // Public routes
    apiRouter.use("/auth/phone", authRoutes);
    apiRouter.use("/auth/email", emailAuthRoutes);

    // Protected routes
    apiRouter.use("/users", authMiddleware, userRoutes);
    apiRouter.use("/categories", authMiddleware, categoryRoutes);
    apiRouter.use("/staff", authMiddleware, staffRoutes);
    apiRouter.use("/customers", authMiddleware, customerRoutes);
    apiRouter.use("/inventory", authMiddleware, inventoryRoutes);
    apiRouter.use("/menu", authMiddleware, menuRoutes);
    apiRouter.use("/tables", authMiddleware, tableRoutes);
    apiRouter.use("/orders", authMiddleware, orderRoutes);
    apiRouter.use("/parties", authMiddleware, partyRoutes);
    apiRouter.use("/payments", authMiddleware, paymentRoutes);
    apiRouter.use("/delivery-areas", deliveryAreasRoutes);

    // Mount API router
    this.app.use("/api", apiRouter);

    // Root endpoint
    this.app.get("/", this.rootHandler.bind(this));

    // 404 handler
    this.app.use(this.notFoundHandler.bind(this));
  }

  /**
   * Health check handler
   */
  async healthCheckHandler(req, res) {
    try {
      const [databaseStatus, redisStatus] = await Promise.allSettled([
        checkDatabaseHealth()
          .then((health) => health.status)
          .catch(() => "Disconnected"),
        redisClient
          .healthCheck()
          .then((health) => health.status)
          .catch(() => "Disconnected"),
      ]);

      const healthData = {
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.API_VERSION || "v2",
        services: {
          database: databaseStatus.value || databaseStatus.reason,
          redis: redisStatus.value || redisStatus.reason,
        },
        initialized: this.serviceContainer.isInitialized,
      };

      responseHandler.success(res, healthData, "Service is healthy");
    } catch (error) {
      logger.error("Health check failed:", error);
      responseHandler.error(res, "Health check failed", 503);
    }
  }

  /**
   * Root endpoint handler
   */
  rootHandler(req, res) {
    responseHandler.success(
      res,
      {
        name: "Restaurant Management System V2",
        version: process.env.API_VERSION || "v2",
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: "/health",
          api: "/api",
          docs: process.env.ENABLE_SWAGGER === "true" ? "/api-docs" : null,
        },
      },
      "Welcome to Restaurant Management System API"
    );
  }

  /**
   * 404 handler
   */
  notFoundHandler(req, res) {
    responseHandler.notFound(
      res,
      {
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
      },
      `Route ${req.method} ${req.originalUrl} not found`
    );
  }

  /**
   * Initialize error handling
   */
  initializeErrorHandling() {
    this.app.use(errorHandler);

    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      this.server?.close(async (err) => {
        if (err) {
          logger.error("Error during server shutdown:", err);
          process.exit(1);
        }

        logger.info("HTTP server closed");

        try {
          await this.serviceContainer.cleanup();
          logger.info("Services cleaned up successfully");
        } catch (error) {
          logger.error("Error during service cleanup:", error);
        }

        process.exit(0);
      });

      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      gracefulShutdown("uncaughtException");
    });
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
      gracefulShutdown("unhandledRejection");
    });
  }

  /**
   * Start the application
   */
  async start() {
    try {
      // Initialize services first
      await this.initializeServices();

      // Start server
      this.server = this.app.listen(this.port, () => {
        logger.info(`🚀 Restaurant Management System V2 started successfully!`);
        logger.info(`📡 Server running on port ${this.port}`);
        logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
        logger.info(`🔗 Health check: http://localhost:${this.port}/health`);
        logger.info(`📚 API Base URL: http://localhost:${this.port}/api`);
      });

      return this.server;
    } catch (error) {
      logger.error("❌ Failed to start application:", error.message);
      throw error;
    }
  }

  getApp() {
    return this.app;
  }
}

export default App;
