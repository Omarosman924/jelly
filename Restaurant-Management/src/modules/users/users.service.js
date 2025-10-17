import { getDatabaseClient } from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../middleware/errorHandler.js";
import bcrypt from "bcryptjs";

/**
 * Users Service V2
 * Advanced user management with caching and business logic
 */
class UsersService {
  constructor() {
    this.cache = redisClient.cache(3600); // 1 hour cache
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  }
getDb() {
    try {
      return getDatabaseClient();
    } catch (error) {
      logger.error("Failed to get database client", {
        error: error.message,
        service: "CategoriesService",
      });
      throw new AppError("Database connection failed", 503);
    }
  }
  /**
   * Get all users with pagination and filtering
   */
  async getAllUsers(options = {}) {
    try {
      const db = this.getDb();
      const {
        page = 1,
        limit = 10,
        search,
        role,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {};

      if (search) {
        where.OR = [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ];
      }

      if (role) {
        where.role = role;
      }

      if (typeof isActive === "boolean") {
        where.isActive = isActive;
      }

      // Build order by
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      // Get total count
      const total = await db.user.count({ where });

      // Get users with related data
      const users = await db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              loyaltyPoints: true,
              lastOrderDate: true,
            },
          },
          staff: {
            select: {
              id: true,
              employeeCode: true,
              isOnDuty: true,
            },
          },
        },
      });

      logger.info("Users retrieved successfully", {
        total,
        returned: users.length,
        filters: { search, role, isActive },
      });

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Get all users failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get user by ID with caching
   */
  async getUserById(userId) {
    try {
      const db = this.getDb();
      // Try cache first
      const cacheKey = `user:${userId}`;
      let user = await this.cache.get(cacheKey);

      if (!user) {
        // Get from database
        user = await db.user.findUnique({
          where: { id: userId },
          include: {
            customer: {
              include: {
                deliveryArea: {
                  select: {
                    areaName: true,
                    deliveryFee: true,
                  },
                },
                companyCustomers: {
                  select: {
                    id: true,
                    companyName: true,
                    isActive: true,
                  },
                },
              },
            },
            staff: true,
          },
        });

        if (!user) {
          throw new NotFoundError("User");
        }

        // Remove password hash
        const { passwordHash, ...userWithoutPassword } = user;
        user = userWithoutPassword;

        // Cache for 1 hour
        await this.cache.set(cacheKey, user);
      }

      return user;
    } catch (error) {
      logger.error("Get user by ID failed", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new user
   */
  async createUser(userData, createdBy) {
    try {
      const db = this.getDb();
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        role = "END_USER",
        customerData = {},
        staffData = {},
      } = userData;

      // Check if email already exists
      const existingUser = await db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictError("Email already exists");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      // Create user in transaction
      const user = await db.$transaction(async (prisma) => {
        // Create user
        const newUser = await prisma.user.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
            phone,
            role,
            isActive: true,
          },
        });

        // Create customer profile for END_USER
        if (role === "END_USER") {
          await prisma.customer.create({
            data: {
              userId: newUser.id,
              address: customerData.address || null,
              city: customerData.city || null,
              district: customerData.district || null,
              deliveryAreaId: customerData.deliveryAreaId || null,
              loyaltyPoints: 0,
            },
          });
        }

        // Create staff profile for staff roles
        if (
          ["ADMIN", "DELIVERY", "CASHIER", "KITCHEN", "HALL_MANAGER"].includes(
            role
          )
        ) {
          await prisma.staff.create({
            data: {
              userId: newUser.id,
              employeeCode: this.generateEmployeeCode(role),
              salary: staffData.salary || null,
              hireDate: new Date(),
              shiftType: staffData.shiftType || null,
              isOnDuty: false,
            },
          });
        }

        return newUser;
      });

      // Log user creation
      logger.info("User created successfully", {
        userId: user.id,
        email: user.email,
        role: user.role,
        createdBy: createdBy?.id || "system",
      });

      // Get complete user data
      const completeUser = await this.getUserById(user.id);
      return completeUser;
    } catch (error) {
      logger.error("Create user failed", {
        email: userData.email,
        role: userData.role,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData, updatedBy) {
    try {
      const db = this.getDb();
      // Check if user exists
      const existingUser = await db.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        throw new NotFoundError("User");
      }

      // Check email uniqueness if email is being updated
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await db.user.findFirst({
          where: {
            email: updateData.email,
            NOT: { id: userId },
          },
        });

        if (emailExists) {
          throw new ConflictError("Email already exists");
        }
      }

      // Hash password if provided
      if (updateData.password) {
        updateData.passwordHash = await bcrypt.hash(
          updateData.password,
          this.saltRounds
        );
        delete updateData.password;
      }

      // Update user
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });

      // Clear cache
      await this.cache.del(`user:${userId}`);

      logger.info("User updated successfully", {
        userId,
        updatedBy: updatedBy?.id || "system",
        fields: Object.keys(updateData),
      });

      // Return updated user data
      return await this.getUserById(userId);
    } catch (error) {
      logger.error("Update user failed", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId, deletedBy) {
    try {
      const db = this.getDb();
      const user = await db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundError("User");
      }

      // Soft delete by setting isActive to false
      await db.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      // Clear cache
      await this.cache.del(`user:${userId}`);

      // Blacklist all user tokens
      await this.blacklistUserTokens(userId);

      logger.info("User deleted successfully", {
        userId,
        email: user.email,
        deletedBy: deletedBy?.id || "system",
      });
    } catch (error) {
      logger.error("Delete user failed", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update customer profile
   */
  async updateCustomerProfile(userId, customerData) {
    try {
      const db = this.getDb();
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { customer: true },
      });

      if (!user) {
        throw new NotFoundError("User");
      }

      if (!user.customer) {
        throw new AppError("User is not a customer", 400);
      }

      // Update customer data
      const updatedCustomer = await db.customer.update({
        where: { userId },
        data: customerData,
      });

      // Clear cache
      await this.cache.del(`user:${userId}`);

      logger.info("Customer profile updated", {
        userId,
        customerId: updatedCustomer.id,
      });

      return await this.getUserById(userId);
    } catch (error) {
      logger.error("Update customer profile failed", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update staff profile
   */
  async updateStaffProfile(userId, staffData) {
    try {
      const db = this.getDb();
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { staff: true },
      });

      if (!user) {
        throw new NotFoundError("User");
      }

      if (!user.staff) {
        throw new AppError("User is not a staff member", 400);
      }

      // Update staff data
      const updatedStaff = await db.staff.update({
        where: { userId },
        data: staffData,
      });

      // Clear cache
      await this.cache.del(`user:${userId}`);

      logger.info("Staff profile updated", {
        userId,
        staffId: updatedStaff.id,
        employeeCode: updatedStaff.employeeCode,
      });

      return await this.getUserById(userId);
    } catch (error) {
      logger.error("Update staff profile failed", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Change user role
   */
  async changeUserRole(userId, newRole, changedBy) {
    try {
      const db = this.getDb();
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          customer: true,
          staff: true,
        },
      });

      if (!user) {
        throw new NotFoundError("User");
      }

      const oldRole = user.role;

      await db.$transaction(async (prisma) => {
        // Update user role
        await prisma.user.update({
          where: { id: userId },
          data: { role: newRole },
        });

        // Handle profile creation/deletion based on role change
        const isOldRoleCustomer = oldRole === "END_USER";
        const isNewRoleCustomer = newRole === "END_USER";
        const isOldRoleStaff = [
          "ADMIN",
          "DELIVERY",
          "CASHIER",
          "KITCHEN",
          "HALL_MANAGER",
        ].includes(oldRole);
        const isNewRoleStaff = [
          "ADMIN",
          "DELIVERY",
          "CASHIER",
          "KITCHEN",
          "HALL_MANAGER",
        ].includes(newRole);

        // Create customer profile if needed
        if (!isOldRoleCustomer && isNewRoleCustomer && !user.customer) {
          await prisma.customer.create({
            data: {
              userId,
              loyaltyPoints: 0,
            },
          });
        }

        // Create staff profile if needed
        if (!isOldRoleStaff && isNewRoleStaff && !user.staff) {
          await prisma.staff.create({
            data: {
              userId,
              employeeCode: this.generateEmployeeCode(newRole),
              hireDate: new Date(),
              isOnDuty: false,
            },
          });
        }
      });

      // Clear cache
      await this.cache.del(`user:${userId}`);

      logger.info("User role changed successfully", {
        userId,
        oldRole,
        newRole,
        changedBy: changedBy?.id || "system",
      });

      return await this.getUserById(userId);
    } catch (error) {
      logger.error("Change user role failed", {
        userId,
        newRole,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    try {
      const db = this.getDb();
      const cacheKey = "user_stats";
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const [totalUsers, activeUsers, roleStats, recentUsers] =
          await Promise.all([
            db.user.count(),
            db.user.count({ where: { isActive: true } }),
            db.user.groupBy({
              by: ["role"],
              _count: true,
            }),
            db.user.count({
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
              },
            }),
          ]);

        stats = {
          totalUsers,
          activeUsers,
          inactiveUsers: totalUsers - activeUsers,
          roleDistribution: roleStats.reduce((acc, item) => {
            acc[item.role] = item._count;
            return acc;
          }, {}),
          recentRegistrations: recentUsers,
          timestamp: new Date().toISOString(),
        };

        // Cache for 30 minutes
        await this.cache.set(cacheKey, stats, 1800);
      }

      return stats;
    } catch (error) {
      logger.error("Get user stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate employee code
   */
  generateEmployeeCode(role) {
    const rolePrefix = {
      ADMIN: "ADM",
      DELIVERY: "DEL",
      CASHIER: "CSH",
      KITCHEN: "KTC",
      HALL_MANAGER: "HMG",
    };

    const prefix = rolePrefix[role] || "EMP";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 4).toUpperCase();

    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Blacklist all user tokens
   */
  async blacklistUserTokens(userId) {
    try {
      // This would typically involve getting all active tokens for the user
      // and blacklisting them. For now, we'll just remove the refresh token
      await redisClient.del(`refresh_token:${userId}`);
      await redisClient.del(`user:${userId}:last_activity`);
    } catch (error) {
      logger.error("Failed to blacklist user tokens", {
        userId,
        error: error.message,
      });
    }
  }
}

const usersService = new UsersService();
export default usersService;