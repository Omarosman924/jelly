import unitsService from "./units.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import logger from "../../../utils/logger.js";

/**
 * Production-Ready Units Controller V2
 * Handles units of measurement operations with enhanced security and monitoring
 */
class UnitsController {
  /**
   * Get all units with pagination and filtering
   * @route GET /api/inventory/units
   * @access Private (authenticated users)
   */
  getAllUnits = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const options = {
        page: Math.max(1, parseInt(req.query.page) || 1),
        limit: Math.min(Math.max(1, parseInt(req.query.limit) || 50), 100), // Max 100
        search: req.query.search?.trim()?.substring(0, 100), // Limit search length
        isActive:
          req.query.isActive === "true"
            ? true
            : req.query.isActive === "false"
            ? false
            : undefined,
        sortBy: req.query.sortBy || "unitNameEn",
        sortOrder: ["asc", "desc"].includes(req.query.sortOrder)
          ? req.query.sortOrder
          : "asc",
      };

      const result = await unitsService.getAllUnits(options);

      // Add performance metrics
      const processingTime = Date.now() - startTime;

      return responseHandler.withPerformance(
        res,
        result.units,
        "Units retrieved successfully",
        startTime,
        {
          pagination: result.pagination,
          performance: {
            processingTime: `${processingTime}ms`,
            itemsCount: result.units.length,
          },
        }
      );
    } catch (error) {
      logger.error("Get all units controller error", {
        error: error.message,
        userId: req.user?.id,
        query: req.query,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * Get unit by ID
   * @route GET /api/inventory/units/:id
   * @access Private (authenticated users)
   */
  getUnitById = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const unitId = parseInt(req.params.id);

      if (!unitId || unitId <= 0) {
        return responseHandler.validationError(res, [
          {
            field: "id",
            message: "Valid unit ID is required",
            value: req.params.id,
          },
        ]);
      }

      const unit = await unitsService.getUnitById(unitId);

      return responseHandler.withPerformance(
        res,
        { unit },
        "Unit retrieved successfully",
        startTime
      );
    } catch (error) {
      logger.error("Get unit by ID controller error", {
        unitId: req.params.id,
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * Create new unit
   * @route POST /api/inventory/units
   * @access Private (Admin only)
   */
  createUnit = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const createdBy = req.user.id;
      const unit = await unitsService.createUnit(req.body, createdBy);

      // Log successful creation for audit
      logger.info("Unit created via API", {
        unitId: unit.id,
        unitSymbol: unit.unitSymbol,
        createdBy,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      return responseHandler.withPerformance(
        res,
        { unit },
        "Unit created successfully",
        startTime
      );
    } catch (error) {
      logger.error("Create unit controller error", {
        unitData: this.sanitizeLogData(req.body),
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * Update unit
   * @route PUT /api/inventory/units/:id
   * @access Private (Admin only)
   */
  updateUnit = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const unitId = parseInt(req.params.id);

      if (!unitId || unitId <= 0) {
        return responseHandler.validationError(res, [
          {
            field: "id",
            message: "Valid unit ID is required",
            value: req.params.id,
          },
        ]);
      }

      const updatedBy = req.user.id;
      const unit = await unitsService.updateUnit(unitId, req.body, updatedBy);

      // Log successful update for audit
      logger.info("Unit updated via API", {
        unitId,
        updatedFields: Object.keys(req.body),
        updatedBy,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      return responseHandler.withPerformance(
        res,
        { unit },
        "Unit updated successfully",
        startTime
      );
    } catch (error) {
      logger.error("Update unit controller error", {
        unitId: req.params.id,
        updateData: this.sanitizeLogData(req.body),
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * Delete unit
   * @route DELETE /api/inventory/units/:id
   * @access Private (Admin only)
   */
  deleteUnit = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const unitId = parseInt(req.params.id);

      if (!unitId || unitId <= 0) {
        return responseHandler.validationError(res, [
          {
            field: "id",
            message: "Valid unit ID is required",
            value: req.params.id,
          },
        ]);
      }

      const deletedBy = req.user.id;
      await unitsService.deleteUnit(unitId, deletedBy);

      // Log successful deletion for audit
      logger.warn("Unit deleted via API", {
        unitId,
        deletedBy,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      return responseHandler.withPerformance(
        res,
        null,
        "Unit deleted successfully",
        startTime
      );
    } catch (error) {
      logger.error("Delete unit controller error", {
        unitId: req.params.id,
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * Get active units (for dropdowns)
   * @route GET /api/inventory/units/active
   * @access Private (authenticated users)
   */
  getActiveUnits = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const units = await unitsService.getActiveUnits();

      // Set cache headers for better performance
      res.set({
        "Cache-Control": "public, max-age=1800", // 30 minutes
        ETag: responseHandler.generateETag(units),
      });

      return responseHandler.withPerformance(
        res,
        { units },
        "Active units retrieved successfully",
        startTime,
        {
          cached: true,
          itemsCount: units.length,
        }
      );
    } catch (error) {
      logger.error("Get active units controller error", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * Get unit usage statistics
   * @route GET /api/inventory/units/stats
   * @access Private (Admin, Hall Manager)
   */
  getUnitStats = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const stats = await unitsService.getUnitStats();

      return responseHandler.withPerformance(
        res,
        { stats },
        "Unit statistics retrieved successfully",
        startTime,
        {
          cacheInfo: {
            cached: true,
            ttl: "10 minutes",
          },
        }
      );
    } catch (error) {
      logger.error("Get unit stats controller error", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * Search units
   * @route GET /api/inventory/units/search
   * @access Private (authenticated users)
   */
  searchUnits = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const { query, limit = 10 } = req.query;

      if (!query || query.trim().length < 1) {
        return responseHandler.validationError(res, [
          {
            field: "query",
            message:
              "Search query is required and must be at least 1 character",
            value: query,
          },
        ]);
      }

      if (query.trim().length > 100) {
        return responseHandler.validationError(res, [
          {
            field: "query",
            message: "Search query cannot exceed 100 characters",
            value: query.length,
          },
        ]);
      }

      const searchOptions = {
        search: query.trim(),
        limit: Math.min(parseInt(limit) || 10, 50), // Max 50 results
        isActive: true, // Only search active units
      };

      const result = await unitsService.getAllUnits(searchOptions);

      return responseHandler.withPerformance(
        res,
        {
          results: result.units,
          query: query.trim(),
          totalFound: result.pagination.total,
        },
        "Search completed successfully",
        startTime
      );
    } catch (error) {
      logger.error("Search units controller error", {
        query: req.query.query,
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * Validate unit symbol uniqueness
   * @route POST /api/inventory/units/validate/symbol
   * @access Private (Admin)
   */
  validateUnitSymbol = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      const { unitSymbol, excludeId } = req.body;

      if (!unitSymbol || typeof unitSymbol !== "string") {
        return responseHandler.validationError(res, [
          {
            field: "unitSymbol",
            message: "Unit symbol is required",
            value: unitSymbol,
          },
        ]);
      }

      const trimmedSymbol = unitSymbol.trim();

      if (trimmedSymbol.length === 0 || trimmedSymbol.length > 10) {
        return responseHandler.validationError(res, [
          {
            field: "unitSymbol",
            message: "Unit symbol must be between 1 and 10 characters",
            value: trimmedSymbol.length,
          },
        ]);
      }

      // Check if symbol exists
      const existingUnit = await unitsService.getDb().unit.findFirst({
        where: {
          unitSymbol: trimmedSymbol,
          deletedAt: null,
          id: excludeId ? { not: parseInt(excludeId) } : undefined,
        },
        select: { id: true, unitNameEn: true },
      });

      const isAvailable = !existingUnit;

      return responseHandler.withPerformance(
        res,
        {
          isAvailable,
          unitSymbol: trimmedSymbol,
          conflictWith: existingUnit
            ? {
                id: existingUnit.id,
                name: existingUnit.unitNameEn,
              }
            : null,
        },
        isAvailable ? "Unit symbol is available" : "Unit symbol already exists",
        startTime
      );
    } catch (error) {
      logger.error("Validate unit symbol controller error", {
        unitSymbol: req.body.unitSymbol,
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * Get unit health check
   * @route GET /api/inventory/units/health
   * @access Private (authenticated users)
   */
  getHealthCheck = asyncHandler(async (req, res) => {
    try {
      const startTime = Date.now();

      // Test database connection
      const dbTest = await unitsService
        .getDb()
        .unit.count()
        .catch(() => null);

      // Test cache connection
      const cacheTest = await unitsService.cache
        .get("health_test")
        .catch(() => null);

      const healthData = {
        status: dbTest !== null ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        services: {
          database: dbTest !== null ? "connected" : "disconnected",
          cache: cacheTest !== null ? "connected" : "degraded",
        },
        metrics: {
          responseTime: `${Date.now() - startTime}ms`,
          totalUnits: dbTest || 0,
        },
        version: process.env.API_VERSION || "v2",
      };

      const statusCode = healthData.status === "healthy" ? 200 : 503;

      return res.status(statusCode).json({
        success: healthData.status === "healthy",
        data: healthData,
        message: `Units service is ${healthData.status}`,
      });
    } catch (error) {
      logger.error("Units health check failed", {
        error: error.message,
        userId: req.user?.id,
      });

      return res.status(503).json({
        success: false,
        data: {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error:
            process.env.NODE_ENV === "production"
              ? "Service unavailable"
              : error.message,
        },
        message: "Units service is unhealthy",
      });
    }
  });

  /**
   * Sanitize data for logging (remove sensitive information)
   * @private
   */
  sanitizeLogData(data) {
    const sanitized = { ...data };

    // Remove any potentially sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;

    return sanitized;
  }

  /**
   * Validate request parameters
   * @private
   */
  validateId(id, fieldName = "id") {
    const numId = parseInt(id);
    if (!numId || numId <= 0 || !Number.isInteger(numId)) {
      throw new ValidationError(
        `Invalid ${fieldName}: must be a positive integer`
      );
    }
    return numId;
  }

  /**
   * Set security headers
   * @private
   */
  setSecurityHeaders(res, data) {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });

    // Set ETag for cacheable resources
    if (data && typeof data === "object") {
      res.set("ETag", responseHandler.generateETag(data));
    }
  }
}

// Export singleton instance
const unitsController = new UnitsController();
export default unitsController;
