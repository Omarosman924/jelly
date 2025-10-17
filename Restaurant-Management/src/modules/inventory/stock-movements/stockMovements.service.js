import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import { AppError, NotFoundError } from "../../../middleware/errorHandler.js";

/**
 * Stock Movements Service V2
 * Advanced stock movement tracking and reporting
 */
class StockMovementsService {
  constructor() {
    this.cache = redisClient.cache(1800); // 30 minutes cache
  }

  /**
   * Get all stock movements with filtering and pagination
   */
  async getAllStockMovements(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        itemId,
        movementType,
        fromDate,
        toDate,
        createdByStaffId,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {};

      if (itemId) {
        where.itemId = itemId;
      }

      if (movementType) {
        where.movementType = movementType;
      }

      if (createdByStaffId) {
        where.createdByStaffId = createdByStaffId;
      }

      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) where.createdAt.lte = new Date(toDate);
      }

      // Build order by
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      // Get total count
      const total = await this.db.stockMovement.count({ where });

      // Get movements with related data
      const movements = await this.db.stockMovement.findMany({
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
              unit: {
                select: {
                  unitSymbol: true,
                },
              },
            },
          },
          createdByStaff: {
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
      const movementsWithDetails = movements.map((movement) => ({
        ...movement,
        staffName: movement.createdByStaff?.user
          ? `${movement.createdByStaff.user.firstName} ${movement.createdByStaff.user.lastName}`
          : "System",
        itemName: movement.item.itemNameEn || movement.item.itemNameAr,
        unitSymbol: movement.item.unit?.unitSymbol || "",
        isPositive: Number(movement.quantityChange) > 0,
        impactPercentage: this.calculateImpactPercentage(movement),
      }));

      logger.info("Stock movements retrieved successfully", {
        total,
        returned: movements.length,
        filters: { itemId, movementType, fromDate, toDate },
      });

      return {
        movements: movementsWithDetails,
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
      logger.error("Get all stock movements failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get stock movement by ID
   */
  async getStockMovementById(movementId) {
    try {
      const movement = await this.db.stockMovement.findUnique({
        where: { id: movementId },
        include: {
          item: {
            include: {
              unit: true,
            },
          },
          createdByStaff: {
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

      if (!movement) {
        throw new NotFoundError("Stock movement");
      }

      // Add calculated fields
      movement.staffName = movement.createdByStaff?.user
        ? `${movement.createdByStaff.user.firstName} ${movement.createdByStaff.user.lastName}`
        : "System";
      movement.itemName = movement.item.itemNameEn || movement.item.itemNameAr;
      movement.isPositive = Number(movement.quantityChange) > 0;
      movement.impactPercentage = this.calculateImpactPercentage(movement);

      return movement;
    } catch (error) {
      logger.error("Get stock movement by ID failed", {
        movementId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get stock movements by item
   */
  async getItemStockHistory(itemId, options = {}) {
    try {
      const { page = 1, limit = 50, fromDate, toDate, movementType } = options;

      const skip = (page - 1) * limit;
      const where = { itemId };

      if (movementType) {
        where.movementType = movementType;
      }

      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) where.createdAt.lte = new Date(toDate);
      }

      const [total, movements, item] = await Promise.all([
        this.db.stockMovement.count({ where }),
        this.db.stockMovement.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            createdByStaff: {
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
        }),
        this.db.item.findUnique({
          where: { id: itemId },
          include: {
            unit: true,
          },
        }),
      ]);

      if (!item) {
        throw new NotFoundError("Item");
      }

      // Calculate running totals and add details
      let runningStock = Number(item.currentStock);
      const movementsWithRunning = movements.map((movement, index) => {
        if (index === 0) {
          // First movement shows current stock as "after"
          runningStock = Number(movement.quantityAfter);
        } else {
          // For historical movements, calculate backward
          runningStock =
            runningStock - Number(movements[index - 1].quantityChange);
        }

        return {
          ...movement,
          runningStock,
          staffName: movement.createdByStaff?.user
            ? `${movement.createdByStaff.user.firstName} ${movement.createdByStaff.user.lastName}`
            : "System",
          isPositive: Number(movement.quantityChange) > 0,
          impactPercentage: this.calculateImpactPercentage(movement),
        };
      });

      return {
        item: {
          id: item.id,
          itemCode: item.itemCode,
          itemNameAr: item.itemNameAr,
          itemNameEn: item.itemNameEn,
          currentStock: item.currentStock,
          unit: item.unit,
        },
        movements: movementsWithRunning,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get item stock history failed", {
        itemId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get stock movement statistics
   */
  async getStockMovementStats(period = "month") {
    try {
      const cacheKey = `stock_movement_stats:${period}`;
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
          totalMovements,
          movementsByType,
          topMovedItems,
          recentLargeMovements,
        ] = await Promise.all([
          this.db.stockMovement.count({
            where: {
              createdAt: { gte: startDate, lte: endDate },
            },
          }),
          this.db.stockMovement.groupBy({
            by: ["movementType"],
            _count: { movementType: true },
            _sum: { quantityChange: true },
            where: {
              createdAt: { gte: startDate, lte: endDate },
            },
          }),
          this.db.stockMovement.groupBy({
            by: ["itemId"],
            _count: { itemId: true },
            _sum: { quantityChange: true },
            where: {
              createdAt: { gte: startDate, lte: endDate },
            },
            orderBy: {
              _count: { itemId: "desc" },
            },
            take: 10,
          }),
          this.db.stockMovement.findMany({
            where: {
              createdAt: { gte: startDate, lte: endDate },
              quantityChange: { gte: 100 }, // Large movements
            },
            include: {
              item: {
                select: {
                  itemCode: true,
                  itemNameEn: true,
                  itemNameAr: true,
                },
              },
            },
            orderBy: { quantityChange: "desc" },
            take: 5,
          }),
        ]);

        // Get item names for top moved items
        const itemIds = topMovedItems.map((item) => item.itemId);
        const items = await this.db.item.findMany({
          where: { id: { in: itemIds } },
          select: {
            id: true,
            itemCode: true,
            itemNameEn: true,
            itemNameAr: true,
          },
        });

        const topMovedItemsWithNames = topMovedItems.map((movement) => {
          const item = items.find((i) => i.id === movement.itemId);
          return {
            ...movement,
            itemCode: item?.itemCode,
            itemName: item?.itemNameEn || item?.itemNameAr,
          };
        });

        stats = {
          period,
          totalMovements,
          movementsByType: movementsByType.reduce((acc, item) => {
            acc[item.movementType] = {
              count: item._count.movementType,
              totalQuantity: item._sum.quantityChange || 0,
            };
            return acc;
          }, {}),
          topMovedItems: topMovedItemsWithNames,
          recentLargeMovements,
          avgMovementsPerDay: totalMovements / this.getDaysInPeriod(period),
          timestamp: new Date().toISOString(),
        };

        // Cache for 15 minutes
        await this.cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error("Get stock movement stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate stock movement report
   */
  async generateMovementReport(options = {}, generatedBy) {
    try {
      const {
        fromDate,
        toDate,
        itemId,
        movementType,
        format = "summary",
      } = options;

      const where = {};

      if (itemId) where.itemId = itemId;
      if (movementType) where.movementType = movementType;
      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) where.createdAt.lte = new Date(toDate);
      }

      const movements = await this.db.stockMovement.findMany({
        where,
        include: {
          item: {
            select: {
              itemCode: true,
              itemNameAr: true,
              itemNameEn: true,
              unit: {
                select: {
                  unitNameEn: true,
                  unitSymbol: true,
                },
              },
            },
          },
          createdByStaff: {
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
        orderBy: { createdAt: "desc" },
      });

      const report = {
        reportType: "stock_movements",
        generatedBy: `${generatedBy.firstName} ${generatedBy.lastName}`,
        generatedAt: new Date().toISOString(),
        filters: options,
        summary: {
          totalMovements: movements.length,
          movementsByType: this.groupMovementsByType(movements),
          totalQuantityIn: movements
            .filter((m) => Number(m.quantityChange) > 0)
            .reduce((sum, m) => sum + Number(m.quantityChange), 0),
          totalQuantityOut: movements
            .filter((m) => Number(m.quantityChange) < 0)
            .reduce((sum, m) => sum + Math.abs(Number(m.quantityChange)), 0),
        },
        movements:
          format === "detailed"
            ? movements.map((movement) => ({
                id: movement.id,
                itemCode: movement.item.itemCode,
                itemName: movement.item.itemNameEn || movement.item.itemNameAr,
                movementType: movement.movementType,
                quantityChange: movement.quantityChange,
                quantityBefore: movement.quantityBefore,
                quantityAfter: movement.quantityAfter,
                unit: movement.item.unit?.unitSymbol,
                referenceType: movement.referenceType,
                referenceId: movement.referenceId,
                staffName: movement.createdByStaff?.user
                  ? `${movement.createdByStaff.user.firstName} ${movement.createdByStaff.user.lastName}`
                  : "System",
                createdAt: movement.createdAt,
              }))
            : undefined,
      };

      logger.info("Stock movement report generated", {
        totalMovements: movements.length,
        generatedBy: generatedBy.id,
        filters: options,
      });

      return report;
    } catch (error) {
      logger.error("Generate movement report failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get stock trend analysis
   */
  async getStockTrends(itemId, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000
      );

      const movements = await this.db.stockMovement.findMany({
        where: {
          itemId,
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: "asc" },
      });

      const item = await this.db.item.findUnique({
        where: { id: itemId },
        include: { unit: true },
      });

      if (!item) {
        throw new NotFoundError("Item");
      }

      // Group movements by day and calculate daily totals
      const dailyTrends = {};
      let currentStock = Number(item.currentStock);

      // Work backwards from current stock
      for (let i = movements.length - 1; i >= 0; i--) {
        const movement = movements[i];
        const dateKey = movement.createdAt.toISOString().split("T")[0];

        if (!dailyTrends[dateKey]) {
          dailyTrends[dateKey] = {
            date: dateKey,
            stockLevel: currentStock,
            totalIn: 0,
            totalOut: 0,
            netChange: 0,
            movementCount: 0,
          };
        }

        const change = Number(movement.quantityChange);
        dailyTrends[dateKey].netChange += change;
        dailyTrends[dateKey].movementCount++;

        if (change > 0) {
          dailyTrends[dateKey].totalIn += change;
        } else {
          dailyTrends[dateKey].totalOut += Math.abs(change);
        }

        currentStock = Number(movement.quantityBefore);
      }

      const trends = Object.values(dailyTrends).sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      return {
        item: {
          id: item.id,
          itemCode: item.itemCode,
          itemNameEn: item.itemNameEn,
          itemNameAr: item.itemNameAr,
          currentStock: item.currentStock,
          unit: item.unit,
        },
        trends,
        analysis: {
          avgDailyUsage: trends.length
            ? trends.reduce((sum, day) => sum + Math.abs(day.totalOut), 0) /
              trends.length
            : 0,
          totalNetChange: trends.reduce((sum, day) => sum + day.netChange, 0),
          mostActiveDay: trends.reduce(
            (max, day) =>
              day.movementCount > (max?.movementCount || 0) ? day : max,
            null
          ),
          stockVelocity: this.calculateStockVelocity(trends),
        },
      };
    } catch (error) {
      logger.error("Get stock trends failed", {
        itemId,
        days,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  calculateImpactPercentage(movement) {
    if (Number(movement.quantityBefore) === 0) return 0;
    return (
      (Number(movement.quantityChange) / Number(movement.quantityBefore)) *
      100
    ).toFixed(2);
  }

  getDaysInPeriod(period) {
    switch (period) {
      case "week":
        return 7;
      case "month":
        return 30;
      case "quarter":
        return 90;
      case "year":
        return 365;
      default:
        return 30;
    }
  }

  groupMovementsByType(movements) {
    return movements.reduce((acc, movement) => {
      const type = movement.movementType;
      if (!acc[type]) {
        acc[type] = { count: 0, totalQuantity: 0 };
      }
      acc[type].count++;
      acc[type].totalQuantity += Number(movement.quantityChange);
      return acc;
    }, {});
  }

  calculateStockVelocity(trends) {
    if (trends.length < 2) return 0;
    const totalUsage = trends.reduce(
      (sum, day) => sum + Math.abs(day.totalOut),
      0
    );
    return totalUsage / trends.length; // Average daily usage
  }
}
const stockMovementsService = new StockMovementsService();
export default stockMovementsService;
