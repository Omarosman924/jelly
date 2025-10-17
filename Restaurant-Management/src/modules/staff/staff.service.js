import { getDatabaseClient } from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from "../../middleware/errorHandler.js";
import bcrypt from "bcryptjs";

/**
 * Staff Service V2
 * Handles staff management, shifts, attendance, and performance
 */
class StaffService {
  constructor() {
    // لا نقوم بإنشاء المراجع فوراً، بل نتركها للاستدعاء عند الحاجة
    this._cache = null;
    this.standardWorkHours = 8;
    this.overtimeRate = 1.5;
  }

  /**
   * Get database client (lazy loading)
   */
  get db() {
    if (!db) {
      db = getDatabaseClient();
      if (!db) {
        throw new AppError("Database client not initialized", 500);
      }
    }
    return db;
  }

  /**
   * Get cache client (lazy loading)
   */
  get cache() {
    if (!this._cache) {
      this._cache = redisClient.cache(1800); // 30 minutes cache
    }
    return this._cache;
  }

  // ==================== STAFF MANAGEMENT ====================

  /**
   * Get all staff members with pagination and filtering
   */
  async getAllStaff(options = {}) {
    try {
      const db = this.getDb();
      const {
        page = 1,
        limit = 10,
        search,
        role,
        shiftType,
        isOnDuty,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;
      const where = {};

      // Search functionality
      if (search) {
        where.OR = [
          { employeeCode: { contains: search, mode: "insensitive" } },
          {
            user: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ];
      }

      // Filters
      if (role) where.user = { role };
      if (shiftType) where.shiftType = shiftType;
      if (typeof isOnDuty === "boolean") where.isOnDuty = isOnDuty;
      if (typeof isActive === "boolean")
        where.user = { ...where.user, isActive };

      const [total, staff] = await Promise.all([
        db.staff.count({ where }),
        db.staff.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                ordersCashier: true,
                ordersKitchen: true,
                ordersHallManager: true,
                ordersDelivery: true,
              },
            },
          },
        }),
      ]);

      // Calculate additional metrics for each staff member
      const enrichedStaff = await Promise.all(
        staff.map(async (staffMember) => {
          // Get current month attendance
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const currentShift = await db.staffShift.findFirst({
            where: {
              staffId: staffMember.id,
              clockOutTime: null,
            },
          });

          const monthlyAttendance = await db.staffShift.count({
            where: {
              staffId: staffMember.id,
              clockInTime: { gte: startOfMonth },
              clockOutTime: { not: null },
            },
          });

          return {
            ...staffMember,
            fullName: `${staffMember.user.firstName} ${staffMember.user.lastName}`,
            currentlyOnDuty: !!currentShift,
            currentShiftStart: currentShift?.clockInTime || null,
            monthlyAttendance,
            totalOrdersHandled:
              staffMember._count.ordersCashier +
              staffMember._count.ordersKitchen +
              staffMember._count.ordersHallManager +
              staffMember._count.ordersDelivery,
          };
        })
      );

      return {
        staff: enrichedStaff,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get all staff failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get staff member by ID
   */
  async getStaffById(staffId, user) {
    try {
      const db = this.getDb();
      // Check permissions
      if (
        user.role !== "ADMIN" &&
        user.role !== "HALL_MANAGER" &&
        user.staff?.id !== staffId
      ) {
        throw new AuthorizationError("You can only access your own profile");
      }

      const cacheKey = `staff:${staffId}`;
      let staff = await this.cache.get(cacheKey);

      if (!staff) {
        staff = await db.staff.findUnique({
          where: { id: staffId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            _count: {
              select: {
                ordersCashier: true,
                ordersKitchen: true,
                ordersHallManager: true,
                ordersDelivery: true,
              },
            },
          },
        });

        if (!staff) {
          throw new NotFoundError("Staff member not found");
        }

        await this.cache.set(cacheKey, staff, 1800);
      }

      // Get current shift info
      const currentShift = await db.staffShift.findFirst({
        where: {
          staffId,
          clockOutTime: null,
        },
      });

      // Get recent performance metrics
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentPerformance = await this.calculateStaffPerformance(
        staffId,
        thirtyDaysAgo
      );

      return {
        ...staff,
        fullName: `${staff.user.firstName} ${staff.user.lastName}`,
        currentShift,
        totalOrdersHandled:
          staff._count.ordersCashier +
          staff._count.ordersKitchen +
          staff._count.ordersHallManager +
          staff._count.ordersDelivery,
        recentPerformance,
      };
    } catch (error) {
      logger.error("Get staff by ID failed", {
        staffId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new staff member
   */
  async createStaff(staffData, createdBy) {
    try {
      const db = this.getDb();
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        role,
        salary,
        shiftType,
        hireDate,
      } = staffData;

      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictError("User with this email already exists");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Generate employee code
      const employeeCode = await this.generateEmployeeCode(role);

      // Create user and staff profile in transaction
      const result = await db.$transaction(async (prisma) => {
        // Create user
        const user = await prisma.user.create({
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

        // Create staff profile
        const staff = await prisma.staff.create({
          data: {
            userId: user.id,
            employeeCode,
            salary: salary || 0,
            hireDate: hireDate ? new Date(hireDate) : new Date(),
            shiftType,
            isOnDuty: false,
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        });

        return staff;
      });

      logger.info("Staff member created successfully", {
        staffId: result.id,
        employeeCode,
        role,
        createdBy: createdBy.id,
      });

      return result;
    } catch (error) {
      logger.error("Create staff failed", {
        email: staffData.email,
        role: staffData.role,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update staff member
   */
  async updateStaff(staffId, updateData, updatedBy) {
    try {
      const db = this.getDb();
      // Check permissions
      if (
        updatedBy.role !== "ADMIN" &&
        updatedBy.role !== "HALL_MANAGER" &&
        updatedBy.staff?.id !== staffId
      ) {
        throw new AuthorizationError("You can only update your own profile");
      }

      const existingStaff = await db.staff.findUnique({
        where: { id: staffId },
        include: { user: true },
      });

      if (!existingStaff) {
        throw new NotFoundError("Staff member not found");
      }

      // Separate user data from staff data
      const { firstName, lastName, phone, email, role, ...staffUpdateData } =
        updateData;
      const userUpdateData = { firstName, lastName, phone, email, role };

      // Remove undefined values
      Object.keys(userUpdateData).forEach(
        (key) => userUpdateData[key] === undefined && delete userUpdateData[key]
      );
      Object.keys(staffUpdateData).forEach(
        (key) =>
          staffUpdateData[key] === undefined && delete staffUpdateData[key]
      );

      // Update in transaction
      const updatedStaff = await db.$transaction(async (prisma) => {
        // Update user data if provided
        if (Object.keys(userUpdateData).length > 0) {
          await prisma.user.update({
            where: { id: existingStaff.userId },
            data: userUpdateData,
          });
        }

        // Update staff data if provided
        if (Object.keys(staffUpdateData).length > 0) {
          await prisma.staff.update({
            where: { id: staffId },
            data: staffUpdateData,
          });
        }

        // Return updated staff
        return await prisma.staff.findUnique({
          where: { id: staffId },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
              },
            },
          },
        });
      });

      // Clear cache
      await this.cache.del(`staff:${staffId}`);

      logger.info("Staff member updated successfully", {
        staffId,
        updatedBy: updatedBy.id,
      });

      return updatedStaff;
    } catch (error) {
      logger.error("Update staff failed", {
        staffId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete staff member
   */
  async deleteStaff(staffId, deletedBy) {
    try {
      const db = this.getDb();
      const staff = await db.staff.findUnique({
        where: { id: staffId },
        include: {
          _count: {
            select: {
              ordersCashier: true,
              ordersKitchen: true,
              ordersHallManager: true,
              ordersDelivery: true,
            },
          },
        },
      });

      if (!staff) {
        throw new NotFoundError("Staff member not found");
      }

      const totalOrders =
        staff._count.ordersCashier +
        staff._count.ordersKitchen +
        staff._count.ordersHallManager +
        staff._count.ordersDelivery;

      if (totalOrders > 0) {
        throw new ConflictError(
          "Cannot delete staff member with existing order history. Consider deactivating the account instead."
        );
      }

      // Delete staff and associated user
      await db.$transaction(async (prisma) => {
        await prisma.staff.delete({ where: { id: staffId } });
        await prisma.user.delete({ where: { id: staff.userId } });
      });

      // Clear cache
      await this.cache.del(`staff:${staffId}`);

      logger.info("Staff member deleted successfully", {
        staffId,
        deletedBy: deletedBy.id,
      });
    } catch (error) {
      logger.error("Delete staff failed", {
        staffId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate unique employee code
   */
  async generateEmployeeCode(role) {
    const rolePrefix = {
      ADMIN: "ADM",
      DELIVERY: "DEL",
      CASHIER: "CSH",
      KITCHEN: "KTC",
      HALL_MANAGER: "HMG",
    };

    const prefix = rolePrefix[role] || "EMP";
    let attempts = 0;
    let employeeCode;

    do {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      employeeCode = `${prefix}-${timestamp}-${random}`;
      attempts++;

      const existing = await db.staff.findUnique({
        where: { employeeCode },
      });

      if (!existing) break;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new AppError("Failed to generate unique employee code", 500);
    }

    return employeeCode;
  }

  /**
   * Calculate staff performance metrics
   */
  async calculateStaffPerformance(staffId, dateFrom, dateTo = new Date()) {
    try {
      const db = this.getDb();
      const [totalShifts, totalHours, ordersHandled, attendanceRate] =
        await Promise.all([
          // Total shifts
          db.staffShift.count({
            where: {
              staffId,
              clockInTime: { gte: dateFrom, lte: dateTo },
              clockOutTime: { not: null },
            },
          }),

          // Total hours worked
          db.staffShift.aggregate({
            where: {
              staffId,
              clockInTime: { gte: dateFrom, lte: dateTo },
              clockOutTime: { not: null },
            },
            _sum: { hoursWorked: true },
          }),

          // Orders handled
          db.staff.findUnique({
            where: { id: staffId },
            select: {
              _count: {
                select: {
                  ordersCashier: {
                    where: { createdAt: { gte: dateFrom, lte: dateTo } },
                  },
                  ordersKitchen: {
                    where: { createdAt: { gte: dateFrom, lte: dateTo } },
                  },
                  ordersHallManager: {
                    where: { createdAt: { gte: dateFrom, lte: dateTo } },
                  },
                  ordersDelivery: {
                    where: { createdAt: { gte: dateFrom, lte: dateTo } },
                  },
                },
              },
            },
          }),

          // Attendance rate calculation
          this.calculateAttendanceRate(staffId, dateFrom, dateTo),
        ]);

      const totalOrdersHandled = ordersHandled
        ? ordersHandled._count.ordersCashier +
          ordersHandled._count.ordersKitchen +
          ordersHandled._count.ordersHallManager +
          ordersHandled._count.ordersDelivery
        : 0;

      const averageHoursPerShift =
        totalShifts > 0 ? Number(totalHours._sum.hoursWorked) / totalShifts : 0;

      return {
        period: {
          from: dateFrom,
          to: dateTo,
        },
        totalShifts,
        totalHoursWorked: Number(totalHours._sum.hoursWorked) || 0,
        averageHoursPerShift: Number(averageHoursPerShift.toFixed(2)),
        totalOrdersHandled,
        attendanceRate: Number(attendanceRate.toFixed(2)),
        ordersPerHour:
          totalHours._sum.hoursWorked > 0
            ? Number(
                (totalOrdersHandled / totalHours._sum.hoursWorked).toFixed(2)
              )
            : 0,
      };
    } catch (error) {
      logger.error("Calculate staff performance failed", {
        staffId,
        error: error.message,
      });
      return {
        totalShifts: 0,
        totalHoursWorked: 0,
        averageHoursPerShift: 0,
        totalOrdersHandled: 0,
        attendanceRate: 0,
        ordersPerHour: 0,
      };
    }
  }

  /**
   * Calculate attendance rate
   */
  async calculateAttendanceRate(staffId, dateFrom, dateTo) {
    const db = this.getDb();
    const workingDays = Math.ceil((dateTo - dateFrom) / (1000 * 60 * 60 * 24));
    const actualShifts = await db.staffShift.count({
      where: {
        staffId,
        clockInTime: { gte: dateFrom, lte: dateTo },
        clockOutTime: { not: null },
      },
    });

    return workingDays > 0 ? (actualShifts / workingDays) * 100 : 0;
  }

  /**
   * Cleanup method for service container
   */
  async cleanup() {
    try {
      // Close any open connections or resources
      this._db = null;
      this._cache = null;
      logger.info("StaffService cleaned up successfully");
    } catch (error) {
      logger.error("StaffService cleanup failed:", error);
      throw error;
    }
  }
}

const staffService = new StaffService();
export default staffService;