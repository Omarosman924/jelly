import express from "express";
import tablesController from "./tables.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateRequest, validateQuery } from "./tables.validation.js";

const router = express.Router();

/**
 * Tables Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Public routes (all authenticated users can view)
router.get("/", validateQuery, tablesController.getAllTables);
router.get("/available", validateQuery, tablesController.getAvailableTables);
router.get("/dashboard", tablesController.getTablesDashboard);
router.get("/recommendations", tablesController.getTableRecommendations);
router.get("/:id", tablesController.getTableById);
router.get("/:id/history", tablesController.getTableHistory);

// Staff routes (ADMIN, HALL_MANAGER, CASHIER can view stats and reports)
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  tablesController.getTablesStats
);
router.get(
  "/occupancy",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  tablesController.getOccupancyReport
);
router.get(
  "/utilization",
  requireRole("ADMIN", "HALL_MANAGER"),
  tablesController.getUtilizationAnalytics
);

// Hall Manager and Admin routes (can manage table status)
router.patch(
  "/:id/status",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  validateRequest("updateTableStatus"),
  tablesController.updateTableStatus
);

// Admin and Hall Manager routes (can manage tables)
router.post(
  "/",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("createTable"),
  tablesController.createTable
);

router.put(
  "/:id",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateTable"),
  tablesController.updateTable
);

// Admin only routes (critical operations)
router.delete("/:id", requireRole("ADMIN"), tablesController.deleteTable);

router.patch(
  "/bulk-status",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("bulkStatusUpdate"),
  tablesController.bulkStatusUpdate
);

router.patch(
  "/reset",
  requireRole("ADMIN"),
  validateRequest("resetTables"),
  tablesController.resetTables
);

export default router;
