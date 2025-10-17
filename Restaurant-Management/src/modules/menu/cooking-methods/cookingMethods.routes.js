import express from "express";
import cookingMethodsController from "./cookingMethods.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";
import { validateRequest } from "./cookingMethods.validation.js";

const router = express.Router();

/**
 * Cooking Methods Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Public routes (all authenticated users can view)
router.get("/", cookingMethodsController.getAllCookingMethods);
router.get("/active", cookingMethodsController.getActiveCookingMethods);
router.get("/popular", cookingMethodsController.getPopularMethods);
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  cookingMethodsController.getCookingMethodsStats
);
router.get(
  "/analytics",
  requireRole("ADMIN", "HALL_MANAGER"),
  cookingMethodsController.getCookingMethodsAnalytics
);
router.get("/:id", cookingMethodsController.getCookingMethodById);
router.get("/:id/impact", cookingMethodsController.calculateMethodImpact);

// Admin and Kitchen routes
router.post(
  "/",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("createCookingMethod"),
  cookingMethodsController.createCookingMethod
);

router.put(
  "/:id",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("updateCookingMethod"),
  cookingMethodsController.updateCookingMethod
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  cookingMethodsController.deleteCookingMethod
);

// Bulk operations (Admin only)
router.patch(
  "/bulk-availability",
  requireRole("ADMIN"),
  validateRequest("bulkUpdateAvailability"),
  cookingMethodsController.bulkUpdateAvailability
);

export default router;
