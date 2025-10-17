import jwt from "jsonwebtoken";
import { getDatabaseClient } from "../utils/database.js";
import { responseHandler } from "../utils/response.js";
import logger, { authLogger } from "../utils/logger.js";
import redisClient from "../utils/redis.js";

/**
 * Authentication Middleware
 * Verifies JWT tokens and injects user data into request
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      authLogger.warn(
        "Authentication failed: Missing or invalid authorization header",
        {
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          path: req.originalUrl,
        }
      );
      return responseHandler.unauthorized(res, "Access token required");
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      authLogger.warn("Authentication failed: Token is blacklisted", {
        userId: decoded.id,
        ip: req.ip,
        path: req.originalUrl,
      });
      return responseHandler.unauthorized(res, "Token has been revoked");
    }

    // Get user from database
    const db = getDatabaseClient();
    const user = await db.user.findUnique({
      where: {
        id: decoded.id,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        customer: {
          select: {
            id: true,
            loyaltyPoints: true,
          },
        },
        staff: {
          select: {
            id: true,
            employeeCode: true,
            isOnDuty: true,
          },
        },
      },
    });

    if (!user) {
      authLogger.warn("Authentication failed: User not found or inactive", {
        userId: decoded.id,
        ip: req.ip,
        path: req.originalUrl,
      });
      return responseHandler.unauthorized(res, "Invalid token");
    }

    // Check token expiration
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      authLogger.warn("Authentication failed: Token expired", {
        userId: decoded.id,
        expiredAt: new Date(decoded.exp * 1000),
        ip: req.ip,
      });
      return responseHandler.unauthorized(res, "Token has expired");
    }

    // Inject user data into request
    req.user = user;
    req.token = token;

    // Update last activity (optional, for session management)
    if (process.env.TRACK_USER_ACTIVITY === "true") {
      await redisClient.set(
        `user:${user.id}:last_activity`,
        Date.now(),
        parseInt(process.env.USER_ACTIVITY_TTL) || 86400
      );
    }

    // Log successful authentication
    authLogger.info("Authentication successful", {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip: req.ip,
      path: req.originalUrl,
    });

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      authLogger.warn("Authentication failed: Invalid JWT", {
        error: error.message,
        ip: req.ip,
        path: req.originalUrl,
      });
      return responseHandler.unauthorized(res, "Invalid token");
    }

    if (error.name === "TokenExpiredError") {
      authLogger.warn("Authentication failed: JWT expired", {
        expiredAt: error.expiredAt,
        ip: req.ip,
        path: req.originalUrl,
      });
      return responseHandler.unauthorized(res, "Token has expired");
    }

    // Log unexpected errors
    logger.error("Authentication middleware error", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      path: req.originalUrl,
    });

    return responseHandler.error(res, "Authentication failed", 500);
  }
};

/**
 * Optional Authentication Middleware
 * Injects user data if token is provided, but doesn't require authentication
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // Continue without authentication
    }

    // Use the main auth middleware
    return authMiddleware(req, res, next);
  } catch (error) {
    // If auth fails, continue without user data
    logger.debug("Optional authentication failed, continuing without auth", {
      error: error.message,
      path: req.originalUrl,
    });
    next();
  }
};

/**
 * Role-based Authorization Middleware
 * Checks if user has required role(s)
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return responseHandler.unauthorized(res, "Authentication required");
    }

    const userRole = req.user.role;
    if (!roles.includes(userRole)) {
      authLogger.warn("Authorization failed: Insufficient role", {
        userId: req.user.id,
        userRole: userRole,
        requiredRoles: roles,
        path: req.originalUrl,
      });
      return responseHandler.forbidden(res, "Insufficient permissions");
    }

    next();
  };
};

/**
 * Permission-based Authorization Middleware
 * Checks specific permissions
 */
export const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return responseHandler.unauthorized(res, "Authentication required");
    }

    try {
      // Check if user has permission (this would be expanded based on your permission system)
      const hasPermission = await checkUserPermission(
        req.user,
        resource,
        action
      );

      if (!hasPermission) {
        authLogger.warn("Authorization failed: Insufficient permission", {
          userId: req.user.id,
          resource: resource,
          action: action,
          path: req.originalUrl,
        });
        return responseHandler.forbidden(
          res,
          `No permission for ${action} on ${resource}`
        );
      }

      next();
    } catch (error) {
      logger.error("Permission check error", {
        error: error.message,
        userId: req.user.id,
        resource: resource,
        action: action,
      });
      return responseHandler.error(res, "Permission check failed", 500);
    }
  };
};

/**
 * Owner Authorization Middleware
 * Ensures user can only access their own resources
 */
export const requireOwnership = (
  resourceIdParam = "id",
  userIdField = "userId"
) => {
  return async (req, res, next) => {
    if (!req.user) {
      return responseHandler.unauthorized(res, "Authentication required");
    }

    try {
      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return responseHandler.error(res, "Resource ID required", 400);
      }

      // For admin users, skip ownership check
      if (req.user.role === "ADMIN") {
        return next();
      }

      // Check ownership (this logic would be customized per resource)
      const hasOwnership = await checkResourceOwnership(
        req.user.id,
        resourceId,
        userIdField
      );

      if (!hasOwnership) {
        authLogger.warn("Authorization failed: Resource ownership", {
          userId: req.user.id,
          resourceId: resourceId,
          path: req.originalUrl,
        });
        return responseHandler.forbidden(
          res,
          "You can only access your own resources"
        );
      }

      next();
    } catch (error) {
      logger.error("Ownership check error", {
        error: error.message,
        userId: req.user.id,
        resourceId: req.params[resourceIdParam],
      });
      return responseHandler.error(res, "Ownership check failed", 500);
    }
  };
};

/**
 * API Key Authentication Middleware
 * For external integrations
 */
export const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return responseHandler.unauthorized(res, "API key required");
    }

    // Verify API key (stored in Redis or database)
    const keyData = await redisClient.get(`api_key:${apiKey}`);
    if (!keyData) {
      authLogger.warn("API authentication failed: Invalid API key", {
        ip: req.ip,
        path: req.originalUrl,
      });
      return responseHandler.unauthorized(res, "Invalid API key");
    }

    // Inject API client data
    req.apiClient = keyData;

    authLogger.info("API authentication successful", {
      clientId: keyData.clientId,
      ip: req.ip,
      path: req.originalUrl,
    });

    next();
  } catch (error) {
    logger.error("API key authentication error", {
      error: error.message,
      ip: req.ip,
      path: req.originalUrl,
    });
    return responseHandler.error(res, "API authentication failed", 500);
  }
};

/**
 * Check user permission (helper function)
 */
async function checkUserPermission(user, resource, action) {
  // Implement your permission logic here
  // This could involve checking a permissions table or role-based rules

  // Simple role-based check as example
  const rolePermissions = {
    ADMIN: ["*"],
    HALL_MANAGER: ["orders", "tables", "customers"],
    KITCHEN: ["orders", "recipes", "inventory"],
    CASHIER: ["orders", "payments", "customers"],
    DELIVERY: ["orders", "delivery"],
    END_USER: ["orders:read", "profile"],
  };

  const userPermissions = rolePermissions[user.role] || [];
  return (
    userPermissions.includes("*") ||
    userPermissions.includes(resource) ||
    userPermissions.includes(`${resource}:${action}`)
  );
}

/**
 * Check resource ownership (helper function)
 */
async function checkResourceOwnership(userId, resourceId, userIdField) {
  // This would be implemented based on your specific resources
  // For now, return true as placeholder
  return true;
}

export default authMiddleware;
