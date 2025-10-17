import express from "express";
import itemsController from "./items.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";
import { validateRequest } from "./items.validation.js";

const router = express.Router();

/**
 * Inventory Items Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Public routes (all authenticated users can view)
router.get("/", itemsController.getAllItems);
router.get("/low-stock", itemsController.getLowStockItems);
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  itemsController.getInventoryStats
);
router.get("/:id", itemsController.getItemById);

// Admin and Kitchen staff routes
router.post(
  "/",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("createItem"),
  itemsController.createItem
);

router.put(
  "/:id",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("updateItem"),
  itemsController.updateItem
);

router.delete("/:id", requireRole("ADMIN"), itemsController.deleteItem);

// Stock management (Admin, Kitchen, Hall Manager)
router.patch(
  "/:id/adjust-stock",
  requireRole("ADMIN", "KITCHEN", "HALL_MANAGER"),
  validateRequest("adjustStock"),
  itemsController.adjustStock
);

export default router;
