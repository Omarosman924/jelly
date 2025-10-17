import express from "express";
import wasteRequestsController from "./wasteRequests.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";
import { validateRequest } from "./wasteRequests.validation.js";

const router = express.Router();

/**
 * Waste Requests Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// View routes (Kitchen, Hall Manager, Admin can view)
router.get(
  "/",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  wasteRequestsController.getAllWasteRequests
);

router.get(
  "/my-requests",
  requireRole("KITCHEN", "HALL_MANAGER"),
  wasteRequestsController.getMyWasteRequests
);

router.get(
  "/pending",
  requireRole("ADMIN", "HALL_MANAGER"),
  wasteRequestsController.getPendingWasteRequests
);

router.get(
  "/urgent",
  requireRole("ADMIN", "HALL_MANAGER"),
  wasteRequestsController.getUrgentWasteRequests
);

router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER"),
  wasteRequestsController.getWasteRequestStats
);

router.get(
  "/reports",
  requireRole("ADMIN", "HALL_MANAGER"),
  wasteRequestsController.generateWasteReport
);

router.get("/:id", wasteRequestsController.getWasteRequestById);

// Create routes (Kitchen staff and managers can create requests)
router.post(
  "/",
  requireRole("KITCHEN", "HALL_MANAGER", "ADMIN"),
  validateRequest("createWasteRequest"),
  wasteRequestsController.createWasteRequest
);

// Approval routes (Admin and Hall Manager only)
router.patch(
  "/:id/approve",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("approveRequest"),
  wasteRequestsController.approveWasteRequest
);

router.patch(
  "/:id/reject",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("rejectRequest"),
  wasteRequestsController.rejectWasteRequest
);

router.patch(
  "/bulk-approve",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("bulkApprove"),
  wasteRequestsController.bulkApproveWasteRequests
);

export default router;
