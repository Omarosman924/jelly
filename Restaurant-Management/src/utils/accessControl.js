// src/utils/accessControl.js
import logger from "./logger.js";
import { AuthorizationError } from "../middleware/errorHandler.js";

/**
 * Access Control System
 * Comprehensive authorization and permission management
 */
export class AccessControl {
  constructor() {
    // Define role hierarchy (higher number = more permissions)
    this.roleHierarchy = {
      END_USER: 1,
      DELIVERY: 2,
      CASHIER: 3,
      KITCHEN: 3,
      HALL_MANAGER: 4,
      ADMIN: 5,
    };

    // Define resource permissions
    this.permissions = {
      // Customer permissions
      "customer:read": ["ADMIN", "HALL_MANAGER", "CASHIER", "END_USER"],
      "customer:write": ["ADMIN", "HALL_MANAGER"],
      "customer:delete": ["ADMIN"],
      "customer:own": ["END_USER"], // Can only access own data

      // Staff permissions
      "staff:read": ["ADMIN", "HALL_MANAGER"],
      "staff:write": ["ADMIN", "HALL_MANAGER"],
      "staff:delete": ["ADMIN"],
      "staff:salary:read": ["ADMIN"],
      "staff:salary:write": ["ADMIN"],

      // Order permissions
      "order:read": ["ADMIN", "HALL_MANAGER", "CASHIER", "KITCHEN", "DELIVERY"],
      "order:create": ["ADMIN", "HALL_MANAGER", "CASHIER"],
      "order:update": ["ADMIN", "HALL_MANAGER", "CASHIER", "KITCHEN"],
      "order:cancel": ["ADMIN", "HALL_MANAGER"],
      "order:own": ["END_USER"], // Can only see own orders

      // Loyalty points permissions
      "loyalty:read": ["ADMIN", "HALL_MANAGER", "CASHIER", "END_USER"],
      "loyalty:add": ["ADMIN", "HALL_MANAGER", "CASHIER"],
      "loyalty:redeem": ["ADMIN", "HALL_MANAGER", "CASHIER", "END_USER"],

      // Financial permissions
      "payment:read": ["ADMIN", "HALL_MANAGER", "CASHIER"],
      "payment:process": ["ADMIN", "HALL_MANAGER", "CASHIER"],
      "invoice:read": ["ADMIN", "HALL_MANAGER", "CASHIER"],
      "invoice:create": ["ADMIN", "HALL_MANAGER", "CASHIER"],

      // Reporting permissions
      "report:read": ["ADMIN", "HALL_MANAGER"],
      "report:export": ["ADMIN", "HALL_MANAGER"],

      // System permissions
      "system:settings": ["ADMIN"],
      "system:logs": ["ADMIN"],
      "system:users": ["ADMIN"],
    };
  }

  /**
   * Check if user has permission
   */
  hasPermission(user, permission) {
    const allowedRoles = this.permissions[permission];

    if (!allowedRoles) {
      logger.warn("Unknown permission checked", { permission });
      return false;
    }

    return allowedRoles.includes(user.role);
  }

  /**
   * Check if user can access customer data
   */
  canAccessCustomer(user, customerId) {
    // Admin and managers can access all customers
    if (["ADMIN", "HALL_MANAGER"].includes(user.role)) {
      return true;
    }

    // Cashier can access customers for orders
    if (user.role === "CASHIER") {
      return true;
    }

    // End user can only access own profile
    if (user.role === "END_USER") {
      if (!user.customer) {
        logger.warn("END_USER without customer profile", { userId: user.id });
        return false;
      }
      return user.customer.id === customerId;
    }

    return false;
  }

  /**
   * Check if user can access staff data
   */
  canAccessStaff(user, staffId) {
    // Admin and managers can access all staff
    if (["ADMIN", "HALL_MANAGER"].includes(user.role)) {
      return true;
    }

    // Staff can access own profile
    if (user.staff && user.staff.id === staffId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can modify salary information
   */
  canModifySalary(user) {
    return user.role === "ADMIN";
  }

  /**
   * Check if user can view salary information
   */
  canViewSalary(user, staffId) {
    // Admin can view all salaries
    if (user.role === "ADMIN") {
      return true;
    }

    // Staff can view own salary
    if (user.staff && user.staff.id === staffId) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can manage loyalty points
   */
  canManageLoyaltyPoints(user, operation) {
    if (operation === "view") {
      return this.hasPermission(user, "loyalty:read");
    }

    if (operation === "add") {
      return this.hasPermission(user, "loyalty:add");
    }

    if (operation === "redeem") {
      // Staff can redeem for customers
      if (["ADMIN", "HALL_MANAGER", "CASHIER"].includes(user.role)) {
        return true;
      }
      // Customers can redeem own points
      return user.role === "END_USER";
    }

    return false;
  }

  /**
   * Check if user can access order
   */
  canAccessOrder(user, order) {
    // Admin and managers can access all orders
    if (["ADMIN", "HALL_MANAGER"].includes(user.role)) {
      return true;
    }

    // Staff can access orders related to their role
    if (
      user.role === "CASHIER" ||
      user.role === "KITCHEN" ||
      user.role === "DELIVERY"
    ) {
      return true;
    }

    // End user can only access own orders
    if (user.role === "END_USER") {
      return order.customerId === user.customer?.id;
    }

    return false;
  }

  /**
   * Check role hierarchy
   */
  hasHigherRole(userRole, targetRole) {
    const userLevel = this.roleHierarchy[userRole] || 0;
    const targetLevel = this.roleHierarchy[targetRole] || 0;
    return userLevel > targetLevel;
  }

  /**
   * Filter sensitive data based on role
   */
  filterSensitiveData(user, data, dataType) {
    const filtered = { ...data };

    // Staff data filtering
    if (dataType === "staff") {
      // Only admin can see salary
      if (!this.canViewSalary(user, data.id)) {
        delete filtered.salary;
      }

      // Hide sensitive personal info from non-admin
      if (user.role !== "ADMIN") {
        delete filtered.user?.passwordHash;

        // Hall managers can see some info
        if (user.role !== "HALL_MANAGER") {
          delete filtered.user?.phone;
        }
      }
    }

    // Customer data filtering
    if (dataType === "customer") {
      // Hide sensitive payment info from non-authorized users
      if (!["ADMIN", "CASHIER"].includes(user.role)) {
        delete filtered.paymentMethods;
      }

      // Hide full address from delivery staff
      if (user.role === "DELIVERY" && !filtered.deliveryInProgress) {
        delete filtered.address;
      }
    }

    // Order data filtering
    if (dataType === "order") {
      // Hide customer details from kitchen staff
      if (user.role === "KITCHEN") {
        delete filtered.customer?.phone;
        delete filtered.customer?.email;
      }
    }

    return filtered;
  }

  /**
   * Validate action permissions
   */
  validateAction(user, action, resource, resourceId = null) {
    const permission = `${resource}:${action}`;

    if (!this.hasPermission(user, permission)) {
      logger.warn("Permission denied", {
        userId: user.id,
        userRole: user.role,
        action,
        resource,
        resourceId,
      });

      throw new AuthorizationError(
        `You don't have permission to ${action} ${resource}`
      );
    }

    // Additional checks for "own" resources
    if (this.permissions[`${resource}:own`]?.includes(user.role)) {
      if (!resourceId) {
        throw new AuthorizationError(
          "Resource ID required for ownership check"
        );
      }
      // Ownership check would happen in the service layer
    }

    return true;
  }

  /**
   * Get user permissions list
   */
  getUserPermissions(user) {
    const userPermissions = [];

    for (const [permission, roles] of Object.entries(this.permissions)) {
      if (roles.includes(user.role)) {
        userPermissions.push(permission);
      }
    }

    return userPermissions;
  }

  /**
   * Check multiple permissions (AND logic)
   */
  hasAllPermissions(user, permissions) {
    return permissions.every((permission) =>
      this.hasPermission(user, permission)
    );
  }

  /**
   * Check multiple permissions (OR logic)
   */
  hasAnyPermission(user, permissions) {
    return permissions.some((permission) =>
      this.hasPermission(user, permission)
    );
  }

  /**
   * Generate permission matrix for user
   */
  getPermissionMatrix(user) {
    return {
      role: user.role,
      level: this.roleHierarchy[user.role],
      permissions: this.getUserPermissions(user),
      canAccess: {
        customerData: this.hasPermission(user, "customer:read"),
        staffData: this.hasPermission(user, "staff:read"),
        orders: this.hasPermission(user, "order:read"),
        payments: this.hasPermission(user, "payment:read"),
        reports: this.hasPermission(user, "report:read"),
        systemSettings: this.hasPermission(user, "system:settings"),
      },
    };
  }
}

// Export singleton
export const accessControl = new AccessControl();
export default accessControl;
