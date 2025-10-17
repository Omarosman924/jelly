import express from "express";
import categoriesController from "./categories.controller.js";
import { categoriesValidation } from "./categories.validation.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { ensureDatabaseReady } from "../../middleware/databaseMiddleware.js";
import rateLimit from "express-rate-limit";
import logger from "../../utils/logger.js";

const router = express.Router();

/**
 * Rate limiters following production-ready patterns
 */
const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window for public endpoints
  message: {
    error: "Too many requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 requests per window for general endpoints
  message: {
    error: "Too many requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const moderateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 requests per window for moderate endpoints
  message: {
    error: "Too many requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 requests per window for strict endpoints
  message: {
    error: "Too many requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Categories Routes - Production Ready
 * Following the same structure as Items with full functionality
 */

// Apply database middleware to all routes
router.use(ensureDatabaseReady);

// Public routes (no authentication required)
router.get(
  "/public",
  publicRateLimit,
  categoriesValidation.getPublicCategories,
  categoriesController.getPublicCategories
);
router.get(
  "/search",
  optionalAuthMiddleware,
  publicRateLimit,
  categoriesValidation.searchCategories,
  categoriesController.searchCategories
);

// Protected routes (authentication required)
router.use(authMiddleware);

// General access routes (all authenticated users)
router.get(
  "/",
  generalRateLimit,
  categoriesController.getAllCategories
);
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  generalRateLimit,
  categoriesController.getCategoryStats
);
router.get(
  "/:id",
  generalRateLimit,
  categoriesController.getCategoryById
);
router.get(
  "/:id/items/count",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  generalRateLimit,
  categoriesValidation.getCategoryItemsCount,
  categoriesController.getCategoryItemsCount
);
router.get(
  "/:id/analytics",
  requireRole("ADMIN", "HALL_MANAGER"),
  generalRateLimit,
  categoriesValidation.getCategoryAnalytics,
  categoriesController.getCategoryAnalytics
);

// Management routes (Admin and Hall Manager)
router.post(
  "/",
  requireRole("ADMIN", "HALL_MANAGER"),
  moderateRateLimit,
  categoriesValidation.createCategory,
  categoriesController.createCategory
);
router.put(
  "/:id",
  requireRole("ADMIN", "HALL_MANAGER"),
  moderateRateLimit,
  categoriesValidation.updateCategory,
  categoriesController.updateCategory
);
router.patch(
  "/:id/status",
  requireRole("ADMIN", "HALL_MANAGER"),
  moderateRateLimit,
  categoriesValidation.updateCategoryStatus,
  categoriesController.updateCategoryStatus
);
router.patch(
  "/reorder",
  requireRole("ADMIN", "HALL_MANAGER"),
  moderateRateLimit,
  categoriesValidation.reorderCategories,
  categoriesController.reorderCategories
);
router.post(
  "/export",
  requireRole("ADMIN", "HALL_MANAGER"),
  strictRateLimit,
  categoriesValidation.exportCategories,
  categoriesController.exportCategories
);

// Admin only routes
router.delete(
  "/:id",
  requireRole("ADMIN"),
  strictRateLimit,
  categoriesValidation.deleteCategory,
  categoriesController.deleteCategory
);
router.post(
  "/:id/restore",
  requireRole("ADMIN"),
  strictRateLimit,
  categoriesValidation.restoreCategory,
  categoriesController.restoreCategory
);
router.patch(
  "/bulk",
  requireRole("ADMIN"),
  strictRateLimit,
  categoriesValidation.bulkUpdateCategories,
  categoriesController.bulkUpdateCategories
);

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    module: "categories",
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || "v2",
    user: req.user
      ? {
          id: req.user.id,
          role: req.user.role,
        }
      : null,
    features: {
      publicAccess: true,
      caching: true,
      analytics: true,
      bulkOperations: true,
      export: true,
      search: true,
      audit: true,
    },
  });
});

// Error handling middleware specific to categories
router.use((error, req, res, next) => {
  logger.error("Categories route error", {
    error: {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      userId: req.user?.id,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    },
  });

  // Handle specific Prisma errors
  if (error.code === "P2002") {
    const target = error.meta?.target;
    if (target?.includes("categoryNameAr")) {
      return res.status(409).json({
        success: false,
        message: "Arabic category name already exists",
        errorCode: "DUPLICATE_CATEGORY_NAME_AR",
        timestamp: new Date().toISOString(),
      });
    }
    if (target?.includes("categoryNameEn")) {
      return res.status(409).json({
        success: false,
        message: "English category name already exists",
        errorCode: "DUPLICATE_CATEGORY_NAME_EN",
        timestamp: new Date().toISOString(),
      });
    }
    if (target?.includes("displayOrder")) {
      return res.status(409).json({
        success: false,
        message: "Display order already exists",
        errorCode: "DUPLICATE_DISPLAY_ORDER",
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(409).json({
      success: false,
      message: "Category data conflicts with existing record",
      errorCode: "DUPLICATE_CATEGORY_DATA",
      timestamp: new Date().toISOString(),
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "Category not found",
      errorCode: "CATEGORY_NOT_FOUND",
      timestamp: new Date().toISOString(),
    });
  }

  if (error.code === "P2003") {
    return res.status(400).json({
      success: false,
      message: "Cannot delete category that has associated items",
      errorCode: "CATEGORY_HAS_DEPENDENCIES",
      timestamp: new Date().toISOString(),
    });
  }

  // Handle validation errors
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message || "Validation failed",
      errorCode: "VALIDATION_ERROR",
      timestamp: new Date().toISOString(),
    });
  }

  // Handle authorization errors
  if (error.name === "AuthorizationError") {
    return res.status(403).json({
      success: false,
      message: error.message || "Access denied",
      errorCode: "AUTHORIZATION_ERROR",
      timestamp: new Date().toISOString(),
    });
  }

  // Handle authentication errors
  if (error.name === "AuthenticationError") {
    return res.status(401).json({
      success: false,
      message: error.message || "Authentication required",
      errorCode: "AUTHENTICATION_ERROR",
      timestamp: new Date().toISOString(),
    });
  }

  // Handle not found errors
  if (error.name === "NotFoundError") {
    return res.status(404).json({
      success: false,
      message: error.message || "Resource not found",
      errorCode: "NOT_FOUND_ERROR",
      timestamp: new Date().toISOString(),
    });
  }

  // Handle conflict errors
  if (error.name === "ConflictError") {
    return res.status(409).json({
      success: false,
      message: error.message || "Resource conflict",
      errorCode: "CONFLICT_ERROR",
      timestamp: new Date().toISOString(),
    });
  }

  // Handle database connection errors
  if (error.code === "ECONNREFUSED" || error.message?.includes("connect")) {
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable",
      errorCode: "SERVICE_UNAVAILABLE",
      timestamp: new Date().toISOString(),
    });
  }

  // Handle timeout errors
  if (error.name === "TimeoutError" || error.code === "ETIMEDOUT") {
    return res.status(408).json({
      success: false,
      message: "Request timeout",
      errorCode: "REQUEST_TIMEOUT",
      timestamp: new Date().toISOString(),
    });
  }

  // Handle rate limiting errors
  if (error.message?.includes("rate limit")) {
    return res.status(429).json({
      success: false,
      message: "Too many requests, please try again later",
      errorCode: "RATE_LIMIT_EXCEEDED",
      retryAfter: 3600, // 1 hour
      timestamp: new Date().toISOString(),
    });
  }

  // Default error handling
  const statusCode = error.statusCode || error.status || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message || "An unexpected error occurred";

  return res.status(statusCode).json({
    success: false,
    message,
    errorCode: "INTERNAL_ERROR",
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      code: error.code,
    }),
  });
});

export default router;
