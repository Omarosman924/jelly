import logger from "../utils/logger.js";
import {responseHandler} from "../utils/response.js";
/**
 * Global Error Handler Middleware
 * Catches all unhandled errors and provides consistent error responses
 */
export const errorHandler = (error, req, res, next) => {
  // If response has already been sent, delegate to Express default error handler
  if (res.headersSent) {
    return next(error);
  }

  // Set default error values
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || "Internal server error";
  let errorCode = error.code || "INTERNAL_ERROR";
  let errors = null;

  // Log the error with context
  logger.error("Unhandled error caught by global handler", {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: statusCode,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: {
        userAgent: req.get("User-Agent"),
        contentType: req.get("Content-Type"),
      },
      body: req.method !== "GET" ? sanitizeRequestBody(req.body) : undefined,
      params: req.params,
      query: req.query,
      userId: req.user?.id || null,
      ip: req.ip,
    },
  });

  // Handle specific error types
  if (error.name === "ValidationError") {
    // Joi validation errors
    statusCode = 422;
    message = "Validation failed";
    errorCode = "VALIDATION_ERROR";
    errors = formatJoiErrors(error.details);
  } else if (error.name === "JsonWebTokenError") {
    // JWT errors
    statusCode = 401;
    message = "Invalid authentication token";
    errorCode = "INVALID_TOKEN";
  } else if (error.name === "TokenExpiredError") {
    // Expired JWT
    statusCode = 401;
    message = "Authentication token has expired";
    errorCode = "TOKEN_EXPIRED";
  } else if (error.code === "P2002") {
    // Prisma unique constraint violation
    statusCode = 409;
    message = "Resource already exists";
    errorCode = "DUPLICATE_RESOURCE";
    errors = formatPrismaUniqueError(error);
  } else if (error.code === "P2025") {
    // Prisma record not found
    statusCode = 404;
    message = "Resource not found";
    errorCode = "RESOURCE_NOT_FOUND";
  } else if (error.code === "P2003") {
    // Prisma foreign key constraint violation
    statusCode = 400;
    message = "Invalid reference to related resource";
    errorCode = "INVALID_REFERENCE";
  } else if (error.name === "MulterError") {
    // File upload errors
    statusCode = 400;
    errorCode = "FILE_UPLOAD_ERROR";

    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        message = "File size exceeds maximum allowed limit";
        break;
      case "LIMIT_FILE_COUNT":
        message = "Too many files uploaded";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected file field";
        break;
      default:
        message = "File upload failed";
    }
  } else if (error.type === "entity.parse.failed") {
    // JSON parsing error
    statusCode = 400;
    message = "Invalid JSON in request body";
    errorCode = "INVALID_JSON";
  } else if (error.type === "entity.too.large") {
    // Request entity too large
    statusCode = 413;
    message = "Request body too large";
    errorCode = "REQUEST_TOO_LARGE";
  } else if (error.name === "CastError") {
    // Invalid ObjectId or similar casting errors
    statusCode = 400;
    message = "Invalid ID format";
    errorCode = "INVALID_ID";
  } else if (error.code === "ECONNREFUSED") {
    // Database connection error
    statusCode = 503;
    message = "Service temporarily unavailable";
    errorCode = "SERVICE_UNAVAILABLE";
  } else if (error.name === "TimeoutError") {
    // Request timeout
    statusCode = 408;
    message = "Request timeout";
    errorCode = "REQUEST_TIMEOUT";
  }

  // Security: Don't expose sensitive error details in production
  if (process.env.NODE_ENV === "production") {
    // Generic error message for 5xx errors in production
    if (statusCode >= 500) {
      message = "Internal server error";
      errors = null;
    }

    // Remove stack traces in production
    delete error.stack;
  }

  // Send error response
  return responseHandler.error(res, message, statusCode, errors, errorCode);
};

/**
 * 404 Handler for undefined routes
 */
export const notFoundHandler = (req, res) => {
  logger.warn("Route not found", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  return responseHandler.notFound(
    res,
    {
      path: req.originalUrl,
      method: req.method,
    },
    `Route ${req.method} ${req.originalUrl} not found`
  );
};

/**
 * Async wrapper for route handlers
 * Automatically catches async errors and passes them to error handler
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    errorCode = "APP_ERROR",
    errors = null
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends AppError {
  constructor(message, errors = null) {
    super(message, 422, "VALIDATION_ERROR", errors);
    this.name = "ValidationError";
  }
}

/**
 * Custom error class for authentication errors
 */
export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

/**
 * Custom error class for authorization errors
 */
export class AuthorizationError extends AppError {
  constructor(message = "Access forbidden") {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

/**
 * Custom error class for not found errors
 */
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

/**
 * Custom error class for conflict errors
 */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

/**
 * Format Joi validation errors
 */
function formatJoiErrors(details) {
  if (!details || !Array.isArray(details)) {
    return null;
  }

  return details.map((detail) => ({
    field: detail.path.join("."),
    message: detail.message,
    value: detail.context?.value,
    type: detail.type,
  }));
}

/**
 * Format Prisma unique constraint errors
 */
function formatPrismaUniqueError(error) {
  if (!error.meta?.target) {
    return null;
  }

  const fields = Array.isArray(error.meta.target)
    ? error.meta.target
    : [error.meta.target];

  return fields.map((field) => ({
    field: field,
    message: `${field} already exists`,
    type: "unique_violation",
  }));
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== "object") {
    return body;
  }

  const sensitiveFields = [
    "password",
    "passwordConfirmation",
    "currentPassword",
    "newPassword",
    "token",
    "refreshToken",
    "apiKey",
    "secret",
    "privateKey",
    "creditCard",
    "cardNumber",
    "cvv",
    "ssn",
  ];

  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Error handler for development environment
 * Provides more detailed error information
 */
export const developmentErrorHandler = (error, req, res, next) => {
  logger.debug("Development error details", {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
    },
  });

  // Use the main error handler
  return errorHandler(error, req, res, next);
};

/**
 * Rate limit error handler
 */
export const rateLimitErrorHandler = (req, res) => {
  logger.warn("Rate limit exceeded", {
    ip: req.ip,
    path: req.originalUrl,
    userAgent: req.get("User-Agent"),
  });

  return responseHandler.tooManyRequests(
    res,
    "Too many requests from this IP, please try again later.",
    Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000) / 1000)
  );
};

export default errorHandler;
