import express from "express";
import stockMovementsController from "./stockMovements.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Stock Movements Routes V2
 * All routes are read-only (no create/update/delete)
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// View routes (Kitchen, Hall Manager, Admin can view detailed movements)
router.get(
  "/",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  stockMovementsController.getAllStockMovements
);

router.get(
  "/recent",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  stockMovementsController.getRecentMovements
);

router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER"),
  stockMovementsController.getStockMovementStats
);

router.get(
  "/reports",
  requireRole("ADMIN", "HALL_MANAGER"),
  stockMovementsController.generateMovementReport
);

router.get(
  "/export",
  requireRole("ADMIN", "HALL_MANAGER"),
  stockMovementsController.exportStockMovements
);

router.get("/:id", stockMovementsController.getStockMovementById);

// Item-specific routes
router.get(
  "/item/:itemId/history",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  stockMovementsController.getItemStockHistory
);

router.get(
  "/item/:itemId/trends",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  stockMovementsController.getStockTrends
);

export default router;
