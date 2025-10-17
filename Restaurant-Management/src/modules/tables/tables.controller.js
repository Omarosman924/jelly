import tablesService from "./tables.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import logger from "../../utils/logger.js";

/**
 * Tables Controller V2
 * Handles restaurant table management operations
 */
class TablesController {
  /**
   * Get all tables with filtering options
   */
  getAllTables = asyncHandler(async (req, res) => {
    const options = {
      status: req.validatedQuery?.status || req.query.status,
      tableType: req.validatedQuery?.tableType || req.query.tableType,
      includeInactive:
        (req.validatedQuery?.includeInactive ?? req.query.includeInactive) ===
        true,
      page: parseInt(req.validatedQuery?.page || req.query.page) || 1,
      limit: Math.min(
        parseInt(req.validatedQuery?.limit || req.query.limit) || 20,
        100
      ),
    };

    const result = await tablesService.getAllTables(options);

    return responseHandler.success(
      res,
      result,
      "Tables retrieved successfully"
    );
  });

  /**
   * Get table by ID
   */
  getTableById = asyncHandler(async (req, res) => {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return responseHandler.error(res, "Invalid table ID", 400);
    }

    const table = await tablesService.getTableById(tableId);
    return responseHandler.success(res, table, "Table retrieved successfully");
  });

  /**
   * Create new table
   */
  createTable = asyncHandler(async (req, res) => {
    const table = await tablesService.createTable(req.body, req.user);
    return responseHandler.created(res, table, "Table created successfully");
  });

  /**
   * Update table information
   */
  updateTable = asyncHandler(async (req, res) => {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return responseHandler.error(res, "Invalid table ID", 400);
    }

    const table = await tablesService.updateTable(tableId, req.body, req.user);
    return responseHandler.success(res, table, "Table updated successfully");
  });

  /**
   * Update table status
   */
  updateTableStatus = asyncHandler(async (req, res) => {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return responseHandler.error(res, "Invalid table ID", 400);
    }

    const { status } = req.body;
    const table = await tablesService.updateTableStatus(
      tableId,
      status,
      req.user
    );

    return responseHandler.success(
      res,
      table,
      `Table status updated to ${status}`
    );
  });

  /**
   * Get available tables with optional capacity filter
   */
  getAvailableTables = asyncHandler(async (req, res) => {
    const capacity = req.query.capacity ? parseInt(req.query.capacity) : 1;

    if (isNaN(capacity) || capacity < 1) {
      return responseHandler.error(
        res,
        "Capacity must be a positive number",
        400
      );
    }

    const tables = await tablesService.getAvailableTables(capacity);
    return responseHandler.success(
      res,
      {
        tables,
        count: tables.length,
        requestedCapacity: capacity,
      },
      "Available tables retrieved successfully"
    );
  });

  /**
   * Get tables statistics
   */
  getTablesStats = asyncHandler(async (req, res) => {
    const stats = await tablesService.getTablesStats();
    return responseHandler.success(
      res,
      stats,
      "Tables statistics retrieved successfully"
    );
  });

  /**
   * Get table occupancy report
   */
  getOccupancyReport = asyncHandler(async (req, res) => {
    const { period = "today" } = req.query;

    const validPeriods = ["today", "yesterday", "week", "month"];
    if (!validPeriods.includes(period)) {
      return responseHandler.error(
        res,
        "Invalid period. Use: today, yesterday, week, or month",
        400
      );
    }

    const report = await tablesService.getOccupancyReport(period);
    return responseHandler.success(
      res,
      report,
      `Occupancy report for ${period} retrieved successfully`
    );
  });

  /**
   * Get table utilization analytics
   */
  getUtilizationAnalytics = asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 7, 90); // Max 90 days

    const analytics = await tablesService.getUtilizationAnalytics(days);
    return responseHandler.success(
      res,
      {
        period: `Last ${days} days`,
        ...analytics,
      },
      "Table utilization analytics retrieved successfully"
    );
  });

  /**
   * Bulk update table status
   */
  bulkStatusUpdate = asyncHandler(async (req, res) => {
    const { tableIds, status } = req.body;

    const results = await tablesService.bulkStatusUpdate(
      tableIds,
      status,
      req.user
    );

    const message = `Bulk status update completed: ${results.updated.length} updated, ${results.failed.length} failed`;

    if (results.failed.length === 0) {
      return responseHandler.success(res, results, message);
    } else {
      return responseHandler.success(res, results, message, 207); // Multi-status
    }
  });

  /**
   * Reset all tables to a specific status
   */
  resetTables = asyncHandler(async (req, res) => {
    const { resetAll, status = "AVAILABLE" } = req.body;

    if (!resetAll) {
      return responseHandler.error(
        res,
        "resetAll must be true to confirm operation",
        400
      );
    }

    const result = await tablesService.resetAllTables(status, req.user);

    return responseHandler.success(
      res,
      result,
      `All tables reset to ${status} status`
    );
  });

  /**
   * Delete table (soft delete)
   */
  deleteTable = asyncHandler(async (req, res) => {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return responseHandler.error(res, "Invalid table ID", 400);
    }

    await tablesService.deleteTable(tableId, req.user);
    return responseHandler.success(res, null, "Table deleted successfully");
  });

  /**
   * Get table reservation history
   */
  getTableHistory = asyncHandler(async (req, res) => {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return responseHandler.error(res, "Invalid table ID", 400);
    }

    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const history = await tablesService.getTableHistory(tableId, days);

    return responseHandler.success(
      res,
      {
        tableId,
        period: `Last ${days} days`,
        ...history,
      },
      "Table history retrieved successfully"
    );
  });

  /**
   * Get table recommendations based on current occupancy
   */
  getTableRecommendations = asyncHandler(async (req, res) => {
    const { partySize, preferences = {} } = req.query;

    if (!partySize || isNaN(parseInt(partySize))) {
      return responseHandler.error(
        res,
        "Party size is required and must be a number",
        400
      );
    }

    const recommendations = await tablesService.getTableRecommendations(
      parseInt(partySize),
      preferences
    );

    return responseHandler.success(
      res,
      recommendations,
      "Table recommendations generated successfully"
    );
  });

  /**
   * Get real-time table status dashboard
   */
  getTablesDashboard = asyncHandler(async (req, res) => {
    const dashboard = await tablesService.getTablesDashboard();
    return responseHandler.success(
      res,
      dashboard,
      "Tables dashboard data retrieved successfully"
    );
  });
}

const tablesController = new TablesController();
export default tablesController;
