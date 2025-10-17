// src/utils/userProfileManager.js
import { getDatabaseClient } from "./database.js";
import logger from "./logger.js";
import { AppError, ConflictError } from "../middleware/errorHandler.js";
import crypto from "crypto";

/**
 * User Profile Manager
 * Handles profile creation, updates, and transitions between user types
 */
export class UserProfileManager {
  constructor() {
    this.db = null;
  }

  getDb() {
    if (!this.db) {
      this.db = getDatabaseClient();
    }
    return this.db;
  }

  /**
   * Check if role is end user
   */
  isEndUser(role) {
    return role === "END_USER";
  }

  /**
   * Check if role is staff
   */
  isStaff(role) {
    return ["ADMIN", "DELIVERY", "CASHIER", "KITCHEN", "HALL_MANAGER"].includes(
      role
    );
  }

  /**
   * Ensure user has correct profile for their role
   */
  async ensureCorrectProfile(userId, newRole, oldRole = null) {
    const db = this.getDb();

    try {
      await db.$transaction(async (prisma) => {
        // If no role change, just return
        if (oldRole === newRole) {
          return;
        }

        // Case 1: END_USER -> STAFF
        if (this.isEndUser(oldRole) && this.isStaff(newRole)) {
          logger.info("Converting END_USER to STAFF", { userId, newRole });

          // Archive customer data before removing
          const customer = await prisma.customer.findUnique({
            where: { userId },
            include: {
              orders: { take: 5, orderBy: { createdAt: "desc" } },
            },
          });

          if (customer) {
            // Check for active orders
            const activeOrders = await prisma.order.count({
              where: {
                customerId: customer.id,
                orderStatus: { notIn: ["DELIVERED", "CANCELLED", "COMPLETED"] },
              },
            });

            if (activeOrders > 0) {
              throw new ConflictError(
                "Cannot change role while customer has active orders"
              );
            }

            // Soft delete customer profile
            await prisma.customer.update({
              where: { id: customer.id },
              data: { deletedAt: new Date() },
            });
          }

          // Create staff profile
          await this.createStaffProfile(userId, newRole, prisma);
        }
        // Case 2: STAFF -> END_USER
        else if (this.isStaff(oldRole) && this.isEndUser(newRole)) {
          logger.info("Converting STAFF to END_USER", { userId, newRole });

          const staff = await prisma.staff.findUnique({
            where: { userId },
          });

          if (staff) {
            // Check if staff is currently on duty
            if (staff.isOnDuty) {
              throw new ConflictError(
                "Cannot change role while staff is on duty"
              );
            }

            // Check for active shifts
            const activeShifts = await prisma.staffShift.count({
              where: {
                staffId: staff.id,
                clockOutTime: null,
              },
            });

            if (activeShifts > 0) {
              throw new ConflictError(
                "Cannot change role while staff has active shifts"
              );
            }

            // Soft delete staff profile
            await prisma.staff.update({
              where: { id: staff.id },
              data: { deletedAt: new Date() },
            });
          }

          // Create customer profile
          await this.createCustomerProfile(userId, prisma);
        }
        // Case 3: STAFF -> STAFF (different role)
        else if (this.isStaff(oldRole) && this.isStaff(newRole)) {
          logger.info("Updating staff role", { userId, oldRole, newRole });
          await this.updateStaffRole(userId, newRole, prisma);
        }
      });

      logger.info("Profile transition completed successfully", {
        userId,
        oldRole,
        newRole,
      });
    } catch (error) {
      logger.error("Profile transition failed", {
        userId,
        oldRole,
        newRole,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create customer profile
   */
  async createCustomerProfile(userId, prisma = null) {
    const db = prisma || this.getDb();

    const customer = await db.customer.create({
      data: {
        userId,
        loyaltyPoints: 0,
        lastOrderDate: null,
      },
    });

    logger.info("Customer profile created", {
      userId,
      customerId: customer.id,
    });
    return customer;
  }

  /**
   * Create staff profile
   */
  async createStaffProfile(userId, role, prisma = null) {
    const db = prisma || this.getDb();

    const employeeCode = await this.generateEmployeeCode(role, db);

    const staff = await db.staff.create({
      data: {
        userId,
        employeeCode,
        hireDate: new Date(),
        isOnDuty: false,
        salary: 0,
      },
    });

    logger.info("Staff profile created", {
      userId,
      staffId: staff.id,
      employeeCode,
      role,
    });

    return staff;
  }

  /**
   * Update staff role
   */
  async updateStaffRole(userId, newRole, prisma = null) {
    const db = prisma || this.getDb();

    // Update user role
    await db.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    // Generate new employee code if needed
    const staff = await db.staff.findUnique({
      where: { userId },
    });

    if (staff) {
      const newEmployeeCode = await this.generateEmployeeCode(newRole, db);
      await db.staff.update({
        where: { id: staff.id },
        data: {
          employeeCode: newEmployeeCode,
        },
      });
    }

    logger.info("Staff role updated", { userId, newRole });
  }

  /**
   * Generate unique employee code with better collision handling
   */
  async generateEmployeeCode(role, db) {
    const rolePrefix = {
      ADMIN: "ADM",
      DELIVERY: "DEL",
      CASHIER: "CSH",
      KITCHEN: "KTC",
      HALL_MANAGER: "HMG",
    };

    const prefix = rolePrefix[role] || "EMP";
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      // More entropy: timestamp + random + counter
      const timestamp = Date.now().toString(36).slice(-6).toUpperCase();
      const random = crypto.randomBytes(3).toString("hex").toUpperCase();
      const counter = attempts.toString(36).toUpperCase();

      const employeeCode = `${prefix}-${timestamp}${random}${counter}`;

      // Check for uniqueness
      const existing = await db.staff.findUnique({
        where: { employeeCode },
      });

      if (!existing) {
        return employeeCode;
      }

      attempts++;

      // Add small delay to avoid timestamp collision
      if (attempts % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    throw new AppError("Failed to generate unique employee code", 500);
  }

  /**
   * Archive user profile before deletion
   */
  async archiveUserProfile(userId) {
    const db = this.getDb();

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        customer: true,
        staff: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Create archive record
    await db.userArchive.create({
      data: {
        originalUserId: userId,
        userData: JSON.stringify(user),
        archivedAt: new Date(),
        archivedReason: "USER_DELETION",
      },
    });

    logger.info("User profile archived", { userId });
  }

  /**
   * Validate profile transition
   */
  async validateProfileTransition(userId, newRole, oldRole) {
    const db = this.getDb();

    // Check for pending transactions
    if (this.isEndUser(oldRole)) {
      const pendingOrders = await db.order.count({
        where: {
          customer: { userId },
          orderStatus: { notIn: ["DELIVERED", "CANCELLED", "COMPLETED"] },
        },
      });

      if (pendingOrders > 0) {
        throw new ConflictError(
          `Cannot change role: User has ${pendingOrders} pending orders`
        );
      }
    }

    if (this.isStaff(oldRole)) {
      const staff = await db.staff.findUnique({
        where: { userId },
      });

      if (staff?.isOnDuty) {
        throw new ConflictError(
          "Cannot change role: Staff is currently on duty"
        );
      }

      const activeShifts = await db.staffShift.count({
        where: {
          staffId: staff?.id,
          clockOutTime: null,
        },
      });

      if (activeShifts > 0) {
        throw new ConflictError("Cannot change role: Staff has active shifts");
      }
    }

    return true;
  }
}

// Export singleton
export const userProfileManager = new UserProfileManager();
export default userProfileManager;
