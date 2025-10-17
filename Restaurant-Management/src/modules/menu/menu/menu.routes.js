import express from "express";
import menuController from "./menu.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";
import { validateRequest } from "./menu.validation.js";

const router = express.Router();

/**
 * Menu Routes
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Public routes (all authenticated users can view)
router.get("/", menuController.getAllMenus);
router.get("/active", menuController.getActiveMenus);
router.get("/date-range", menuController.getMenusByDateRange);

// Staff routes (ADMIN, HALL_MANAGER, KITCHEN can view stats and analytics)
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  menuController.getMenuStats
);
router.get(
  "/analytics",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  menuController.getMenuAnalytics
);
router.get(
  "/recommendations",
  requireRole("ADMIN", "HALL_MANAGER"),
  menuController.getMenuRecommendations
);

// Kitchen and Hall Manager routes (can manage menu items)
router.post(
  "/items",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  validateRequest("createMenuItem"),
  menuController.addMenuItem
);
router.get("/:id", menuController.getMenuById);

router.put(
  "/items/:menuItemId",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  validateRequest("updateMenuItem"),
  menuController.updateMenuItem
);

router.delete(
  "/items/:menuItemId",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  menuController.removeMenuItem
);

// Admin and Hall Manager routes (can manage menus)
router.post(
  "/",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("createMenu"),
  menuController.createMenu
);

router.put(
  "/:id",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateMenu"),
  menuController.updateMenu
);

router.post(
  "/:id/copy",
  requireRole("ADMIN", "HALL_MANAGER"),
  menuController.copyMenu
);

// Admin only routes (critical operations)
router.delete("/:id", requireRole("ADMIN"), menuController.deleteMenu);

// Bulk operations
router.patch(
  "/items/bulk-update",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("bulkUpdateMenuItems"),
  menuController.bulkUpdateMenuItems
);

router.patch(
  "/items/reorder",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("reorderMenuItems"),
  menuController.reorderMenuItems
);

export default router;
