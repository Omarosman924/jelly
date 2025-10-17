import express from "express";
import ordersController from "./orders.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateRequest } from "./orders.validation.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Order creation (Cashier, Admin, Customer)
router.post(
  "/",
  requireRole("ADMIN", "CASHIER", "END_USER"),
  validateRequest("createOrder"),
  ordersController.createOrder
);

// Order retrieval
router.get("/:id", ordersController.getOrderById);

// Status updates (Kitchen, Hall Manager, Admin)
router.patch(
  "/:id/status",
  requireRole("ADMIN", "KITCHEN", "HALL_MANAGER", "DELIVERY"),
  validateRequest("updateStatus"),
  ordersController.updateOrderStatus
);

export default router;
