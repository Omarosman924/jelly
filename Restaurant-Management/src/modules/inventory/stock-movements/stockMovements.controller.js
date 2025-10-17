import stockMovementsService from "./stockMovements.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";

/**
 * Stock Movements Controller V2
 * Handles stock movement tracking and reporting (Read-only operations)
 */
class StockMovementsController {
  /**
   * Get all stock movements with filtering and pagination
   */
  getAllStockMovements = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      itemId: req.query.itemId ? parseInt(req.query.itemId) : undefined,
      movementType: req.query.movementType,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      createdByStaffId: req.query.createdByStaffId
        ? parseInt(req.query.createdByStaffId)
        : undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await stockMovementsService.getAllStockMovements(options);
    return responseHandler.paginated(
      res,
      result.movements,
      result.pagination,
      "Stock movements retrieved successfully"
    );
  });

  /**
   * Get stock movement by ID
   */
  getStockMovementById = asyncHandler(async (req, res) => {
    const movementId = parseInt(req.params.id);
    if (isNaN(movementId)) {
      return responseHandler.error(res, "Invalid movement ID", 400);
    }

    const movement = await stockMovementsService.getStockMovementById(
      movementId
    );
    return responseHandler.success(
      res,
      movement,
      "Stock movement retrieved successfully"
    );
  });

  /**
   * Get stock history for a specific item
   */
  getItemStockHistory = asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) {
      return responseHandler.error(res, "Invalid item ID", 400);
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 50, 100),
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      movementType: req.query.movementType,
    };

    const result = await stockMovementsService.getItemStockHistory(
      itemId,
      options
    );
    return responseHandler.paginated(
      res,
      result.movements,
      result.pagination,
      "Item stock history retrieved successfully",
      { item: result.item }
    );
  });

  /**
   * Get stock movement statistics
   */
  getStockMovementStats = asyncHandler(async (req, res) => {
    const { period = "month" } = req.query;
    const stats = await stockMovementsService.getStockMovementStats(period);
    return responseHandler.success(
      res,
      stats,
      "Stock movement statistics retrieved successfully"
    );
  });

  /**
   * Generate stock movement report
   */
  generateMovementReport = asyncHandler(async (req, res) => {
    const options = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      itemId: req.query.itemId ? parseInt(req.query.itemId) : undefined,
      movementType: req.query.movementType,
      format: req.query.format || "summary",
    };

    const report = await stockMovementsService.generateMovementReport(
      options,
      req.user
    );
    return responseHandler.success(
      res,
      report,
      "Stock movement report generated successfully"
    );
  });

  /**
   * Get stock trends analysis for an item
   */
  getStockTrends = asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) {
      return responseHandler.error(res, "Invalid item ID", 400);
    }

    const days = parseInt(req.query.days) || 30;
    if (days < 1 || days > 365) {
      return responseHandler.error(res, "Days must be between 1 and 365", 400);
    }

    const trends = await stockMovementsService.getStockTrends(itemId, days);
    return responseHandler.success(
      res,
      trends,
      "Stock trends retrieved successfully"
    );
  });

  /**
   * Get recent stock movements (for dashboard)
   */
  getRecentMovements = asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const movementType = req.query.movementType;

    const options = {
      page: 1,
      limit,
      movementType,
      sortBy: "createdAt",
      sortOrder: "desc",
    };

    const result = await stockMovementsService.getAllStockMovements(options);
    return responseHandler.success(
      res,
      result.movements,
      "Recent stock movements retrieved successfully"
    );
  });

  /**
   * Export stock movements data
   */
  exportStockMovements = asyncHandler(async (req, res) => {
    const options = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      itemId: req.query.itemId ? parseInt(req.query.itemId) : undefined,
      movementType: req.query.movementType,
      format: "detailed",
    };

    const report = await stockMovementsService.generateMovementReport(
      options,
      req.user
    );

    // Set appropriate headers for file download
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="stock-movements-${
        new Date().toISOString().split("T")[0]
      }.json"`
    );

    return res.json(report);
  });
}

const stockMovementsController = new StockMovementsController();
export default stockMovementsController;
