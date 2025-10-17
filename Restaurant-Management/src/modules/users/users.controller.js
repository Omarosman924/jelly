import usersService from "./users.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import logger from "../../utils/logger.js";

/**
 * Users Controller V2
 * Handles HTTP requests for user management endpoints
 */
class UsersController {
  /**
   * Get all users with pagination and filtering
   */
  getAllUsers = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100), // Max 100 items per page
      search: req.query.search,
      role: req.query.role,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await usersService.getAllUsers(options);

    return responseHandler.paginated(
      res,
      result.users,
      result.pagination,
      "Users retrieved successfully"
    );
  });

  /**
   * Get user by ID
   */
  getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return responseHandler.error(res, "Invalid user ID", 400);
    }

    const user = await usersService.getUserById(userId);

    return responseHandler.success(res, user, "User retrieved successfully");
  });

  /**
   * Create new user
   */
  createUser = asyncHandler(async (req, res) => {
    const userData = req.body;
    const createdBy = req.user;

    const user = await usersService.createUser(userData, createdBy);

    return responseHandler.created(res, user, "User created successfully");
  });

  /**
   * Update user
   */
  updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id);
    const updateData = req.body;
    const updatedBy = req.user;

    if (isNaN(userId)) {
      return responseHandler.error(res, "Invalid user ID", 400);
    }

    const user = await usersService.updateUser(userId, updateData, updatedBy);

    return responseHandler.success(res, user, "User updated successfully");
  });

  /**
   * Delete user (soft delete)
   */
  deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id);
    const deletedBy = req.user;

    if (isNaN(userId)) {
      return responseHandler.error(res, "Invalid user ID", 400);
    }

    // Prevent self-deletion
    if (userId === req.user.id) {
      return responseHandler.error(res, "Cannot delete your own account", 403);
    }

    await usersService.deleteUser(userId, deletedBy);

    return responseHandler.success(res, null, "User deleted successfully");
  });

  /**
   * Get current user profile
   */
  getMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const user = await usersService.getUserById(userId);

    return responseHandler.success(res, user, "Profile retrieved successfully");
  });

  /**
   * Update current user profile
   */
  updateMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.role;
    delete updateData.isActive;
    delete updateData.password;

    const user = await usersService.updateUser(userId, updateData, req.user);

    return responseHandler.success(res, user, "Profile updated successfully");
  });

  /**
   * Update customer profile
   */
  updateCustomerProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id);
    const customerData = req.body;

    if (isNaN(userId)) {
      return responseHandler.error(res, "Invalid user ID", 400);
    }

    // Check if user can update this customer profile
    if (req.user.role === "END_USER" && userId !== req.user.id) {
      return responseHandler.forbidden(
        res,
        "You can only update your own customer profile"
      );
    }

    const user = await usersService.updateCustomerProfile(userId, customerData);

    return responseHandler.success(
      res,
      user,
      "Customer profile updated successfully"
    );
  });

  /**
   * Update staff profile
   */
  updateStaffProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id);
    const staffData = req.body;

    if (isNaN(userId)) {
      return responseHandler.error(res, "Invalid user ID", 400);
    }

    const user = await usersService.updateStaffProfile(userId, staffData);

    return responseHandler.success(
      res,
      user,
      "Staff profile updated successfully"
    );
  });

  /**
   * Change user role (Admin only)
   */
  changeUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return responseHandler.error(res, "Invalid user ID", 400);
    }

    // Prevent changing own role
    // if (userId === req.user.id) {
    //   return responseHandler.error(res, "Cannot change your own role", 403);
    // }

    const user = await usersService.changeUserRole(userId, role, req.user);

    return responseHandler.success(res, user, "User role changed successfully");
  });

  /**
   * Activate/Deactivate user
   */
  toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return responseHandler.error(res, "Invalid user ID", 400);
    }

    // Prevent changing own status
    if (userId === req.user.id) {
      return responseHandler.error(res, "Cannot change your own status", 403);
    }

    const user = await usersService.updateUser(userId, { isActive }, req.user);

    const message = isActive
      ? "User activated successfully"
      : "User deactivated successfully";
    return responseHandler.success(res, user, message);
  });

  /**
   * Get user statistics (Admin only)
   */
  getUserStats = asyncHandler(async (req, res) => {
    const stats = await usersService.getUserStats();

    return responseHandler.success(
      res,
      stats,
      "User statistics retrieved successfully"
    );
  });

  /**
   * Search users
   */
  searchUsers = asyncHandler(async (req, res) => {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return responseHandler.error(
        res,
        "Search query must be at least 2 characters",
        400
      );
    }

    const result = await usersService.getAllUsers({
      search: q,
      limit: Math.min(parseInt(limit), 50), // Max 50 results for search
      page: 1,
    });

    return responseHandler.success(
      res,
      result.users,
      "Search completed successfully"
    );
  });

  /**
   * Get users by role
   */
  getUsersByRole = asyncHandler(async (req, res) => {
    const { role } = req.params;
    const { limit = 50 } = req.query;

    const validRoles = [
      "ADMIN",
      "END_USER",
      "DELIVERY",
      "CASHIER",
      "KITCHEN",
      "HALL_MANAGER",
    ];
    if (!validRoles.includes(role)) {
      return responseHandler.error(res, "Invalid role", 400);
    }

    const result = await usersService.getAllUsers({
      role,
      limit: Math.min(parseInt(limit), 100),
      page: 1,
      isActive: true,
    });

    return responseHandler.success(
      res,
      result.users,
      `${role} users retrieved successfully`
    );
  });

  /**
   * Reset user password (Admin only)
   */
  resetUserPassword = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return responseHandler.error(res, "Invalid user ID", 400);
    }

    await usersService.updateUser(userId, { password: newPassword }, req.user);

    logger.info("Password reset by admin", {
      targetUserId: userId,
      adminId: req.user.id,
    });

    return responseHandler.success(res, null, "Password reset successfully");
  });
}

const usersController = new UsersController();
export default usersController;
