import express from "express";
import invoicesController from "./invoices.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateRequest } from "./invoices.validation.js";

const router = express.Router();

/**
 * Invoices Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Invoice generation (Cashier, Admin)
router.post(
  "/generate",
  requireRole("ADMIN", "CASHIER"),
  validateRequest("generateInvoice"),
  invoicesController.generateInvoice
);

// Invoice viewing routes
router.get("/", invoicesController.getAllInvoices);
router.get("/:id", invoicesController.getInvoiceById);
router.get("/order/:orderId", invoicesController.getInvoiceByOrder);

// Invoice actions (Admin, Hall Manager)
router.patch(
  "/:id/cancel",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("cancelInvoice"),
  invoicesController.cancelInvoice
);

// ZATCA compliance routes
router.get("/:id/qr", invoicesController.getInvoiceQR);
router.post(
  "/:id/verify-zatca",
  requireRole("ADMIN", "HALL_MANAGER"),
  invoicesController.verifyInvoiceZATCA
);
router.post(
  "/:id/resend-zatca",
  requireRole("ADMIN"),
  invoicesController.resendToZATCA
);

// Reports and statistics (Admin, Hall Manager)
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER"),
  invoicesController.getInvoiceStats
);

// File downloads
router.get("/:id/pdf", invoicesController.downloadInvoicePDF);

export default router;
