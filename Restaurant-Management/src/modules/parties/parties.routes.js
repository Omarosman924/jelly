import express from "express";
import partiesController from "./parties.controller.js";

import { validateRequest } from "./parties.validation.js";
import authMiddleware, { requireRole } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Parties Routes V2
 * Handles party types and party orders
 */

// Apply authentication to all routes
router.use(authMiddleware);

// ==================== PARTY TYPES ROUTES ====================

// Public routes (all authenticated users can view)
router.get("/types", partiesController.getAllPartyTypes);
router.get("/types/active", partiesController.getActivePartyTypes);
router.get("/types/:id", partiesController.getPartyTypeById);

// Admin and manager routes for party types
router.post(
  "/types",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("createPartyType"),
  partiesController.createPartyType
);

router.put(
  "/types/:id",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updatePartyType"),
  partiesController.updatePartyType
);

router.delete(
  "/types/:id",
  requireRole("ADMIN"),
  partiesController.deletePartyType
);

// ==================== PARTY ORDERS ROUTES ====================

// Get all party orders (with role-based filtering)
router.get("/orders", partiesController.getAllPartyOrders);

// Get specific party order
router.get("/orders/:id", partiesController.getPartyOrderById);

// Create party order (customers and staff)
router.post(
  "/orders",
  validateRequest("createPartyOrder"),
  partiesController.createPartyOrder
);

// Update party order (only before confirmation)
router.put(
  "/orders/:id",
  validateRequest("updatePartyOrder"),
  partiesController.updatePartyOrder
);

// Update party order status (staff only)
router.patch(
  "/orders/:id/status",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  validateRequest("updatePartyOrderStatus"),
  partiesController.updatePartyOrderStatus
);

// Cancel party order
router.patch(
  "/orders/:id/cancel",
  validateRequest("cancelPartyOrder"),
  partiesController.cancelPartyOrder
);

// Get party order timeline
router.get("/orders/:id/timeline", partiesController.getPartyOrderTimeline);

// ==================== UTILITY ROUTES ====================

// Calculate party order cost
router.post(
  "/calculate-cost",
  validateRequest("calculateCost"),
  partiesController.calculatePartyOrderCost
);

// Get party statistics (staff only)
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER"),
  partiesController.getPartyStats
);

// Get upcoming party orders
router.get(
  "/upcoming",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  partiesController.getUpcomingPartyOrders
);

// Generate party order report (admin and manager only)
router.get(
  "/reports",
  requireRole("ADMIN", "HALL_MANAGER"),
  partiesController.generatePartyOrderReport
);

export default router;
