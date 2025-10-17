import express from "express";
import suppliersController from "./suppliers.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";
import { validateRequest } from "./suppliers.validation.js";

const router = express.Router();

/**
 * Suppliers Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Public routes (all authenticated users can view)
router.get("/", suppliersController.getAllSuppliers);
router.get("/active", suppliersController.getActiveSuppliers);
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  suppliersController.getSupplierStats
);
router.get("/:id", suppliersController.getSupplierById);
router.get(
  "/:id/purchase-history",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  suppliersController.getSupplierPurchaseHistory
);

// Admin and Kitchen staff routes
router.post(
  "/",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("createSupplier"),
  suppliersController.createSupplier
);

router.put(
  "/:id",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("updateSupplier"),
  suppliersController.updateSupplier
);

router.delete("/:id", requireRole("ADMIN"), suppliersController.deleteSupplier);

export default router;
