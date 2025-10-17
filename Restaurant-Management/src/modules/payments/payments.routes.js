import express from "express";
import paymentsController from "./payments.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateRequest } from "./payments.validation.js";

const router = express.Router();

/**
 * Payments Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Payment processing routes (Cashier, Admin)
router.post(
  "/process",
  requireRole("ADMIN", "CASHIER"),
  validateRequest("processPayment"),
  paymentsController.processPayment
);

router.post(
  "/:id/refund",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("processRefund"),
  paymentsController.processRefund
);

// Payment information routes
router.get("/:id", paymentsController.getPaymentById);

router.get("/order/:orderId", paymentsController.getOrderPayments);

// Statistics and reporting routes (Admin, Hall Manager)
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER"),
  paymentsController.getPaymentStats
);

router.get(
  "/summary",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  paymentsController.getPaymentSummary
);

router.get(
  "/reports",
  requireRole("ADMIN", "HALL_MANAGER"),
  paymentsController.generatePaymentReport
);

// Gateway and configuration routes
router.get(
  "/gateways",
  requireRole("ADMIN", "CASHIER"),
  paymentsController.getAvailableGateways
);

// Payment verification routes
router.post(
  "/verify",
  validateRequest("verifyPayment"),
  paymentsController.verifyPaymentStatus
);

// Webhook endpoint (public - no auth required for gateway callbacks)
router.post(
  "/webhook",
  (req, res, next) => {
    // Skip authentication for webhook
    next();
  },
  paymentsController.handlePaymentWebhook
);

export default router;
