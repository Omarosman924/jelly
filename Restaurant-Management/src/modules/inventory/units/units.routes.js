import express from "express";
import unitsController from "./units.controller.js";
import { unitsValidation } from "./units.validation.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";
import { ensureDatabaseReady } from "../../../middleware/databaseMiddleware.js";
import logger from "../../../utils/logger.js";
import { responseHandler } from "../../../utils/response.js";

const router = express.Router();

/**
 * Production-Ready Units Routes V2
 * Enhanced with security, monitoring, and error handling
 */

// Apply database middleware to all routes
router.use(ensureDatabaseReady);

// Apply authentication to all routes
router.use(authMiddleware);

// Request logging middleware
router.use((req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;

    logger.info("Units API request", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
  });

  next();
});

// Security headers middleware
router.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-API-Version": process.env.API_VERSION || "v1",
  });
  next();
});

/**
 * @route   GET /api/inventory/units
 * @desc    Get all units with pagination and filtering
 * @access  Private (All authenticated users)
 * @limits  300 requests per hour per user
 */
router.get("/", unitsController.getAllUnits);

/**
 * @route   GET /api/inventory/units/active
 * @desc    Get active units (optimized for dropdowns)
 * @access  Private (All authenticated users)
 * @cache   30 minutes
 */
router.get(
  "/active",
  // No validation needed for this simple endpoint
  unitsController.getActiveUnits
);

/**
 * @route   GET /api/inventory/units/search
 * @desc    Search units
 * @access  Private (All authenticated users)
 * @limits  200 requests per hour per user
 */
router.get("/search", unitsValidation.search, unitsController.searchUnits);

/**
 * @route   GET /api/inventory/units/stats
 * @desc    Get unit usage statistics
 * @access  Private (Admin, Hall Manager)
 * @cache   10 minutes
 */
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER"),
  unitsController.getUnitStats
);

/**
 * @route   POST /api/inventory/units/validate/symbol
 * @desc    Validate unit symbol uniqueness
 * @access  Private (Admin only)
 * @limits  100 requests per hour per user
 */
router.post(
  "/validate/symbol",
  requireRole("ADMIN"),
  unitsValidation.validateSymbol,
  unitsController.validateUnitSymbol
);

/**
 * @route   GET /api/inventory/units/health
 * @desc    Units service health check
 * @access  Private (All authenticated users)
 */
router.get("/health", unitsController.getHealthCheck);

/**
 * @route   POST /api/inventory/units
 * @desc    Create new unit
 * @access  Private (Admin only)
 * @limits  50 requests per hour per user
 */
router.post(
  "/",
  requireRole("ADMIN"),
  unitsValidation.createUnit,
  unitsController.createUnit
);

/**
 * @route   GET /api/inventory/units/:id
 * @desc    Get unit by ID
 * @access  Private (All authenticated users)
 */
router.get("/:id", unitsValidation.getById, unitsController.getUnitById);

/**
 * @route   PUT /api/inventory/units/:id
 * @desc    Update unit
 * @access  Private (Admin only)
 * @limits  100 requests per hour per user
 */
router.put(
  "/:id",
  requireRole("ADMIN"),
  unitsValidation.updateUnit,
  unitsController.updateUnit
);

/**
 * @route   DELETE /api/inventory/units/:id
 * @desc    Delete unit (soft delete)
 * @access  Private (Admin only)
 * @limits  20 requests per hour per user
 */
router.delete(
  "/:id",
  requireRole("ADMIN"),
  unitsValidation.deleteUnit,
  unitsController.deleteUnit
);

// Enhanced error handling middleware specific to units
router.use((error, req, res, next) => {
  // Log the error with context
  logger.error("Units route error", {
    error: {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: {
        "user-agent": req.get("User-Agent"),
        "content-type": req.get("Content-Type"),
      },
      body: req.method !== "GET" ? req.body : undefined,
      params: req.params,
      query: req.query,
      userId: req.user?.id,
      userRole: req.user?.role,
      ip: req.ip,
    },
  });

  // Handle specific Prisma errors
  if (error.code === "P2002") {
    const target = error.meta?.target;
    if (target?.includes("unitSymbol")) {
      return responseHandler.conflict(res, "Unit symbol already exists", {
        field: "unitSymbol",
        code: "DUPLICATE_SYMBOL",
      });
    }
    if (target?.includes("unitName")) {
      return responseHandler.conflict(res, "Unit name already exists", {
        field: "unitName",
        code: "DUPLICATE_NAME",
      });
    }
    return responseHandler.conflict(
      res,
      "Unit data conflicts with existing record"
    );
  }

  if (error.code === "P2025") {
    return responseHandler.notFound(res, "Unit not found", {
      code: "UNIT_NOT_FOUND",
    });
  }

  if (error.code === "P2003") {
    return responseHandler.error(
      res,
      "Cannot delete unit that has associated items",
      400,
      { code: "UNIT_HAS_DEPENDENCIES" }
    );
  }

  // Handle validation errors
  if (error.name === "ValidationError") {
    return responseHandler.validationError(
      res,
      [{ field: "general", message: error.message }],
      "Validation failed"
    );
  }

  // Handle authorization errors
  if (error.name === "AuthorizationError") {
    return responseHandler.forbidden(res, error.message || "Access denied");
  }

  // Handle authentication errors
  if (error.name === "AuthenticationError") {
    return responseHandler.unauthorized(
      res,
      error.message || "Authentication required"
    );
  }

  // Handle not found errors
  if (error.name === "NotFoundError") {
    return responseHandler.notFound(res, error.message || "Resource not found");
  }

  // Handle conflict errors
  if (error.name === "ConflictError") {
    return responseHandler.conflict(res, error.message || "Resource conflict");
  }

  // Handle database connection errors
  if (error.code === "ECONNREFUSED" || error.message?.includes("connect")) {
    return responseHandler.error(res, "Service temporarily unavailable", 503, {
      code: "SERVICE_UNAVAILABLE",
    });
  }

  // Handle timeout errors
  if (error.name === "TimeoutError" || error.code === "ETIMEDOUT") {
    return responseHandler.error(res, "Request timeout", 408, {
      code: "REQUEST_TIMEOUT",
    });
  }

  // Handle rate limiting errors
  if (error.message?.includes("rate limit")) {
    return responseHandler.tooManyRequests(
      res,
      "Too many requests, please try again later",
      3600 // 1 hour
    );
  }

  // Default error handling
  const statusCode = error.statusCode || error.status || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message || "An unexpected error occurred";

  return responseHandler.error(
    res,
    message,
    statusCode,
    process.env.NODE_ENV === "development"
      ? {
          stack: error.stack,
          code: error.code,
        }
      : null
  );
});

// 404 handler for unmatched routes - FIXED: Added parameter name
router.use("*path", (req, res) => {
  logger.warn("Units route not found", {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    ip: req.ip,
  });

  return responseHandler.notFound(
    res,
    `Units route ${req.method} ${req.originalUrl} not found`,
    {
      availableRoutes: [
        "GET /",
        "GET /active",
        "GET /search",
        "GET /stats",
        "GET /health",
        "GET /:id",
        "POST /",
        "PUT /:id",
        "DELETE /:id",
        "POST /validate/symbol",
      ],
    }
  );
});

export default router;
