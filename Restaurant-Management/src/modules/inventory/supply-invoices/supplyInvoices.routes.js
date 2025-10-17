import express from "express";
import supplyInvoicesController from "./supplyInvoices.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";
import { validateRequest } from "./supplyInvoices.validation.js";

const router = express.Router();

/**
 * Supply Invoices Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// View routes (Kitchen, Hall Manager, Admin can view)
router.get(
  "/",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  supplyInvoicesController.getAllSupplyInvoices
);

router.get(
  "/pending",
  requireRole("ADMIN", "HALL_MANAGER"),
  supplyInvoicesController.getPendingInvoices
);

router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER"),
  supplyInvoicesController.getSupplyInvoiceStats
);

router.get(
  "/reports",
  requireRole("ADMIN", "HALL_MANAGER"),
  supplyInvoicesController.generateSupplyReport
);

router.get("/:id", supplyInvoicesController.getSupplyInvoiceById);

// Create and edit routes (Admin, Kitchen)
router.post(
  "/",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("createSupplyInvoice"),
  supplyInvoicesController.createSupplyInvoice
);

router.put(
  "/:id",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("updateSupplyInvoice"),
  supplyInvoicesController.updateSupplyInvoice
);

// Approval routes (Admin, Hall Manager only)
router.patch(
  "/:id/approve",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("approveInvoice"),
  supplyInvoicesController.approveSupplyInvoice
);

router.patch(
  "/:id/reject",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("rejectInvoice"),
  supplyInvoicesController.rejectSupplyInvoice
);

router.patch(
  "/bulk-approve",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("bulkApprove"),
  supplyInvoicesController.bulkApproveInvoices
);

// Delete route (Admin only)
router.delete(
  "/:id",
  requireRole("ADMIN"),
  supplyInvoicesController.deleteSupplyInvoice
);

export default router;
