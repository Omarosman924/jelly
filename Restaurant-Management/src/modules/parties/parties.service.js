import {
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from "../../middleware/errorHandler.js";
import getDatabaseClient from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";

/**
 * Parties Service V2
 * Handles party types and party orders business logic
 */
class PartiesService {
  constructor() {
    this.db = getDatabaseClient();
    this.cache = redisClient.cache(1800); // 30 minutes cache
  }

  // ==================== PARTY TYPES ====================

  /**
   * Get all party types with pagination and filtering
   */
  async getAllPartyTypes(options = {}) {
    try {
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

      // Search functionality
      if (search) {
        where.OR = [
          { typeName: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      // Filter by active status
      if (typeof isActive === "boolean") {
        where.isActive = isActive;
      }

      // Get total count and party types
      const [total, partyTypes] = await Promise.all([
        this.db.partyType.count({ where }),
        this.db.partyType.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            _count: {
              select: { partyOrders: true },
            },
          },
        }),
      ]);

      return {
        partyTypes: partyTypes.map((type) => ({
          ...type,
          totalOrders: type._count.partyOrders,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get all party types failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get party type by ID
   */
  async getPartyTypeById(typeId) {
    try {
      const cacheKey = `party_type:${typeId}`;
      let partyType = await this.cache.get(cacheKey);

      if (!partyType) {
        partyType = await this.db.partyType.findUnique({
          where: { id: typeId },
          include: {
            _count: {
              select: { partyOrders: true },
            },
            partyOrders: {
              where: {
                status: { in: ["CONFIRMED", "PREPARING"] },
              },
              select: {
                id: true,
                eventDateTime: true,
                numberOfPeople: true,
                status: true,
              },
              orderBy: { eventDateTime: "asc" },
              take: 5,
            },
          },
        });

        if (!partyType) {
          throw new NotFoundError("Party type not found");
        }

        await this.cache.set(cacheKey, partyType, 1800);
      }

      return {
        ...partyType,
        totalOrders: partyType._count?.partyOrders || 0,
        upcomingOrders: partyType.partyOrders || [],
      };
    } catch (error) {
      logger.error("Get party type by ID failed", {
        typeId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new party type
   */
  async createPartyType(typeData, createdBy) {
    try {
      // Check for duplicate type name
      const existingType = await this.db.partyType.findFirst({
        where: {
          typeName: {
            equals: typeData.typeName,
            mode: "insensitive",
          },
        },
      });

      if (existingType) {
        throw new ConflictError("Party type with this name already exists");
      }

      const partyType = await this.db.partyType.create({
        data: {
          ...typeData,
          isActive: true,
        },
      });

      // Clear cache
      await this.cache.del("active_party_types");

      logger.info("Party type created successfully", {
        typeId: partyType.id,
        typeName: partyType.typeName,
        createdBy: createdBy.id,
      });

      return partyType;
    } catch (error) {
      logger.error("Create party type failed", {
        typeData,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update party type
   */
  async updatePartyType(typeId, updateData, updatedBy) {
    try {
      // Check if party type exists
      const existingType = await this.db.partyType.findUnique({
        where: { id: typeId },
      });

      if (!existingType) {
        throw new NotFoundError("Party type not found");
      }

      // Check for duplicate name if name is being updated
      if (
        updateData.typeName &&
        updateData.typeName !== existingType.typeName
      ) {
        const duplicateType = await this.db.partyType.findFirst({
          where: {
            typeName: {
              equals: updateData.typeName,
              mode: "insensitive",
            },
            id: { not: typeId },
          },
        });

        if (duplicateType) {
          throw new ConflictError("Party type with this name already exists");
        }
      }

      const updatedType = await this.db.partyType.update({
        where: { id: typeId },
        data: updateData,
      });

      // Clear cache
      await Promise.all([
        this.cache.del(`party_type:${typeId}`),
        this.cache.del("active_party_types"),
      ]);

      logger.info("Party type updated successfully", {
        typeId,
        updatedBy: updatedBy.id,
      });

      return updatedType;
    } catch (error) {
      logger.error("Update party type failed", {
        typeId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete party type
   */
  async deletePartyType(typeId, deletedBy) {
    try {
      // Check if party type exists and has no orders
      const partyType = await this.db.partyType.findUnique({
        where: { id: typeId },
        include: {
          _count: {
            select: { partyOrders: true },
          },
        },
      });

      if (!partyType) {
        throw new NotFoundError("Party type not found");
      }

      if (partyType._count.partyOrders > 0) {
        throw new ConflictError(
          "Cannot delete party type with existing orders. Deactivate instead."
        );
      }

      await this.db.partyType.delete({
        where: { id: typeId },
      });

      // Clear cache
      await Promise.all([
        this.cache.del(`party_type:${typeId}`),
        this.cache.del("active_party_types"),
      ]);

      logger.info("Party type deleted successfully", {
        typeId,
        deletedBy: deletedBy.id,
      });
    } catch (error) {
      logger.error("Delete party type failed", {
        typeId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active party types
   */
  async getActivePartyTypes() {
    try {
      const cacheKey = "active_party_types";
      let activeTypes = await this.cache.get(cacheKey);

      if (!activeTypes) {
        activeTypes = await this.db.partyType.findMany({
          where: { isActive: true },
          orderBy: { typeName: "asc" },
          select: {
            id: true,
            typeName: true,
            description: true,
            imageUrl: true,
            pricePerPerson: true,
          },
        });

        await this.cache.set(cacheKey, activeTypes, 3600);
      }

      return activeTypes;
    } catch (error) {
      logger.error("Get active party types failed", { error: error.message });
      throw error;
    }
  }

  // ==================== PARTY ORDERS ====================

  /**
   * Get all party orders with pagination and filtering
   */
  async getAllPartyOrders(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        customerId,
        status,
        dateFrom,
        dateTo,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;
      const where = {};

      // Filter by customer
      if (customerId) {
        where.customerId = customerId;
      }

      // Filter by status
      if (status) {
        where.status = status;
      }

      // Filter by date range
      if (dateFrom || dateTo) {
        where.eventDateTime = {};
        if (dateFrom) where.eventDateTime.gte = new Date(dateFrom);
        if (dateTo) where.eventDateTime.lte = new Date(dateTo);
      }

      const [total, partyOrders] = await Promise.all([
        this.db.partyOrder.count({ where }),
        this.db.partyOrder.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            partyType: {
              select: {
                typeName: true,
                imageUrl: true,
              },
            },
            customer: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                    email: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      return {
        partyOrders: partyOrders.map((order) => ({
          ...order,
          customerName: `${order.customer.user.firstName} ${order.customer.user.lastName}`,
          customerPhone: order.customer.user.phone,
          customerEmail: order.customer.user.email,
          partyTypeName: order.partyType.typeName,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get all party orders failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get party order by ID
   */
  async getPartyOrderById(orderId, user) {
    try {
      const partyOrder = await this.db.partyOrder.findUnique({
        where: { id: orderId },
        include: {
          partyType: true,
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!partyOrder) {
        throw new NotFoundError("Party order not found");
      }

      // Check access permissions
      if (
        user.role === "END_USER" &&
        user.customer &&
        partyOrder.customerId !== user.customer.id
      ) {
        throw new AuthorizationError("You can only view your own party orders");
      }

      return {
        ...partyOrder,
        customerName: `${partyOrder.customer.user.firstName} ${partyOrder.customer.user.lastName}`,
        customerPhone: partyOrder.customer.user.phone,
        customerEmail: partyOrder.customer.user.email,
      };
    } catch (error) {
      logger.error("Get party order by ID failed", {
        orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new party order
   */
  async createPartyOrder(orderData, createdBy) {
    try {
      const {
        partyTypeId,
        customerId,
        numberOfPeople,
        eventDateTime,
        locationType,
        serviceType,
        specialRequests,
      } = orderData;

      // Validate party type
      const partyType = await this.db.partyType.findUnique({
        where: { id: partyTypeId, isActive: true },
      });

      if (!partyType) {
        throw new NotFoundError("Party type not found or inactive");
      }

      // Validate customer
      const customer = await this.db.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      // Calculate total amount
      const costCalculation = await this.calculatePartyOrderCost({
        partyTypeId,
        numberOfPeople,
        locationType,
        serviceType,
      });

      // Create party order
      const partyOrder = await this.db.partyOrder.create({
        data: {
          partyTypeId,
          customerId,
          numberOfPeople,
          eventDateTime: new Date(eventDateTime),
          locationType,
          serviceType,
          totalAmount: costCalculation.totalAmount,
          specialRequests,
          status: "PENDING",
        },
        include: {
          partyType: true,
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      logger.info("Party order created successfully", {
        orderId: partyOrder.id,
        partyTypeId,
        customerId,
        totalAmount: costCalculation.totalAmount,
        createdBy: createdBy.id,
      });

      return partyOrder;
    } catch (error) {
      logger.error("Create party order failed", {
        orderData,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate party order cost
   */
  async calculatePartyOrderCost({
    partyTypeId,
    numberOfPeople,
    locationType = "RESTAURANT",
    serviceType = "FULL_SERVICE",
  }) {
    try {
      const partyType = await this.db.partyType.findUnique({
        where: { id: partyTypeId },
      });

      if (!partyType) {
        throw new NotFoundError("Party type not found");
      }

      let baseAmount = Number(partyType.pricePerPerson) * numberOfPeople;
      let additionalFees = 0;
      let discounts = 0;

      // Location surcharge
      if (locationType === "EXTERNAL") {
        additionalFees += baseAmount * 0.25; // 25% surcharge for external location
      }

      // Service type adjustment
      if (serviceType === "COOKING_ONLY") {
        discounts += baseAmount * 0.15; // 15% discount for cooking only
      }

      // Volume discounts
      if (numberOfPeople >= 100) {
        discounts += baseAmount * 0.1; // 10% discount for 100+ people
      } else if (numberOfPeople >= 50) {
        discounts += baseAmount * 0.05; // 5% discount for 50+ people
      }

      const subtotal = baseAmount + additionalFees - discounts;
      const vatAmount = subtotal * 0.15; // 15% VAT
      const totalAmount = subtotal + vatAmount;

      return {
        partyTypeId,
        partyTypeName: partyType.typeName,
        pricePerPerson: partyType.pricePerPerson,
        numberOfPeople,
        locationType,
        serviceType,
        breakdown: {
          baseAmount,
          additionalFees,
          discounts,
          subtotal,
          vatAmount,
          totalAmount,
        },
        totalAmount,
      };
    } catch (error) {
      logger.error("Calculate party order cost failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update party order
   */
  async updatePartyOrder(orderId, updateData, updatedBy) {
    try {
      const existingOrder = await this.db.partyOrder.findUnique({
        where: { id: orderId },
        include: { customer: { include: { user: true } } },
      });

      if (!existingOrder) {
        throw new NotFoundError("Party order not found");
      }

      // Check permissions
      if (
        updatedBy.role === "END_USER" &&
        updatedBy.customer &&
        existingOrder.customerId !== updatedBy.customer.id
      ) {
        throw new AuthorizationError(
          "You can only update your own party orders"
        );
      }

      // Don't allow updates for confirmed/completed orders
      if (
        ["CONFIRMED", "PREPARING", "COMPLETED"].includes(existingOrder.status)
      ) {
        throw new ConflictError(
          "Cannot update party order that is already confirmed or in progress"
        );
      }

      // Recalculate total if relevant fields changed
      let totalAmount = existingOrder.totalAmount;
      if (
        updateData.partyTypeId ||
        updateData.numberOfPeople ||
        updateData.locationType ||
        updateData.serviceType
      ) {
        const costData = {
          partyTypeId: updateData.partyTypeId || existingOrder.partyTypeId,
          numberOfPeople:
            updateData.numberOfPeople || existingOrder.numberOfPeople,
          locationType: updateData.locationType || existingOrder.locationType,
          serviceType: updateData.serviceType || existingOrder.serviceType,
        };

        const costCalculation = await this.calculatePartyOrderCost(costData);
        totalAmount = costCalculation.totalAmount;
      }

      const updatedOrder = await this.db.partyOrder.update({
        where: { id: orderId },
        data: {
          ...updateData,
          totalAmount,
          ...(updateData.eventDateTime && {
            eventDateTime: new Date(updateData.eventDateTime),
          }),
        },
        include: {
          partyType: true,
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      logger.info("Party order updated successfully", {
        orderId,
        updatedBy: updatedBy.id,
      });

      return updatedOrder;
    } catch (error) {
      logger.error("Update party order failed", {
        orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update party order status
   */
  async updatePartyOrderStatus(orderId, status, notes, updatedBy) {
    try {
      const existingOrder = await this.db.partyOrder.findUnique({
        where: { id: orderId },
      });

      if (!existingOrder) {
        throw new NotFoundError("Party order not found");
      }

      // Validate status transition
      const validTransitions = {
        PENDING: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["PREPARING", "CANCELLED"],
        PREPARING: ["COMPLETED", "CANCELLED"],
        COMPLETED: [],
        CANCELLED: [],
      };

      if (!validTransitions[existingOrder.status]?.includes(status)) {
        throw new ConflictError(
          `Cannot change status from ${existingOrder.status} to ${status}`
        );
      }

      const updatedOrder = await this.db.partyOrder.update({
        where: { id: orderId },
        data: { status },
        include: {
          partyType: true,
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Log status change
      logger.info("Party order status updated", {
        orderId,
        oldStatus: existingOrder.status,
        newStatus: status,
        updatedBy: updatedBy.id,
        notes,
      });

      return updatedOrder;
    } catch (error) {
      logger.error("Update party order status failed", {
        orderId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel party order
   */
  async cancelPartyOrder(orderId, cancellationReason, cancelledBy) {
    try {
      const existingOrder = await this.db.partyOrder.findUnique({
        where: { id: orderId },
        include: { customer: true },
      });

      if (!existingOrder) {
        throw new NotFoundError("Party order not found");
      }

      // Check permissions
      if (
        cancelledBy.role === "END_USER" &&
        cancelledBy.customer &&
        existingOrder.customerId !== cancelledBy.customer.id
      ) {
        throw new AuthorizationError(
          "You can only cancel your own party orders"
        );
      }

      // Check if cancellation is allowed
      if (["COMPLETED", "CANCELLED"].includes(existingOrder.status)) {
        throw new ConflictError(
          "Cannot cancel completed or already cancelled order"
        );
      }

      const cancelledOrder = await this.db.partyOrder.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          specialRequests: existingOrder.specialRequests
            ? `${existingOrder.specialRequests}\n\nCancellation Reason: ${cancellationReason}`
            : `Cancellation Reason: ${cancellationReason}`,
        },
        include: {
          partyType: true,
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      logger.info("Party order cancelled", {
        orderId,
        cancellationReason,
        cancelledBy: cancelledBy.id,
      });

      return cancelledOrder;
    } catch (error) {
      logger.error("Cancel party order failed", {
        orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get party statistics
   */
  async getPartyStats(options = {}) {
    try {
      const { dateFrom, dateTo, partyTypeId } = options;
      const where = {};

      if (dateFrom || dateTo) {
        where.eventDateTime = {};
        if (dateFrom) where.eventDateTime.gte = new Date(dateFrom);
        if (dateTo) where.eventDateTime.lte = new Date(dateTo);
      }

      if (partyTypeId) {
        where.partyTypeId = partyTypeId;
      }

      const [
        totalOrders,
        totalRevenue,
        statusBreakdown,
        popularPartyTypes,
        averageOrderValue,
      ] = await Promise.all([
        // Total orders count
        this.db.partyOrder.count({ where }),

        // Total revenue
        this.db.partyOrder.aggregate({
          where: { ...where, status: { not: "CANCELLED" } },
          _sum: { totalAmount: true },
        }),

        // Orders by status
        this.db.partyOrder.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),

        // Popular party types
        this.db.partyOrder.groupBy({
          by: ["partyTypeId"],
          where,
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),

        // Average order value
        this.db.partyOrder.aggregate({
          where: { ...where, status: { not: "CANCELLED" } },
          _avg: { totalAmount: true },
        }),
      ]);

      // Get party type names for popular types
      const partyTypeIds = popularPartyTypes.map((pt) => pt.partyTypeId);
      const partyTypes = await this.db.partyType.findMany({
        where: { id: { in: partyTypeIds } },
        select: { id: true, typeName: true },
      });

      const popularTypesWithNames = popularPartyTypes
        .map((pt) => {
          const type = partyTypes.find((t) => t.id === pt.partyTypeId);
          return {
            ...pt,
            typeName: type?.typeName || "Unknown",
          };
        })
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 5);

      return {
        overview: {
          totalOrders,
          totalRevenue: Number(totalRevenue._sum.totalAmount) || 0,
          averageOrderValue: Number(averageOrderValue._avg.totalAmount) || 0,
        },
        statusBreakdown,
        popularPartyTypes: popularTypesWithNames,
        period: {
          from: dateFrom || null,
          to: dateTo || null,
        },
      };
    } catch (error) {
      logger.error("Get party stats failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get upcoming party orders
   */
  async getUpcomingPartyOrders(days = 7) {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const upcomingOrders = await this.db.partyOrder.findMany({
        where: {
          eventDateTime: {
            gte: startDate,
            lte: endDate,
          },
          status: { in: ["CONFIRMED", "PREPARING"] },
        },
        orderBy: { eventDateTime: "asc" },
        include: {
          partyType: {
            select: { typeName: true },
          },
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      return upcomingOrders.map((order) => ({
        id: order.id,
        eventDateTime: order.eventDateTime,
        partyTypeName: order.partyType.typeName,
        customerName: `${order.customer.user.firstName} ${order.customer.user.lastName}`,
        customerPhone: order.customer.user.phone,
        numberOfPeople: order.numberOfPeople,
        locationType: order.locationType,
        serviceType: order.serviceType,
        status: order.status,
        totalAmount: order.totalAmount,
      }));
    } catch (error) {
      logger.error("Get upcoming party orders failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get party order timeline (for tracking)
   */
  async getPartyOrderTimeline(orderId, user) {
    try {
      const partyOrder = await this.db.partyOrder.findUnique({
        where: { id: orderId },
        include: {
          partyType: { select: { typeName: true } },
          customer: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      });

      if (!partyOrder) {
        throw new NotFoundError("Party order not found");
      }

      // Check access permissions
      if (
        user.role === "END_USER" &&
        user.customer &&
        partyOrder.customerId !== user.customer.id
      ) {
        throw new AuthorizationError("You can only view your own party orders");
      }

      // Create timeline based on order status and dates
      const timeline = [
        {
          status: "PENDING",
          title: "Order Placed",
          description: "Party order has been submitted",
          timestamp: partyOrder.createdAt,
          completed: true,
        },
        {
          status: "CONFIRMED",
          title: "Order Confirmed",
          description: "Party order has been confirmed by staff",
          timestamp: null,
          completed: ["CONFIRMED", "PREPARING", "COMPLETED"].includes(
            partyOrder.status
          ),
        },
        {
          status: "PREPARING",
          title: "Preparation Started",
          description: "Kitchen has started preparing for the party",
          timestamp: null,
          completed: ["PREPARING", "COMPLETED"].includes(partyOrder.status),
        },
        {
          status: "COMPLETED",
          title: "Party Completed",
          description: "Party has been successfully completed",
          timestamp: null,
          completed: partyOrder.status === "COMPLETED",
        },
      ];

      // Handle cancelled status
      if (partyOrder.status === "CANCELLED") {
        timeline.push({
          status: "CANCELLED",
          title: "Order Cancelled",
          description: "Party order has been cancelled",
          timestamp: partyOrder.updatedAt,
          completed: true,
        });
      }

      return {
        orderId: partyOrder.id,
        currentStatus: partyOrder.status,
        partyTypeName: partyOrder.partyType.typeName,
        eventDateTime: partyOrder.eventDateTime,
        timeline,
      };
    } catch (error) {
      logger.error("Get party order timeline failed", {
        orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate party order report
   */
  async generatePartyOrderReport(options = {}) {
    try {
      const { dateFrom, dateTo, format = "json", generatedBy } = options;

      const where = {};
      if (dateFrom || dateTo) {
        where.eventDateTime = {};
        if (dateFrom) where.eventDateTime.gte = new Date(dateFrom);
        if (dateTo) where.eventDateTime.lte = new Date(dateTo);
      }

      const orders = await this.db.partyOrder.findMany({
        where,
        include: {
          partyType: true,
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
        orderBy: { eventDateTime: "desc" },
      });

      const reportData = {
        reportInfo: {
          generatedAt: new Date().toISOString(),
          generatedBy: `${generatedBy.firstName} ${generatedBy.lastName}`,
          period: {
            from: dateFrom || null,
            to: dateTo || null,
          },
          totalOrders: orders.length,
        },
        orders: orders.map((order) => ({
          id: order.id,
          partyType: order.partyType.typeName,
          customerName: `${order.customer.user.firstName} ${order.customer.user.lastName}`,
          customerEmail: order.customer.user.email,
          customerPhone: order.customer.user.phone,
          eventDateTime: order.eventDateTime,
          numberOfPeople: order.numberOfPeople,
          locationType: order.locationType,
          serviceType: order.serviceType,
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: order.createdAt,
        })),
      };

      if (format === "json") {
        return reportData;
      }

      // For PDF/Excel formats, you would implement file generation here
      // This is a placeholder implementation
      logger.info("Party order report generated", {
        format,
        totalOrders: orders.length,
        generatedBy: generatedBy.id,
      });

      return {
        ...reportData,
        fileName: `party_orders_report_${Date.now()}.${format}`,
        contentType:
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    } catch (error) {
      logger.error("Generate party order report failed", {
        error: error.message,
      });
      throw error;
    }
  }
}

export default PartiesService;
