import logger from './logger.js';
import crypto from 'crypto';


/**
 * Standard API Response Handler
 * Provides consistent response format across all API endpoints
 */
class ResponseHandler {
  /**
   * Send successful response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   * @param {Object} meta - Additional metadata
   */
  success(res, data = null, message = "Success", statusCode = 200, meta = {}) {
    const response = {
      success: true,
      message: message,
      data: data,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    // Log successful responses for monitoring
    if (process.env.NODE_ENV === "development") {
      logger.debug("API Success Response", {
        statusCode,
        message,
        dataType: data ? typeof data : "null",
        path: res.req?.originalUrl,
        method: res.req?.method,
      });
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} errors - Detailed error information
   * @param {string} errorCode - Internal error code
   */
  error(
    res,
    message = "An error occurred",
    statusCode = 500,
    errors = null,
    errorCode = null
  ) {
    const response = {
      success: false,
      message: message,
      errorCode: errorCode,
      timestamp: new Date().toISOString(),
    };

    if (errors) {
      response.errors = errors;
    }

    // Log error responses
    logger.error("API Error Response", {
      statusCode,
      message,
      errorCode,
      errors,
      path: res.req?.originalUrl,
      method: res.req?.method,
      userAgent: res.req?.get("User-Agent"),
      ip: res.req?.ip,
    });

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   * @param {Object} res - Express response object
   * @param {Object} validationErrors - Validation error details
   * @param {string} message - Error message
   */
  validationError(res, validationErrors, message = "Validation failed") {
    const response = {
      success: false,
      message: message,
      errorCode: "VALIDATION_ERROR",
      errors: validationErrors,
      timestamp: new Date().toISOString(),
    };

    logger.warn("API Validation Error", {
      message,
      errors: validationErrors,
      path: res.req?.originalUrl,
      method: res.req?.method,
    });

    return res.status(422).json(response);
  }

  /**
   * Send unauthorized response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  unauthorized(res, message = "Unauthorized access") {
    return this.error(res, message, 401, null, "UNAUTHORIZED");
  }

  /**
   * Send forbidden response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  forbidden(res, message = "Access forbidden") {
    return this.error(res, message, 403, null, "FORBIDDEN");
  }

  /**
   * Send not found response
   * @param {Object} res - Express response object
   * @param {*} data - Additional data
   * @param {string} message - Error message
   */
  notFound(res, data = null, message = "Resource not found") {
    const response = {
      success: false,
      message: message,
      errorCode: "NOT_FOUND",
      timestamp: new Date().toISOString(),
    };

    if (data) {
      response.data = data;
    }

    return res.status(404).json(response);
  }

  /**
   * Send conflict response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {Object} details - Conflict details
   */
  conflict(res, message = "Conflict occurred", details = null) {
    return this.error(res, message, 409, details, "CONFLICT");
  }

  /**
   * Send too many requests response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} retryAfter - Retry after seconds
   */
  tooManyRequests(res, message = "Too many requests", retryAfter = 60) {
    const response = {
      success: false,
      message: message,
      errorCode: "RATE_LIMIT_EXCEEDED",
      retryAfter: retryAfter,
      timestamp: new Date().toISOString(),
    };

    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json(response);
  }

  /**
   * Send created response
   * @param {Object} res - Express response object
   * @param {*} data - Created resource data
   * @param {string} message - Success message
   */
  created(res, data, message = "Resource created successfully") {
    return this.success(res, data, message, 201);
  }

  /**
   * Send no content response
   * @param {Object} res - Express response object
   */
  noContent(res) {
    return res.status(204).send();
  }

  /**
   * Send paginated response
   * @param {Object} res - Express response object
   * @param {Array} data - Data array
   * @param {Object} pagination - Pagination info
   * @param {string} message - Success message
   */
  paginated(res, data, pagination, message = "Data retrieved successfully") {
    const meta = {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext:
          pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1,
      },
    };

    return this.success(res, data, message, 200, meta);
  }

  /**
   * Send cached response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} maxAge - Cache max age in seconds
   */
  cached(res, data, message = "Success", maxAge = 3600) {
    res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
    res.setHeader("ETag", this.generateETag(data));

    return this.success(res, data, message);
  }

  /**
   * Send health check response
   * @param {Object} res - Express response object
   * @param {Object} healthData - Health check data
   */
  health(res, healthData) {
    const status = healthData.status === "healthy" ? 200 : 503;
    return res.status(status).json({
      status: healthData.status,
      timestamp: new Date().toISOString(),
      ...healthData,
    });
  }

  /**
   * Generate ETag for response data
   * @param {*} data - Response data
   * @returns {string} ETag value
   */
  generateETag(data) {
    return crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
  }
  /**
   * Handle async route wrapper
   * @param {Function} fn - Async route handler
   * @returns {Function} Express middleware
   */
  asyncWrapper(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Send API response with performance metrics
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} startTime - Request start time
   */
  withPerformance(res, data, message = "Success", startTime = Date.now()) {
    const processingTime = Date.now() - startTime;

    const meta = {
      performance: {
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
      },
    };

    // Log performance metrics
    logger.logPerformance("api_response", processingTime, {
      path: res.req?.originalUrl,
      method: res.req?.method,
      statusCode: 200,
    });

    return this.success(res, data, message, 200, meta);
  }

  /**
   * Send file download response
   * @param {Object} res - Express response object
   * @param {string} filePath - File path
   * @param {string} fileName - Download file name
   * @param {string} contentType - Content type
   */
  download(res, filePath, fileName, contentType = "application/octet-stream") {
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    return res.download(filePath, fileName, (err) => {
      if (err) {
        logger.error("File download failed", {
          filePath,
          fileName,
          error: err.message,
        });

        if (!res.headersSent) {
          this.error(res, "File download failed", 500, null, "DOWNLOAD_ERROR");
        }
      }
    });
  }

  /**
   * Send server-sent events response
   * @param {Object} res - Express response object
   * @param {*} data - Event data
   * @param {string} event - Event name
   * @param {string} id - Event ID
   */
  serverSentEvent(res, data, event = "message", id = null) {
    if (!res.headersSent) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
    }

    let sseData = `event: ${event}\n`;
    if (id) sseData += `id: ${id}\n`;
    sseData += `data: ${JSON.stringify(data)}\n\n`;

    res.write(sseData);
  }
}

// Create singleton instance
const responseHandler = new ResponseHandler();

export  {responseHandler};