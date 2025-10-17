import { getDatabaseClient } from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from "../../middleware/errorHandler.js";

/**
 * Customers Service V2
 * Handles customer management, loyalty points, addresses, and analytics
 */
class CustomersService {
  constructor() {
    this.cache = redisClient.cache(1800); // 30 minutes cache
    this.loyaltyPointsPerSAR = 1; // 1 point per SAR spent
    this.loyaltyPointValue = 0.1; // 1 point = 0.1 SAR
  }

  // ==================== HELPER METHODS ====================
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

  async getUserWithCustomerProfile(userId) {
    try {
      const db = this.getDb();
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          customer: true,
        },
      });
      return user;
    } catch (error) {
      logger.error("Get user with customer profile failed", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  _checkCustomerAccess(user, customerId) {
    if (
      user.role === "END_USER" &&
      user.customer &&
      user.customer.id !== customerId
    ) {
      throw new AuthorizationError("You can only access your own data");
    }
  }
  /**
   * Check if user can access customer data
   */
  _checkCustomerAccess(user, customerId) {
    if (
      user.role === "END_USER" &&
      user.customer &&
      user.customer.id !== customerId
    ) {
      throw new AuthorizationError("You can only access your own data");
    }
  }

  /**
   * Get date range based on period
   */
  _getDateRange(period, dateFrom, dateTo) {
    let startDate, endDate;
    endDate = dateTo ? new Date(dateTo) : new Date();

    switch (period) {
      case "day":
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(
          endDate.getFullYear() - 1,
          endDate.getMonth(),
          endDate.getDate()
        );
        break;
      default:
        startDate = dateFrom
          ? new Date(dateFrom)
          : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  /**
   * Build where clause for customer search
   */
  _buildCustomerWhereClause(options) {
    const {
      search,
      city,
      district,
      deliveryAreaId,
      loyaltyPointsMin,
      loyaltyPointsMax,
      hasOrders,
    } = options;

    const where = {};

    // Search functionality
    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // Location filters
    if (city) where.city = { contains: city, mode: "insensitive" };
    if (district) where.district = { contains: district, mode: "insensitive" };
    if (deliveryAreaId) where.deliveryAreaId = deliveryAreaId;

    // Loyalty points range
    if (loyaltyPointsMin !== undefined || loyaltyPointsMax !== undefined) {
      where.loyaltyPoints = {};
      if (loyaltyPointsMin !== undefined)
        where.loyaltyPoints.gte = loyaltyPointsMin;
      if (loyaltyPointsMax !== undefined)
        where.loyaltyPoints.lte = loyaltyPointsMax;
    }

    // Has orders filter
    if (hasOrders !== undefined) {
      if (hasOrders) {
        where.orders = { some: {} };
      } else {
        where.orders = { none: {} };
      }
    }

    return where;
  }

  // ==================== CUSTOMER MANAGEMENT ====================

  /**
   * Get all customers with pagination and filtering
   */
  async getAllCustomers(options = {}) {
    try {
      const db = this.getDb();
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;
      const where = this._buildCustomerWhereClause(options);

      const [total, customers] = await Promise.all([
        db.customer.count({ where }),
        db.customer.findMany({
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
                createdAt: true,
              },
            },
            deliveryArea: {
              select: {
                areaName: true,
                deliveryFee: true,
              },
            },
            _count: {
              select: {
                orders: true,
                companyCustomers: true,
              },
            },
          },
        }),
      ]);

      // Calculate total spent for each customer
      const customerIds = customers.map((c) => c.id);
      const orderTotals = await db.order.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customerIds },
          orderStatus: { not: "CANCELLED" },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      });

      const enrichedCustomers = customers.map((customer) => {
        const orderData = orderTotals.find(
          (ot) => ot.customerId === customer.id
        );
        return {
          ...customer,
          fullName: `${customer.user.firstName} ${customer.user.lastName}`,
          totalOrders: customer._count.orders,
          totalSpent: Number(orderData?._sum.totalAmount) || 0,
          isCompanyCustomer: customer._count.companyCustomers > 0,
        };
      });

      return {
        customers: enrichedCustomers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get all customers failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId, user) {
    try {
      const db = this.getDb();

      this._checkCustomerAccess(user, customerId);

      const cacheKey = `customer:${customerId}`;
      let customer = await this.cache.get(cacheKey);

      if (!customer) {
        customer = await db.customer.findUnique({
          where: { id: customerId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            deliveryArea: {
              select: {
                id: true,
                areaName: true,
                deliveryFee: true,
                estimatedDeliveryTime: true,
              },
            },
            companyCustomers: {
              where: { isActive: true },
              select: {
                id: true,
                companyName: true,
                taxNumber: true,
                contactPerson: true,
                contactPhone: true,
              },
            },
            _count: {
              select: {
                orders: true,
                tableReservations: true,
                partyOrders: true,
                buffetBookings: true,
                invoices: true,
              },
            },
          },
        });

        if (!customer) {
          throw new NotFoundError("Customer not found");
        }

        await this.cache.set(cacheKey, customer, 1800);
      }

      // Get recent orders and spending stats
      const [recentOrders, spendingStats] = await Promise.all([
        db.order.findMany({
          where: { customerId },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            orderStatus: true,
            totalAmount: true,
            createdAt: true,
          },
        }),
        db.order.aggregate({
          where: {
            customerId,
            orderStatus: { not: "CANCELLED" },
          },
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),
      ]);

      return {
        ...customer,
        fullName: `${customer.user.firstName} ${customer.user.lastName}`,
        totalOrders: customer._count.orders,
        totalSpent: Number(spendingStats._sum.totalAmount) || 0,
        averageOrderValue:
          spendingStats._count._all > 0
            ? Number(spendingStats._sum.totalAmount) / spendingStats._count._all
            : 0,
        recentOrders,
        loyaltyPointsValue: customer.loyaltyPoints * this.loyaltyPointValue,
      };
    } catch (error) {
      logger.error("Get customer by ID failed", {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update customer profile
   */
  async updateCustomer(customerId, updateData, updatedBy) {
    try {
      const db = this.getDb();

      this._checkCustomerAccess(updatedBy, customerId);

      const existingCustomer = await db.customer.findUnique({
        where: { id: customerId },
        include: { user: true },
      });

      if (!existingCustomer) {
        throw new NotFoundError("Customer not found");
      }

      // Separate user data from customer data
      const { firstName, lastName, phone, email, ...customerData } = updateData;
      const userData = { firstName, lastName, phone, email };

      // Remove undefined values
      Object.keys(userData).forEach(
        (key) => userData[key] === undefined && delete userData[key]
      );
      Object.keys(customerData).forEach(
        (key) => customerData[key] === undefined && delete customerData[key]
      );

      // Update in transaction
      const updatedCustomer = await db.$transaction(async (prisma) => {
        // Update user data if provided
        if (Object.keys(userData).length > 0) {
          await prisma.user.update({
            where: { id: existingCustomer.userId },
            data: userData,
          });
        }

        // Update customer data if provided
        if (Object.keys(customerData).length > 0) {
          await prisma.customer.update({
            where: { id: customerId },
            data: customerData,
          });
        }

        // Return updated customer
        return await prisma.customer.findUnique({
          where: { id: customerId },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            deliveryArea: {
              select: {
                areaName: true,
                deliveryFee: true,
              },
            },
          },
        });
      });

      // Clear cache
      await this.cache.del(`customer:${customerId}`);

      logger.info("Customer updated successfully", {
        customerId,
        updatedBy: updatedBy.id,
      });

      return updatedCustomer;
    } catch (error) {
      logger.error("Update customer failed", {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete customer (admin only)
   */
  async deleteCustomer(customerId, deletedBy) {
    try {
      const db = this.getDb();

      const customer = await db.customer.findUnique({
        where: { id: customerId },
        include: {
          _count: {
            select: {
              orders: true,
              partyOrders: true,
              buffetBookings: true,
            },
          },
        },
      });

      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      const totalActivities =
        customer._count.orders +
        customer._count.partyOrders +
        customer._count.buffetBookings;

      if (totalActivities > 0) {
        throw new ConflictError(
          "Cannot delete customer with existing orders or bookings. Consider deactivating the account instead."
        );
      }

      // Delete customer and associated user
      await db.$transaction(async (prisma) => {
        await prisma.customer.delete({ where: { id: customerId } });
        await prisma.user.delete({ where: { id: customer.userId } });
      });

      // Clear cache
      await this.cache.del(`customer:${customerId}`);

      logger.info("Customer deleted successfully", {
        customerId,
        deletedBy: deletedBy.id,
      });
    } catch (error) {
      logger.error("Delete customer failed", {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== LOYALTY POINTS ====================

  /**
   * Get loyalty points and history
   */
  async getLoyaltyPoints(customerId, user) {
    try {
      const db = this.getDb();

      this._checkCustomerAccess(user, customerId);

      const customer = await db.customer.findUnique({
        where: { id: customerId },
        select: {
          loyaltyPoints: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      return {
        customerId,
        customerName: `${customer.user.firstName} ${customer.user.lastName}`,
        currentPoints: customer.loyaltyPoints,
        pointsValue: customer.loyaltyPoints * this.loyaltyPointValue,
        conversionRate: {
          earnRate: `${this.loyaltyPointsPerSAR} point per SAR spent`,
          redeemRate: `1 point = ${this.loyaltyPointValue} SAR`,
        },
      };
    } catch (error) {
      logger.error("Get loyalty points failed", {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add loyalty points (staff only or system)
   */
  async addLoyaltyPoints(customerId, points, reason, addedBy) {
    try {
      const db = this.getDb();

      if (points <= 0) {
        throw new AppError("Points must be positive", 400);
      }

      const customer = await db.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      const updatedCustomer = await db.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: { increment: points },
        },
      });

      // Clear cache
      await this.cache.del(`customer:${customerId}`);

      logger.info("Loyalty points added", {
        customerId,
        pointsAdded: points,
        newBalance: updatedCustomer.loyaltyPoints,
        reason,
        addedBy: addedBy?.id,
      });

      return {
        pointsAdded: points,
        newBalance: updatedCustomer.loyaltyPoints,
        reason,
      };
    } catch (error) {
      logger.error("Add loyalty points failed", {
        customerId,
        points,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Redeem loyalty points
   */
  async redeemLoyaltyPoints(customerId, points, reason, redeemedBy) {
    try {
      const db = this.getDb();

      if (points <= 0) {
        throw new AppError("Points must be positive", 400);
      }

      this._checkCustomerAccess(redeemedBy, customerId);

      const customer = await db.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      if (customer.loyaltyPoints < points) {
        throw new AppError(
          `Insufficient loyalty points. Available: ${customer.loyaltyPoints}, Requested: ${points}`,
          400
        );
      }

      const updatedCustomer = await db.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: { decrement: points },
        },
      });

      // Clear cache
      await this.cache.del(`customer:${customerId}`);

      const redemptionValue = points * this.loyaltyPointValue;

      logger.info("Loyalty points redeemed", {
        customerId,
        pointsRedeemed: points,
        redemptionValue,
        newBalance: updatedCustomer.loyaltyPoints,
        reason,
        redeemedBy: redeemedBy?.id,
      });

      return {
        pointsRedeemed: points,
        redemptionValue,
        newBalance: updatedCustomer.loyaltyPoints,
        reason,
      };
    } catch (error) {
      logger.error("Redeem loyalty points failed", {
        customerId,
        points,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== CUSTOMER ORDERS ====================

  /**
   * Get customer orders
   */
  async getCustomerOrders(customerId, options = {}, user) {
    try {
      const db = this.getDb();

      this._checkCustomerAccess(user, customerId);

      const {
        page = 1,
        limit = 10,
        status,
        orderType,
        dateFrom,
        dateTo,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;
      const where = { customerId };

      // Status filter
      if (status) where.orderStatus = status;

      // Order type filter
      if (orderType) where.orderType = orderType;

      // Date range filter
      if (dateFrom || dateTo) {
        where.orderDateTime = {};
        if (dateFrom) where.orderDateTime.gte = new Date(dateFrom);
        if (dateTo) where.orderDateTime.lte = new Date(dateTo);
      }

      const [total, orders] = await Promise.all([
        db.order.count({ where }),
        db.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            orderStatus: true,
            customerType: true,
            subtotal: true,
            taxAmount: true,
            deliveryFee: true,
            discountAmount: true,
            totalAmount: true,
            orderDateTime: true,
            estimatedReadyTime: true,
            estimatedDeliveryTime: true,
            isPaid: true,
            createdAt: true,
          },
        }),
      ]);

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get customer orders failed", {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get customer order statistics
   */
  async getCustomerOrderStats(customerId, user) {
    try {
      const db = this.getDb();

      this._checkCustomerAccess(user, customerId);

      const [totalStats, statusBreakdown, favoriteOrderTypes] =
        await Promise.all([
          // Total statistics
          db.order.aggregate({
            where: {
              customerId,
              orderStatus: { not: "CANCELLED" },
            },
            _sum: { totalAmount: true },
            _count: { _all: true },
            _avg: { totalAmount: true },
          }),

          // Status breakdown
          db.order.groupBy({
            by: ["orderStatus"],
            where: { customerId },
            _count: { _all: true },
          }),

          // Favorite order types
          db.order.groupBy({
            by: ["orderType"],
            where: { customerId },
            _count: { _all: true },
            _sum: { totalAmount: true },
          }),
        ]);

      return {
        overview: {
          totalOrders: totalStats._count._all,
          totalSpent: Number(totalStats._sum.totalAmount) || 0,
          averageOrderValue: Number(totalStats._avg.totalAmount) || 0,
        },
        statusBreakdown,
        favoriteOrderTypes: favoriteOrderTypes.sort(
          (a, b) => b._count._all - a._count._all
        ),
      };
    } catch (error) {
      logger.error("Get customer order stats failed", {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== CUSTOMER ANALYTICS ====================

  /**
   * Get customer analytics (admin/manager only)
   */
  async getCustomerAnalytics(options = {}) {
    try {
      const db = this.getDb();

      const { period = "month", dateFrom, dateTo, city, district } = options;
      const { startDate, endDate } = this._getDateRange(
        period,
        dateFrom,
        dateTo
      );

      const where = {};
      if (city) where.city = { contains: city, mode: "insensitive" };
      if (district)
        where.district = { contains: district, mode: "insensitive" };

      const [
        totalCustomers,
        newCustomers,
        customersByLocation,
        loyaltyDistribution,
      ] = await Promise.all([
        // Total customers
        db.customer.count({ where }),

        // New customers in period
        db.customer.count({
          where: {
            ...where,
            user: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        }),

        // Customers by location
        db.customer.groupBy({
          by: ["city", "district"],
          where,
          _count: { _all: true },
        }),

        // Loyalty points distribution
        db.customer.groupBy({
          by: ["loyaltyPoints"],
          where,
          _count: { _all: true },
        }),
      ]);

      // Process loyalty distribution
      const loyaltyRanges = {
        0: 0,
        "1-100": 0,
        "101-500": 0,
        "501-1000": 0,
        "1000+": 0,
      };

      loyaltyDistribution.forEach((item) => {
        const points = item.loyaltyPoints;
        if (points === 0) loyaltyRanges["0"] += item._count._all;
        else if (points <= 100) loyaltyRanges["1-100"] += item._count._all;
        else if (points <= 500) loyaltyRanges["101-500"] += item._count._all;
        else if (points <= 1000) loyaltyRanges["501-1000"] += item._count._all;
        else loyaltyRanges["1000+"] += item._count._all;
      });

      return {
        overview: {
          totalCustomers,
          newCustomers,
          growthRate:
            totalCustomers > 0
              ? ((newCustomers / totalCustomers) * 100).toFixed(2)
              : 0,
        },
        customersByLocation: customersByLocation.slice(0, 10),
        loyaltyDistribution: loyaltyRanges,
        period: {
          from: startDate,
          to: endDate,
        },
      };
    } catch (error) {
      logger.error("Get customer analytics failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get top customers by spending - COMPLETED
   */
  async getTopCustomers(options = {}) {
    try {
      const db = this.getDb();

      const { limit = 10, period = "all", orderType, city, district } = options;

      // Build date filter
      let dateFilter = {};
      if (period !== "all") {
        const { startDate, endDate } = this._getDateRange(period);
        dateFilter = {
          orderDateTime: {
            gte: startDate,
            lte: endDate,
          },
        };
      }

      // Build order where clause
      const orderWhere = {
        orderStatus: { not: "CANCELLED" },
        ...dateFilter,
      };

      if (orderType) {
        orderWhere.orderType = orderType;
      }

      // Get customer spending data
      const customerSpending = await db.order.groupBy({
        by: ["customerId"],
        where: orderWhere,
        _sum: {
          totalAmount: true,
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _sum: {
            totalAmount: "desc",
          },
        },
        take: limit * 2, // Get more to filter by location if needed
      });

      // Get customer details
      const customerIds = customerSpending.map((cs) => cs.customerId);

      const customerWhere = {
        id: { in: customerIds },
      };

      // Add location filters
      if (city) customerWhere.city = { contains: city, mode: "insensitive" };
      if (district)
        customerWhere.district = { contains: district, mode: "insensitive" };

      const customers = await db.customer.findMany({
        where: customerWhere,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          deliveryArea: {
            select: {
              areaName: true,
            },
          },
        },
      });

      // Combine spending data with customer details
      const topCustomers = customerSpending
        .map((spending) => {
          const customer = customers.find((c) => c.id === spending.customerId);
          if (!customer) return null;

          return {
            id: customer.id,
            fullName: `${customer.user.firstName} ${customer.user.lastName}`,
            email: customer.user.email,
            phone: customer.user.phone,
            city: customer.city,
            district: customer.district,
            deliveryArea: customer.deliveryArea?.areaName || "N/A",
            loyaltyPoints: customer.loyaltyPoints,
            totalSpent: Number(spending._sum.totalAmount) || 0,
            totalOrders: spending._count._all,
            averageOrderValue:
              spending._count._all > 0
                ? Number(spending._sum.totalAmount) / spending._count._all
                : 0,
          };
        })
        .filter(Boolean)
        .slice(0, limit);

      return {
        topCustomers,
        period: period !== "all" ? this._getDateRange(period) : null,
        filters: {
          orderType,
          city,
          district,
        },
      };
    } catch (error) {
      logger.error("Get top customers failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get customer retention analytics
   */
  async getCustomerRetention(options = {}) {
    try {
      const db = this.getDb();

      const { period = "month" } = options;
      const { startDate, endDate } = this._getDateRange(period);

      // Get customers who made orders in both current and previous period
      const previousStartDate = new Date(
        startDate.getTime() - (endDate.getTime() - startDate.getTime())
      );

      const [currentPeriodCustomers, previousPeriodCustomers] =
        await Promise.all([
          db.order.findMany({
            where: {
              orderDateTime: { gte: startDate, lte: endDate },
              orderStatus: { not: "CANCELLED" },
            },
            select: { customerId: true },
            distinct: ["customerId"],
          }),
          db.order.findMany({
            where: {
              orderDateTime: { gte: previousStartDate, lt: startDate },
              orderStatus: { not: "CANCELLED" },
            },
            select: { customerId: true },
            distinct: ["customerId"],
          }),
        ]);

      const currentCustomerIds = new Set(
        currentPeriodCustomers.map((o) => o.customerId)
      );
      const previousCustomerIds = new Set(
        previousPeriodCustomers.map((o) => o.customerId)
      );

      const retainedCustomers = [...previousCustomerIds].filter((id) =>
        currentCustomerIds.has(id)
      );
      const newCustomers = [...currentCustomerIds].filter(
        (id) => !previousCustomerIds.has(id)
      );

      const retentionRate =
        previousCustomerIds.size > 0
          ? (
              (retainedCustomers.length / previousCustomerIds.size) *
              100
            ).toFixed(2)
          : 0;

      return {
        currentPeriod: {
          totalCustomers: currentCustomerIds.size,
          newCustomers: newCustomers.length,
          retainedCustomers: retainedCustomers.length,
        },
        previousPeriod: {
          totalCustomers: previousCustomerIds.size,
        },
        retentionRate: `${retentionRate}%`,
        period: { startDate, endDate },
      };
    } catch (error) {
      logger.error("Get customer retention failed", { error: error.message });
      throw error;
    }
  }
  // ==================== CUSTOMER ADDRESSES ====================

  /**
   * Get customer addresses
   */
  async getCustomerAddresses(customerId, user) {
    try {
      const db = this.getDb();
      this._checkCustomerAccess(user, customerId);

      const addresses = await db.customerAddress.findMany({
        where: {
          customerId,
          deletedAt: null,
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        include: {
          deliveryArea: {
            select: {
              id: true,
              areaName: true,
              deliveryFee: true,
              estimatedDeliveryTime: true,
            },
          },
        },
      });

      return addresses;
    } catch (error) {
      logger.error("Get customer addresses failed", {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add customer address
   */
  async addCustomerAddress(customerId, addressData, user) {
    try {
      const db = this.getDb();
      this._checkCustomerAccess(user, customerId);

      // Verify customer exists
      const customer = await db.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      // Verify delivery area exists
      if (addressData.deliveryAreaId) {
        const deliveryArea = await db.deliveryArea.findUnique({
          where: {
            id: addressData.deliveryAreaId,
            isActive: true,
          },
        });

        if (!deliveryArea) {
          throw new NotFoundError("Delivery area not found or inactive");
        }
      }

      // If this is set as default, unset other defaults
      if (addressData.isDefault) {
        await db.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }

      const address = await db.customerAddress.create({
        data: {
          customerId,
          ...addressData,
        },
        include: {
          deliveryArea: {
            select: {
              areaName: true,
              deliveryFee: true,
            },
          },
        },
      });

      logger.info("Customer address added", {
        customerId,
        addressId: address.id,
      });

      return address;
    } catch (error) {
      logger.error("Add customer address failed", {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update customer address
   */
  async updateCustomerAddress(customerId, addressId, updateData, user) {
    try {
      const db = this.getDb();
      this._checkCustomerAccess(user, customerId);

      // Verify address belongs to customer
      const existingAddress = await db.customerAddress.findFirst({
        where: {
          id: addressId,
          customerId,
          deletedAt: null,
        },
      });

      if (!existingAddress) {
        throw new NotFoundError("Address not found");
      }

      // Verify delivery area if being updated
      if (updateData.deliveryAreaId) {
        const deliveryArea = await db.deliveryArea.findUnique({
          where: {
            id: updateData.deliveryAreaId,
            isActive: true,
          },
        });

        if (!deliveryArea) {
          throw new NotFoundError("Delivery area not found or inactive");
        }
      }

      // If setting as default, unset others
      if (updateData.isDefault) {
        await db.customerAddress.updateMany({
          where: {
            customerId,
            NOT: { id: addressId },
          },
          data: { isDefault: false },
        });
      }

      const updatedAddress = await db.customerAddress.update({
        where: { id: addressId },
        data: updateData,
        include: {
          deliveryArea: {
            select: {
              areaName: true,
              deliveryFee: true,
            },
          },
        },
      });

      logger.info("Customer address updated", {
        customerId,
        addressId,
      });

      return updatedAddress;
    } catch (error) {
      logger.error("Update customer address failed", {
        customerId,
        addressId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete customer address
   */
  async deleteCustomerAddress(customerId, addressId, user) {
    try {
      const db = this.getDb();
      this._checkCustomerAccess(user, customerId);

      // Verify address belongs to customer
      const address = await db.customerAddress.findFirst({
        where: {
          id: addressId,
          customerId,
          deletedAt: null,
        },
      });

      if (!address) {
        throw new NotFoundError("Address not found");
      }

      // Soft delete
      await db.customerAddress.update({
        where: { id: addressId },
        data: { deletedAt: new Date() },
      });

      logger.info("Customer address deleted", {
        customerId,
        addressId,
      });
    } catch (error) {
      logger.error("Delete customer address failed", {
        customerId,
        addressId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Set default address
   */
  async setDefaultAddress(customerId, addressId, user) {
    try {
      const db = this.getDb();
      this._checkCustomerAccess(user, customerId);

      // Verify address belongs to customer
      const address = await db.customerAddress.findFirst({
        where: {
          id: addressId,
          customerId,
          deletedAt: null,
        },
      });

      if (!address) {
        throw new NotFoundError("Address not found");
      }

      // Unset all defaults for this customer
      await db.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });

      // Set this one as default
      const updatedAddress = await db.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
        include: {
          deliveryArea: {
            select: {
              areaName: true,
              deliveryFee: true,
            },
          },
        },
      });

      logger.info("Default address set", {
        customerId,
        addressId,
      });

      return updatedAddress;
    } catch (error) {
      logger.error("Set default address failed", {
        customerId,
        addressId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get loyalty points history (placeholder - needs implementation)
   */
  async getLoyaltyPointsHistory(customerId, options = {}, user) {
    try {
      const db = this.getDb();
      this._checkCustomerAccess(user, customerId);

      // TODO: Implement loyalty history table
      // For now, return empty array
      return {
        history: [],
        pagination: {
          page: options.page || 1,
          limit: options.limit || 20,
          total: 0,
          totalPages: 0,
        },
      };
    } catch (error) {
      logger.error("Get loyalty history failed", {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== COMPANY CUSTOMERS ====================

  /**
   * Get all company customers with pagination
   */
  async getCompanyCustomers(options = {}) {
    try {
      const db = this.getDb();
      const {
        page = 1,
        limit = 10,
        search,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;
      const where = {};

      // Search filter
      if (search) {
        where.OR = [
          { companyName: { contains: search, mode: "insensitive" } },
          { taxNumber: { contains: search, mode: "insensitive" } },
          { contactPerson: { contains: search, mode: "insensitive" } },
        ];
      }

      // Active filter
      if (typeof isActive === "boolean") {
        where.isActive = isActive;
      }

      const [total, companies] = await Promise.all([
        db.companyCustomer.count({ where }),
        db.companyCustomer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            customer: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
            _count: {
              select: {
                orders: true,
                invoices: true,
              },
            },
          },
        }),
      ]);

      // Calculate total spending
      const companyIds = companies.map((c) => c.id);
      const orderTotals = await db.order.groupBy({
        by: ["companyId"],
        where: {
          companyId: { in: companyIds },
          orderStatus: { not: "CANCELLED" },
        },
        _sum: { totalAmount: true },
      });

      const enrichedCompanies = companies.map((company) => {
        const orderData = orderTotals.find((ot) => ot.companyId === company.id);
        return {
          ...company,
          totalOrders: company._count.orders,
          totalSpent: Number(orderData?._sum.totalAmount) || 0,
        };
      });

      return {
        companies: enrichedCompanies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get company customers failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get company customer by ID
   */
  async getCompanyCustomerById(companyId, user) {
    try {
      const db = this.getDb();

      const company = await db.companyCustomer.findUnique({
        where: { id: companyId },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          _count: {
            select: {
              orders: true,
              invoices: true,
            },
          },
        },
      });

      if (!company) {
        throw new NotFoundError("Company customer not found");
      }

      // Get spending stats
      const spendingStats = await db.order.aggregate({
        where: {
          companyId: companyId,
          orderStatus: { not: "CANCELLED" },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      });

      return {
        ...company,
        totalOrders: company._count.orders,
        totalSpent: Number(spendingStats._sum.totalAmount) || 0,
        averageOrderValue:
          spendingStats._count._all > 0
            ? Number(spendingStats._sum.totalAmount) / spendingStats._count._all
            : 0,
      };
    } catch (error) {
      logger.error("Get company customer by ID failed", {
        companyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create company customer
   */
  async createCompanyCustomer(data, createdBy) {
    try {
      const db = this.getDb();
      const {
        customerId,
        companyName,
        taxNumber,
        commercialRegister,
        nationalAddress,
        contactPerson,
        contactPhone,
        isActive,
      } = data;

      // Verify customer exists
      const customer = await db.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      // Check if tax number already exists
      if (taxNumber) {
        const existingTax = await db.companyCustomer.findUnique({
          where: { taxNumber },
        });

        if (existingTax) {
          throw new ConflictError("Tax number already exists");
        }
      }

      // Check if commercial register already exists
      if (commercialRegister) {
        const existingCR = await db.companyCustomer.findUnique({
          where: { commercialRegister },
        });

        if (existingCR) {
          throw new ConflictError("Commercial register already exists");
        }
      }

      const company = await db.companyCustomer.create({
        data: {
          customerId,
          companyName,
          taxNumber,
          commercialRegister,
          nationalAddress,
          contactPerson,
          contactPhone,
          isActive: isActive !== undefined ? isActive : true,
        },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      logger.info("Company customer created", {
        companyId: company.id,
        companyName: company.companyName,
        createdBy: createdBy?.id,
      });

      return company;
    } catch (error) {
      logger.error("Create company customer failed", {
        companyName: data.companyName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update company customer
   */
  async updateCompanyCustomer(companyId, updateData, updatedBy) {
    try {
      const db = this.getDb();

      const existingCompany = await db.companyCustomer.findUnique({
        where: { id: companyId },
      });

      if (!existingCompany) {
        throw new NotFoundError("Company customer not found");
      }

      // Check tax number uniqueness if being updated
      if (
        updateData.taxNumber &&
        updateData.taxNumber !== existingCompany.taxNumber
      ) {
        const duplicateTax = await db.companyCustomer.findUnique({
          where: { taxNumber: updateData.taxNumber },
        });

        if (duplicateTax) {
          throw new ConflictError("Tax number already exists");
        }
      }

      // Check commercial register uniqueness if being updated
      if (
        updateData.commercialRegister &&
        updateData.commercialRegister !== existingCompany.commercialRegister
      ) {
        const duplicateCR = await db.companyCustomer.findUnique({
          where: { commercialRegister: updateData.commercialRegister },
        });

        if (duplicateCR) {
          throw new ConflictError("Commercial register already exists");
        }
      }

      const updatedCompany = await db.companyCustomer.update({
        where: { id: companyId },
        data: updateData,
        include: {
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      logger.info("Company customer updated", {
        companyId,
        updatedBy: updatedBy?.id,
      });

      return updatedCompany;
    } catch (error) {
      logger.error("Update company customer failed", {
        companyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete company customer (soft delete)
   */
  async deleteCompanyCustomer(companyId, deletedBy) {
    try {
      const db = this.getDb();

      const company = await db.companyCustomer.findUnique({
        where: { id: companyId },
        include: {
          _count: {
            select: {
              orders: true,
            },
          },
        },
      });

      if (!company) {
        throw new NotFoundError("Company customer not found");
      }

      // Check if company has orders
      if (company._count.orders > 0) {
        throw new ConflictError(
          `Cannot delete company customer with ${company._count.orders} existing orders. Deactivate it instead.`
        );
      }

      // Soft delete
      await db.companyCustomer.update({
        where: { id: companyId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      logger.info("Company customer deleted", {
        companyId,
        deletedBy: deletedBy?.id,
      });
    } catch (error) {
      logger.error("Delete company customer failed", {
        companyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Export customers data (placeholder)
   */
  async exportCustomersData(options, user) {
    // TODO: Implement export functionality using ExcelJS or similar
    throw new AppError("Export functionality not implemented yet", 501);
  }
}
const customersService = new CustomersService();
export default customersService;
