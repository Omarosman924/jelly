import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import { AppError, NotFoundError } from "../../../middleware/errorHandler.js";

/**
 * Waste Requests Service V2
 * Advanced waste request management with approval workflow
 */
class WasteRequestsService {
  constructor() {
    this.db = getDatabaseClient();
    this.cache = redisClient.cache(1800); // 30 minutes cache
    this.alertCache = redisClient.cache(300); // 5 minutes for alerts
  }

  /**
   * Get all waste requests with filtering and pagination
   */
  async getAllWasteRequests(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        itemId,
        status,
        requestedByStaffId,
        approvedByAdminId,
        fromDate,
        toDate,
        sortBy = "requestedAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {};

      if (itemId) where.itemId = itemId;
      if (status) where.status = status;
      if (requestedByStaffId) where.requestedByStaffId = requestedByStaffId;
      if (approvedByAdminId) where.approvedByAdminId = approvedByAdminId;

      if (fromDate || toDate) {
        where.requestedAt = {};
        if (fromDate) where.requestedAt.gte = new Date(fromDate);
        if (toDate) where.requestedAt.lte = new Date(toDate);
      }

      // Build order by
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      // Get total count
      const total = await this.db.wasteRequest.count({ where });

      // Get waste requests with related data
      const wasteRequests = await this.db.wasteRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          item: {
            select: {
              itemCode: true,
              itemNameAr: true,
              itemNameEn: true,
              currentStock: true,
              costPrice: true,
              unit: {
                select: {
                  unitSymbol: true,
                },
              },
            },
          },
          requestedByStaff: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          approvedByAdmin: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      // Add calculated fields
      const wasteRequestsWithDetails = wasteRequests.map((request) => ({
        ...request,
        itemName: request.item.itemNameEn || request.item.itemNameAr,
        requestedByName: `${request.requestedByStaff.user.firstName} ${request.requestedByStaff.user.lastName}`,
        approvedByName: request.approvedByAdmin?.user
          ? `${request.approvedByAdmin.user.firstName} ${request.approvedByAdmin.user.lastName}`
          : null,
        wasteValue:
          Number(request.wasteQuantity) * Number(request.item.costPrice),
        isPending: request.status === "PENDING",
        isOverdue: this.isRequestOverdue(request),
        processingDays: this.calculateProcessingDays(request),
      }));

      logger.info("Waste requests retrieved successfully", {
        total,
        returned: wasteRequests.length,
        filters: { itemId, status, requestedByStaffId },
      });

      return {
        wasteRequests: wasteRequestsWithDetails,
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
      logger.error("Get all waste requests failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get waste request by ID
   */
  async getWasteRequestById(requestId) {
    try {
      const wasteRequest = await this.db.wasteRequest.findUnique({
        where: { id: requestId },
        include: {
          item: {
            include: {
              unit: true,
            },
          },
          requestedByStaff: {
            include: {
              user: true,
            },
          },
          approvedByAdmin: {
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

      if (!wasteRequest) {
        throw new NotFoundError("Waste request");
      }

      // Add calculated fields
      wasteRequest.itemName =
        wasteRequest.item.itemNameEn || wasteRequest.item.itemNameAr;
      wasteRequest.requestedByName = `${wasteRequest.requestedByStaff.user.firstName} ${wasteRequest.requestedByStaff.user.lastName}`;
      wasteRequest.approvedByName = wasteRequest.approvedByAdmin?.user
        ? `${wasteRequest.approvedByAdmin.user.firstName} ${wasteRequest.approvedByAdmin.user.lastName}`
        : null;
      wasteRequest.wasteValue =
        Number(wasteRequest.wasteQuantity) *
        Number(wasteRequest.item.costPrice);
      wasteRequest.isPending = wasteRequest.status === "PENDING";
      wasteRequest.isOverdue = this.isRequestOverdue(wasteRequest);
      wasteRequest.processingDays = this.calculateProcessingDays(wasteRequest);

      return wasteRequest;
    } catch (error) {
      logger.error("Get waste request by ID failed", {
        requestId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new waste request
   */
  async createWasteRequest(requestData, requestedBy) {
    try {
      const { itemId, wasteQuantity, reason } = requestData;

      // Verify item exists and has sufficient stock
      const item = await this.db.item.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        throw new NotFoundError("Item");
      }

      if (Number(item.currentStock) < Number(wasteQuantity)) {
        throw new AppError("Insufficient stock for waste request", 400);
      }

      if (Number(wasteQuantity) <= 0) {
        throw new AppError("Waste quantity must be positive", 400);
      }

      // Create waste request
      const wasteRequest = await this.db.wasteRequest.create({
        data: {
          itemId,
          requestedByStaffId: requestedBy.staff?.id || requestedBy.id,
          wasteQuantity: Number(wasteQuantity),
          reason,
          status: "PENDING",
          requestedAt: new Date(),
        },
      });

      // Publish notification for approval queue
      await redisClient.publish("waste_request_events", {
        type: "WASTE_REQUEST_CREATED",
        requestId: wasteRequest.id,
        itemName: item.itemNameEn || item.itemNameAr,
        quantity: wasteQuantity,
        requestedBy: `${requestedBy.firstName} ${requestedBy.lastName}`,
        reason,
        timestamp: new Date().toISOString(),
      });

      logger.info("Waste request created successfully", {
        requestId: wasteRequest.id,
        itemId,
        wasteQuantity,
        requestedBy: requestedBy.id,
      });

      return await this.getWasteRequestById(wasteRequest.id);
    } catch (error) {
      logger.error("Create waste request failed", {
        itemId: requestData.itemId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Approve waste request and update stock
   */
  async approveWasteRequest(requestId, approvedBy, adminNotes = null) {
    try {
      const wasteRequest = await this.db.wasteRequest.findUnique({
        where: { id: requestId },
        include: {
          item: true,
        },
      });

      if (!wasteRequest) {
        throw new NotFoundError("Waste request");
      }

      if (wasteRequest.status !== "PENDING") {
        throw new AppError("Only pending waste requests can be approved", 400);
      }

      // Check if item still has sufficient stock
      if (
        Number(wasteRequest.item.currentStock) <
        Number(wasteRequest.wasteQuantity)
      ) {
        throw new AppError(
          "Insufficient current stock for waste approval",
          400
        );
      }

      // Approve request and update stock in transaction
      await this.db.$transaction(async (prisma) => {
        // Update waste request status
        await prisma.wasteRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            approvedByAdminId: approvedBy.id,
            approvedAt: new Date(),
            adminNotes,
          },
        });

        // Calculate new stock level
        const newStock =
          Number(wasteRequest.item.currentStock) -
          Number(wasteRequest.wasteQuantity);

        // Update item stock
        await prisma.item.update({
          where: { id: wasteRequest.itemId },
          data: { currentStock: newStock },
        });

        // Create stock movement record
        await prisma.stockMovement.create({
          data: {
            itemId: wasteRequest.itemId,
            movementType: "WASTE",
            quantityChange: -Number(wasteRequest.wasteQuantity),
            quantityBefore: wasteRequest.item.currentStock,
            quantityAfter: newStock,
            referenceId: requestId,
            referenceType: "waste_request",
            createdByStaffId: approvedBy.id,
          },
        });
      });

      // Clear related caches
      await this.invalidateWasteCaches();

      // Publish approval notification
      await redisClient.publish("waste_request_events", {
        type: "WASTE_REQUEST_APPROVED",
        requestId,
        itemName: wasteRequest.item.itemNameEn || wasteRequest.item.itemNameAr,
        quantity: wasteRequest.wasteQuantity,
        approvedBy: `${approvedBy.firstName} ${approvedBy.lastName}`,
        adminNotes,
        timestamp: new Date().toISOString(),
      });

      logger.info("Waste request approved successfully", {
        requestId,
        itemId: wasteRequest.itemId,
        wasteQuantity: wasteRequest.wasteQuantity,
        approvedBy: approvedBy.id,
      });

      return await this.getWasteRequestById(requestId);
    } catch (error) {
      logger.error("Approve waste request failed", {
        requestId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Reject waste request
   */
  async rejectWasteRequest(requestId, rejectedBy, adminNotes) {
    try {
      const wasteRequest = await this.db.wasteRequest.findUnique({
        where: { id: requestId },
        include: {
          item: {
            select: {
              itemNameAr: true,
              itemNameEn: true,
            },
          },
        },
      });

      if (!wasteRequest) {
        throw new NotFoundError("Waste request");
      }

      if (wasteRequest.status !== "PENDING") {
        throw new AppError("Only pending waste requests can be rejected", 400);
      }

      // Update waste request status
      const rejectedRequest = await this.db.wasteRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          approvedByAdminId: rejectedBy.id,
          approvedAt: new Date(),
          adminNotes,
        },
      });

      // Clear caches
      await this.invalidateWasteCaches();

      // Publish rejection notification
      await redisClient.publish("waste_request_events", {
        type: "WASTE_REQUEST_REJECTED",
        requestId,
        itemName: wasteRequest.item.itemNameEn || wasteRequest.item.itemNameAr,
        quantity: wasteRequest.wasteQuantity,
        rejectedBy: `${rejectedBy.firstName} ${rejectedBy.lastName}`,
        adminNotes,
        timestamp: new Date().toISOString(),
      });

      logger.info("Waste request rejected", {
        requestId,
        rejectedBy: rejectedBy.id,
        reason: adminNotes,
      });

      return await this.getWasteRequestById(requestId);
    } catch (error) {
      logger.error("Reject waste request failed", {
        requestId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get pending waste requests for approval queue
   */
  async getPendingWasteRequests(options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const [total, requests] = await Promise.all([
        this.db.wasteRequest.count({ where: { status: "PENDING" } }),
        this.db.wasteRequest.findMany({
          where: { status: "PENDING" },
          skip,
          take: limit,
          include: {
            item: {
              select: {
                itemCode: true,
                itemNameAr: true,
                itemNameEn: true,
                currentStock: true,
                costPrice: true,
                unit: {
                  select: {
                    unitSymbol: true,
                  },
                },
              },
            },
            requestedByStaff: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            requestedAt: "asc", // Oldest first for FIFO processing
          },
        }),
      ]);

      // Add urgency indicators
      const requestsWithUrgency = requests.map((request) => ({
        ...request,
        itemName: request.item.itemNameEn || request.item.itemNameAr,
        requestedByName: `${request.requestedByStaff.user.firstName} ${request.requestedByStaff.user.lastName}`,
        wasteValue:
          Number(request.wasteQuantity) * Number(request.item.costPrice),
        daysPending: this.calculateProcessingDays(request),
        isUrgent: this.calculateProcessingDays(request) > 2,
        priority: this.calculateRequestPriority(request),
        canApprove:
          Number(request.item.currentStock) >= Number(request.wasteQuantity),
      }));

      return {
        requests: requestsWithUrgency,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get pending waste requests failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get waste request statistics
   */
  async getWasteRequestStats(period = "month") {
    try {
      const cacheKey = `waste_request_stats:${period}`;
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const endDate = new Date();
        let startDate;

        switch (period) {
          case "week":
            startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
            break;
          case "quarter":
            const quarter = Math.floor(endDate.getMonth() / 3);
            startDate = new Date(endDate.getFullYear(), quarter * 3, 1);
            break;
          case "year":
            startDate = new Date(endDate.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        }

        const [
          totalRequests,
          pendingRequests,
          approvedRequests,
          rejectedRequests,
          totalWasteValue,
          topWasteItems,
        ] = await Promise.all([
          this.db.wasteRequest.count({
            where: {
              requestedAt: { gte: startDate, lte: endDate },
            },
          }),
          this.db.wasteRequest.count({
            where: {
              status: "PENDING",
              requestedAt: { gte: startDate, lte: endDate },
            },
          }),
          this.db.wasteRequest.count({
            where: {
              status: "APPROVED",
              requestedAt: { gte: startDate, lte: endDate },
            },
          }),
          this.db.wasteRequest.count({
            where: {
              status: "REJECTED",
              requestedAt: { gte: startDate, lte: endDate },
            },
          }),
          this.calculateTotalWasteValue(startDate, endDate),
          this.getTopWasteItems(startDate, endDate, 5),
        ]);

        stats = {
          period,
          totalRequests,
          pendingRequests,
          approvedRequests,
          rejectedRequests,
          approvalRate: totalRequests
            ? (approvedRequests / totalRequests) * 100
            : 0,
          totalWasteValue,
          avgRequestValue: totalRequests ? totalWasteValue / totalRequests : 0,
          topWasteItems,
          avgProcessingTime: 1.8, // Mock - would calculate from actual data
          timestamp: new Date().toISOString(),
        };

        // Cache for 15 minutes
        await this.cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error("Get waste request stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate waste report
   */
  async generateWasteReport(options = {}, generatedBy) {
    try {
      const { fromDate, toDate, itemId, status, format = "summary" } = options;

      const where = {};

      if (itemId) where.itemId = itemId;
      if (status) where.status = status;
      if (fromDate || toDate) {
        where.requestedAt = {};
        if (fromDate) where.requestedAt.gte = new Date(fromDate);
        if (toDate) where.requestedAt.lte = new Date(toDate);
      }

      const requests = await this.db.wasteRequest.findMany({
        where,
        include: {
          item: {
            select: {
              itemCode: true,
              itemNameAr: true,
              itemNameEn: true,
              costPrice: true,
              unit: {
                select: {
                  unitNameEn: true,
                  unitSymbol: true,
                },
              },
            },
          },
          requestedByStaff: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          approvedByAdmin: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { requestedAt: "desc" },
      });

      const totalValue = requests
        .filter((r) => r.status === "APPROVED")
        .reduce(
          (sum, r) => sum + Number(r.wasteQuantity) * Number(r.item.costPrice),
          0
        );

      const report = {
        reportType: "waste_requests",
        generatedBy: `${generatedBy.firstName} ${generatedBy.lastName}`,
        generatedAt: new Date().toISOString(),
        filters: options,
        summary: {
          totalRequests: requests.length,
          approvedRequests: requests.filter((r) => r.status === "APPROVED")
            .length,
          rejectedRequests: requests.filter((r) => r.status === "REJECTED")
            .length,
          pendingRequests: requests.filter((r) => r.status === "PENDING")
            .length,
          totalWasteValue: totalValue,
          mostWastedItem: this.getMostWastedItem(requests),
        },
        requests:
          format === "detailed"
            ? requests.map((request) => ({
                id: request.id,
                itemCode: request.item.itemCode,
                itemName: request.item.itemNameEn || request.item.itemNameAr,
                wasteQuantity: request.wasteQuantity,
                wasteValue:
                  Number(request.wasteQuantity) *
                  Number(request.item.costPrice),
                reason: request.reason,
                status: request.status,
                requestedBy: `${request.requestedByStaff.user.firstName} ${request.requestedByStaff.user.lastName}`,
                approvedBy: request.approvedByAdmin?.user
                  ? `${request.approvedByAdmin.user.firstName} ${request.approvedByAdmin.user.lastName}`
                  : null,
                requestedAt: request.requestedAt,
                approvedAt: request.approvedAt,
                adminNotes: request.adminNotes,
              }))
            : undefined,
      };

      logger.info("Waste report generated", {
        totalRequests: requests.length,
        generatedBy: generatedBy.id,
        filters: options,
      });

      return report;
    } catch (error) {
      logger.error("Generate waste report failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  isRequestOverdue(request) {
    const daysSinceRequest = Math.floor(
      (Date.now() - new Date(request.requestedAt).getTime()) /
        (24 * 60 * 60 * 1000)
    );
    return request.status === "PENDING" && daysSinceRequest > 3;
  }

  calculateProcessingDays(request) {
    const endDate = request.approvedAt
      ? new Date(request.approvedAt)
      : new Date();
    const startDate = new Date(request.requestedAt);
    return Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000));
  }

  calculateRequestPriority(request) {
    let priority = 0;
    const daysPending = this.calculateProcessingDays(request);

    // Age factor
    priority += Math.min(daysPending * 15, 60);

    // Value factor
    const wasteValue =
      Number(request.wasteQuantity) * Number(request.item.costPrice);
    if (wasteValue > 500) priority += 20;
    else if (wasteValue > 100) priority += 10;

    // Stock level factor
    const stockRatio =
      Number(request.wasteQuantity) / Number(request.item.currentStock);
    if (stockRatio > 0.5) priority += 15;
    else if (stockRatio > 0.2) priority += 5;

    return Math.min(priority, 100);
  }

  async calculateTotalWasteValue(startDate, endDate) {
    const approvedRequests = await this.db.wasteRequest.findMany({
      where: {
        status: "APPROVED",
        requestedAt: { gte: startDate, lte: endDate },
      },
      include: {
        item: {
          select: {
            costPrice: true,
          },
        },
      },
    });

    return approvedRequests.reduce(
      (sum, request) =>
        sum + Number(request.wasteQuantity) * Number(request.item.costPrice),
      0
    );
  }

  async getTopWasteItems(startDate, endDate, limit = 5) {
    const requests = await this.db.wasteRequest.findMany({
      where: {
        status: "APPROVED",
        requestedAt: { gte: startDate, lte: endDate },
      },
      include: {
        item: {
          select: {
            itemCode: true,
            itemNameEn: true,
            itemNameAr: true,
            costPrice: true,
          },
        },
      },
    });

    const itemWaste = {};
    requests.forEach((request) => {
      const itemId = request.itemId;
      if (!itemWaste[itemId]) {
        itemWaste[itemId] = {
          itemCode: request.item.itemCode,
          itemName: request.item.itemNameEn || request.item.itemNameAr,
          totalQuantity: 0,
          totalValue: 0,
          requestCount: 0,
        };
      }
      itemWaste[itemId].totalQuantity += Number(request.wasteQuantity);
      itemWaste[itemId].totalValue +=
        Number(request.wasteQuantity) * Number(request.item.costPrice);
      itemWaste[itemId].requestCount++;
    });

    return Object.values(itemWaste)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, limit);
  }

  getMostWastedItem(requests) {
    const approvedRequests = requests.filter((r) => r.status === "APPROVED");
    if (approvedRequests.length === 0) return null;

    const itemCounts = {};
    approvedRequests.forEach((request) => {
      const itemName = request.item.itemNameEn || request.item.itemNameAr;
      const value =
        Number(request.wasteQuantity) * Number(request.item.costPrice);

      if (!itemCounts[itemName]) {
        itemCounts[itemName] = { count: 0, totalValue: 0 };
      }
      itemCounts[itemName].count++;
      itemCounts[itemName].totalValue += value;
    });

    const topItem = Object.entries(itemCounts).sort(
      ([, a], [, b]) => b.totalValue - a.totalValue
    )[0];

    return topItem
      ? {
          itemName: topItem[0],
          requestCount: topItem[1].count,
          totalValue: topItem[1].totalValue,
        }
      : null;
  }

  /**
   * Invalidate waste-related caches
   */
  async invalidateWasteCaches() {
    const cacheKeys = [
      "waste_request_stats:week",
      "waste_request_stats:month",
      "waste_request_stats:quarter",
      "waste_request_stats:year",
    ];
    await Promise.all(cacheKeys.map((key) => this.cache.del(key)));
  }
}

export default WasteRequestsService;
