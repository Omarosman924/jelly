import express from "express";
import usersController from "./users.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateRequest } from "./users.validation.js";

const router = express.Router();

/**
 * User Management Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Profile routes (accessible by all authenticated users)
router.get("/profile", usersController.getMyProfile);
router.put(
  "/profile",
  validateRequest("updateProfile"),
  usersController.updateMyProfile
);

// Search users (all authenticated users can search)
router.get("/search", usersController.searchUsers);

// Admin and Manager routes
router.get(
  "/",
  requireRole("ADMIN", "HALL_MANAGER"),
  usersController.getAllUsers
);

router.get("/stats", requireRole("ADMIN"), usersController.getUserStats);

router.get(
  "/role/:role",
  requireRole("ADMIN", "HALL_MANAGER"),
  usersController.getUsersByRole
);

// User CRUD operations (Admin only)
router.post(
  "/",
  requireRole("ADMIN"),
  validateRequest("createUser"),
  usersController.createUser
);

router.get(
  "/:id",
  requireRole("ADMIN", "HALL_MANAGER"),
  usersController.getUserById
);

router.put(
  "/:id",
  requireRole("ADMIN"),
  validateRequest("updateUser"),
  usersController.updateUser
);

router.delete("/:id", requireRole("ADMIN"), usersController.deleteUser);

// Role management (Admin only)
router.patch(
  "/:id/role",
  // requireRole("ADMIN"),
  validateRequest("changeRole"),
  usersController.changeUserRole
);

router.patch(
  "/:id/status",
  requireRole("ADMIN"),
  validateRequest("toggleStatus"),
  usersController.toggleUserStatus
);

// Profile management
router.put(
  "/:id/customer",
  validateRequest("updateCustomer"),
  usersController.updateCustomerProfile
);

router.put(
  "/:id/staff",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateStaff"),
  usersController.updateStaffProfile
);

// Password reset (Admin only)
router.patch(
  "/:id/reset-password",
  requireRole("ADMIN"),
  validateRequest("resetPassword"),
  usersController.resetUserPassword
);

export default router;
