import logger from "../utils/logger.js";

/**
 * Request Logger Middleware
 * Logs HTTP requests with performance metrics and user context
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request start
  logger.debug("Request started", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    contentType: req.get("Content-Type"),
    contentLength: req.get("Content-Length"),
    timestamp: new Date().toISOString(),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;

    // Log request completion
    logger.logRequest(req, res, duration);

    // Call original end method
    originalEnd.apply(res, args);
  };

  next();
};
