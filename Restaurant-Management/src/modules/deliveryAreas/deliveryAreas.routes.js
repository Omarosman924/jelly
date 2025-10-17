import express from "express";
import deliveryAreasController from "./deliveryAreas.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateRequest } from "./deliveryAreas.validation.js";

const router = express.Router();

/**
 * Delivery Areas Routes
 */

// Public routes (accessible by authenticated users)
router.get("/", authMiddleware, deliveryAreasController.getAllDeliveryAreas);

router.get("/:id", authMiddleware, deliveryAreasController.getDeliveryAreaById);

// Admin/Manager only routes
router.post(
  "/",
  authMiddleware,
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("createDeliveryArea"),
  deliveryAreasController.createDeliveryArea
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateDeliveryArea"),
  deliveryAreasController.updateDeliveryArea
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  deliveryAreasController.deleteDeliveryArea
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("toggleStatus"),
  deliveryAreasController.toggleDeliveryAreaStatus
);

// Statistics
router.get(
  "/stats/overview",
  authMiddleware,
  requireRole("ADMIN", "HALL_MANAGER"),
  deliveryAreasController.getDeliveryAreaStats
);

export default router;
