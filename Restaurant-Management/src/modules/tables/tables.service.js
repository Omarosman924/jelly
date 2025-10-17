import { getDatabaseClient } from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../middleware/errorHandler.js";

/**
 * Tables Service V2
 * Complete table management for restaurant seating
 */
class TablesService {
  constructor() {
    this.cache = redisClient.cache(1800); // 30 minutes cache
  }

  getDb() {
    try {
      return getDatabaseClient();
    } catch (error) {
      logger.error("Failed to get database client", {
        error: error.message,
        service: "TablesService",
      });
      throw new AppError("Database connection failed", 503);
    }
  }

  /**
   * Get all tables with filtering and pagination
   */
  async getAllTables(options = {}) {
    try {
      const db = this.getDb();
      const {
        status,
        tableType,
        includeInactive = false,
        page = 1,
        limit = 20,
      } = options;

      const where = {};
      if (status) where.tableStatus = status;
      if (tableType) where.tableType = tableType;
      if (!includeInactive) where.isActive = true;

      const skip = (page - 1) * limit;

      const [tables, total] = await Promise.all([
        db.table.findMany({
          where,
          skip,
          take: limit,
          orderBy: { tableNumber: "asc" },
          include: {
            _count: {
              select: {
                orders: true,
                tableReservations: true,
              },
            },
          },
        }),
        db.table.count({ where }),
      ]);

      return {
        tables,
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
      logger.error("Get tables failed", { error: error.message, options });
      throw error;
    }
  }

  /**
   * Get table by ID
   */
  async getTableById(tableId) {
    try {
      const db = this.getDb();
      const cacheKey = `table:${tableId}`;

      let table = await this.cache.get(cacheKey);
      if (!table) {
        table = await db.table.findUnique({
          where: { id: tableId },
          include: {
            orders: {
              where: {
                orderDateTime: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                },
              },
              select: {
                id: true,
                orderNumber: true,
                orderDateTime: true,
                totalAmount: true,
                orderStatus: true,
              },
              orderBy: { orderDateTime: "desc" },
              take: 10,
            },
            tableReservations: {
              where: {
                reservationDateTime: {
                  gte: new Date(),
                },
              },
              select: {
                id: true,
                reservationDateTime: true,
                partySize: true,
                status: true,
                customer: {
                  select: {
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
              orderBy: { reservationDateTime: "asc" },
              take: 5,
            },
            _count: {
              select: {
                orders: true,
                tableReservations: true,
              },
            },
          },
        });

        if (!table) {
          throw new NotFoundError("Table");
        }

        await this.cache.set(cacheKey, table, 900); // 15 minutes
      }

      return table;
    } catch (error) {
      logger.error("Get table by ID failed", { tableId, error: error.message });
      throw error;
    }
  }

  /**
   * Create new table
   */
  async createTable(tableData, createdBy) {
    try {
      const db = this.getDb();

      // Check for duplicate table number
      const existingTable = await db.table.findFirst({
        where: { tableNumber: tableData.tableNumber },
      });

      if (existingTable) {
        throw new ConflictError("Table number already exists");
      }

      // Validate capacity based on table type
      const capacityLimits = {
        DOUBLE: { min: 1, max: 3 },
        TRIPLE: { min: 2, max: 4 },
        QUAD: { min: 3, max: 5 },
        FAMILY: { min: 4, max: 12 },
      };

      const limits = capacityLimits[tableData.tableType];
      if (tableData.capacity < limits.min || tableData.capacity > limits.max) {
        throw new AppError(
          `Capacity for ${tableData.tableType} table must be between ${limits.min} and ${limits.max}`,
          400
        );
      }

      const table = await db.table.create({
        data: {
          ...tableData,
          tableStatus: "AVAILABLE",
          isActive: true,
        },
      });

      // Clear caches
      await this.invalidateTableCaches();

      logger.info("Table created successfully", {
        tableId: table.id,
        tableNumber: table.tableNumber,
        createdBy: createdBy?.id || "system",
      });

      return await this.getTableById(table.id);
    } catch (error) {
      logger.error("Create table failed", {
        tableNumber: tableData.tableNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update table information
   */
  async updateTable(tableId, updateData, updatedBy) {
    try {
      const db = this.getDb();

      const existingTable = await db.table.findUnique({
        where: { id: tableId },
      });

      if (!existingTable) {
        throw new NotFoundError("Table");
      }

      // Check for duplicate table number if updating
      if (
        updateData.tableNumber &&
        updateData.tableNumber !== existingTable.tableNumber
      ) {
        const duplicateTable = await db.table.findFirst({
          where: {
            tableNumber: updateData.tableNumber,
            NOT: { id: tableId },
          },
        });

        if (duplicateTable) {
          throw new ConflictError("Table number already exists");
        }
      }

      // Validate capacity if updating
      if (updateData.capacity && updateData.tableType) {
        const capacityLimits = {
          DOUBLE: { min: 1, max: 3 },
          TRIPLE: { min: 2, max: 4 },
          QUAD: { min: 3, max: 5 },
          FAMILY: { min: 4, max: 12 },
        };

        const limits = capacityLimits[updateData.tableType];
        if (
          updateData.capacity < limits.min ||
          updateData.capacity > limits.max
        ) {
          throw new AppError(
            `Capacity for ${updateData.tableType} table must be between ${limits.min} and ${limits.max}`,
            400
          );
        }
      }

      const updatedTable = await db.table.update({
        where: { id: tableId },
        data: updateData,
      });

      // Clear caches
      await this.cache.del(`table:${tableId}`);
      await this.invalidateTableCaches();

      logger.info("Table updated successfully", {
        tableId,
        updatedBy: updatedBy?.id || "system",
        fields: Object.keys(updateData),
      });

      return await this.getTableById(tableId);
    } catch (error) {
      logger.error("Update table failed", { tableId, error: error.message });
      throw error;
    }
  }

  /**
   * Update table status
   */
  async updateTableStatus(tableId, status, updatedBy) {
    try {
      const db = this.getDb();

      const table = await db.table.findUnique({
        where: { id: tableId },
      });

      if (!table) {
        throw new NotFoundError("Table");
      }

      const updatedTable = await db.table.update({
        where: { id: tableId },
        data: { tableStatus: status },
      });

      // Publish real-time event
      await redisClient.publish("table_events", {
        type: "STATUS_CHANGED",
        tableId,
        tableNumber: table.tableNumber,
        oldStatus: table.tableStatus,
        newStatus: status,
        updatedBy: updatedBy?.id || "system",
        timestamp: new Date().toISOString(),
      });

      // Clear caches
      await this.cache.del(`table:${tableId}`);
      await this.invalidateTableCaches();

      logger.info("Table status updated", {
        tableId,
        tableNumber: table.tableNumber,
        oldStatus: table.tableStatus,
        newStatus: status,
        updatedBy: updatedBy?.id || "system",
      });

      return updatedTable;
    } catch (error) {
      logger.error("Update table status failed", {
        tableId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get available tables with minimum capacity
   */
  async getAvailableTables(capacity = 1) {
    try {
      const db = this.getDb();
      const cacheKey = `available_tables:${capacity}`;

      let tables = await this.cache.get(cacheKey);
      if (!tables) {
        tables = await db.table.findMany({
          where: {
            tableStatus: "AVAILABLE",
            capacity: { gte: capacity },
            isActive: true,
          },
          orderBy: [
            { capacity: "asc" }, // Smallest suitable table first
            { tableNumber: "asc" },
          ],
        });

        await this.cache.set(cacheKey, tables, 300); // 5 minutes cache
      }

      return tables;
    } catch (error) {
      logger.error("Get available tables failed", {
        capacity,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get tables statistics
   */
  async getTablesStats() {
    try {
      const db = this.getDb();
      const cacheKey = "tables_stats";

      let stats = await this.cache.get(cacheKey);
      if (!stats) {
        const [
          totalTables,
          activeTables,
          availableTables,
          occupiedTables,
          reservedTables,
          cleaningTables,
          totalCapacity,
          statusDistribution,
          typeDistribution,
        ] = await Promise.all([
          db.table.count(),
          db.table.count({ where: { isActive: true } }),
          db.table.count({
            where: { tableStatus: "AVAILABLE", isActive: true },
          }),
          db.table.count({
            where: { tableStatus: "OCCUPIED", isActive: true },
          }),
          db.table.count({
            where: { tableStatus: "RESERVED", isActive: true },
          }),
          db.table.count({
            where: { tableStatus: "CLEANING", isActive: true },
          }),
          db.table.aggregate({
            _sum: { capacity: true },
            where: { isActive: true },
          }),
          this.getStatusDistribution(),
          this.getTypeDistribution(),
        ]);

        stats = {
          totalTables,
          activeTables,
          inactiveTables: totalTables - activeTables,
          totalCapacity: totalCapacity._sum.capacity || 0,
          occupancyRate:
            activeTables > 0
              ? ((occupiedTables / activeTables) * 100).toFixed(2)
              : 0,
          utilizationRate:
            activeTables > 0
              ? (
                  ((occupiedTables + reservedTables) / activeTables) *
                  100
                ).toFixed(2)
              : 0,
          statusBreakdown: {
            available: availableTables,
            occupied: occupiedTables,
            reserved: reservedTables,
            cleaning: cleaningTables,
          },
          statusDistribution,
          typeDistribution,
          timestamp: new Date().toISOString(),
        };

        await this.cache.set(cacheKey, stats, 600); // 10 minutes cache
      }

      return stats;
    } catch (error) {
      logger.error("Get tables stats failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get table status distribution
   */
  async getStatusDistribution() {
    try {
      const db = this.getDb();

      const distribution = await db.table.groupBy({
        by: ["tableStatus"],
        _count: { tableStatus: true },
        where: { isActive: true },
      });

      return distribution.map((item) => ({
        status: item.tableStatus,
        count: item._count.tableStatus,
      }));
    } catch (error) {
      logger.error("Get status distribution failed", { error: error.message });
      return [];
    }
  }

  /**
   * Get table type distribution
   */
  async getTypeDistribution() {
    try {
      const db = this.getDb();

      const distribution = await db.table.groupBy({
        by: ["tableType"],
        _count: { tableType: true },
        _sum: { capacity: true },
        where: { isActive: true },
      });

      return distribution.map((item) => ({
        type: item.tableType,
        count: item._count.tableType,
        totalCapacity: item._sum.capacity,
      }));
    } catch (error) {
      logger.error("Get type distribution failed", { error: error.message });
      return [];
    }
  }

  /**
   * Get occupancy report for a period
   */
  async getOccupancyReport(period = "today") {
    try {
      const db = this.getDb();

      const periodDates = this.getPeriodDates(period);

      const orders = await db.order.findMany({
        where: {
          orderDateTime: {
            gte: periodDates.start,
            lte: periodDates.end,
          },
          orderType: "DINE_IN",
          tableId: { not: null },
        },
        include: {
          table: {
            select: {
              id: true,
              tableNumber: true,
              tableType: true,
              capacity: true,
            },
          },
        },
        orderBy: { orderDateTime: "asc" },
      });

      const tableUsage = {};
      orders.forEach((order) => {
        const tableId = order.tableId;
        if (!tableUsage[tableId]) {
          tableUsage[tableId] = {
            table: order.table,
            totalOrders: 0,
            totalRevenue: 0,
            avgOrderValue: 0,
            firstOrder: order.orderDateTime,
            lastOrder: order.orderDateTime,
          };
        }

        tableUsage[tableId].totalOrders++;
        tableUsage[tableId].totalRevenue += Number(order.totalAmount);
        tableUsage[tableId].lastOrder = order.orderDateTime;
      });

      // Calculate averages
      Object.keys(tableUsage).forEach((tableId) => {
        const usage = tableUsage[tableId];
        usage.avgOrderValue = usage.totalRevenue / usage.totalOrders;
      });

      return {
        period,
        dateRange: periodDates,
        totalOrders: orders.length,
        totalRevenue: orders.reduce(
          (sum, order) => sum + Number(order.totalAmount),
          0
        ),
        tablesUsed: Object.keys(tableUsage).length,
        tableUsage: Object.values(tableUsage),
        summary: {
          mostUsedTable: this.getMostUsedTable(tableUsage),
          highestRevenueTable: this.getHighestRevenueTable(tableUsage),
        },
      };
    } catch (error) {
      logger.error("Get occupancy report failed", {
        period,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get utilization analytics
   */
  async getUtilizationAnalytics(days = 7) {
    try {
      const db = this.getDb();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const analytics = await db.order.groupBy({
        by: ["tableId"],
        _count: { tableId: true },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
        where: {
          orderDateTime: { gte: startDate },
          orderType: "DINE_IN",
          tableId: { not: null },
        },
        orderBy: {
          _count: { tableId: "desc" },
        },
        take: 10,
      });

      // Get table details
      if (analytics.length > 0) {
        const tableIds = analytics.map((a) => a.tableId);
        const tables = await db.table.findMany({
          where: { id: { in: tableIds } },
          select: {
            id: true,
            tableNumber: true,
            tableType: true,
            capacity: true,
          },
        });

        const enrichedAnalytics = analytics.map((stat) => {
          const table = tables.find((t) => t.id === stat.tableId);
          return {
            table,
            orderCount: stat._count.tableId,
            totalRevenue: stat._sum.totalAmount || 0,
            avgOrderValue: stat._avg.totalAmount || 0,
            utilizationScore: this.calculateUtilizationScore(stat, days),
          };
        });

        return {
          topTables: enrichedAnalytics,
          insights: this.generateUtilizationInsights(enrichedAnalytics),
        };
      }

      return { topTables: [], insights: [] };
    } catch (error) {
      logger.error("Get utilization analytics failed", {
        days,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Bulk update table status
   */
  async bulkStatusUpdate(tableIds, status, updatedBy) {
    try {
      const db = this.getDb();
      const results = { updated: [], failed: [] };

      for (const tableId of tableIds) {
        try {
          const table = await this.updateTableStatus(
            tableId,
            status,
            updatedBy
          );
          results.updated.push({
            id: tableId,
            success: true,
            table,
          });
        } catch (error) {
          results.failed.push({
            id: tableId,
            success: false,
            error: error.message,
          });
        }
      }

      logger.info("Bulk status update completed", {
        totalTables: tableIds.length,
        updated: results.updated.length,
        failed: results.failed.length,
        status,
        updatedBy: updatedBy?.id || "system",
      });

      return results;
    } catch (error) {
      logger.error("Bulk status update failed", {
        tableIds,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Reset all tables to specific status
   */
  async resetAllTables(status = "AVAILABLE", updatedBy) {
    try {
      const db = this.getDb();

      const result = await db.table.updateMany({
        where: { isActive: true },
        data: { tableStatus: status },
      });

      // Publish reset event
      await redisClient.publish("table_events", {
        type: "BULK_RESET",
        status,
        tablesAffected: result.count,
        updatedBy: updatedBy?.id || "system",
        timestamp: new Date().toISOString(),
      });

      // Clear all caches
      await this.invalidateTableCaches();

      logger.info("All tables reset", {
        status,
        tablesAffected: result.count,
        updatedBy: updatedBy?.id || "system",
      });

      return {
        status,
        tablesAffected: result.count,
        message: `${result.count} tables reset to ${status}`,
      };
    } catch (error) {
      logger.error("Reset all tables failed", { status, error: error.message });
      throw error;
    }
  }

  /**
   * Delete table (soft delete)
   */
  async deleteTable(tableId, deletedBy) {
    try {
      const db = this.getDb();

      const table = await db.table.findUnique({
        where: { id: tableId },
        include: {
          _count: {
            select: {
              orders: true,
              tableReservations: true,
            },
          },
        },
      });

      if (!table) {
        throw new NotFoundError("Table");
      }

      // Check if table has orders or reservations
      if (table._count.orders > 0 || table._count.tableReservations > 0) {
        // Soft delete only
        await db.table.update({
          where: { id: tableId },
          data: { isActive: false },
        });

        logger.info("Table soft deleted (has references)", {
          tableId,
          tableNumber: table.tableNumber,
          orderReferences: table._count.orders,
          reservationReferences: table._count.tableReservations,
          deletedBy: deletedBy?.id || "system",
        });
      } else {
        // Hard delete if no references
        await db.table.delete({
          where: { id: tableId },
        });

        logger.info("Table hard deleted", {
          tableId,
          tableNumber: table.tableNumber,
          deletedBy: deletedBy?.id || "system",
        });
      }

      // Clear caches
      await this.cache.del(`table:${tableId}`);
      await this.invalidateTableCaches();
    } catch (error) {
      logger.error("Delete table failed", { tableId, error: error.message });
      throw error;
    }
  }

  /**
   * Get table history
   */
  async getTableHistory(tableId, days = 30) {
    try {
      const db = this.getDb();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [orders, reservations] = await Promise.all([
        db.order.findMany({
          where: {
            tableId,
            orderDateTime: { gte: startDate },
          },
          select: {
            id: true,
            orderNumber: true,
            orderDateTime: true,
            totalAmount: true,
            orderStatus: true,
            customer: {
              select: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: { orderDateTime: "desc" },
        }),
        db.tableReservation.findMany({
          where: {
            tableId,
            reservationDateTime: { gte: startDate },
          },
          select: {
            id: true,
            reservationDateTime: true,
            partySize: true,
            status: true,
            customer: {
              select: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: { reservationDateTime: "desc" },
        }),
      ]);

      return {
        orders: {
          count: orders.length,
          totalRevenue: orders.reduce(
            (sum, order) => sum + Number(order.totalAmount),
            0
          ),
          data: orders,
        },
        reservations: {
          count: reservations.length,
          data: reservations,
        },
      };
    } catch (error) {
      logger.error("Get table history failed", {
        tableId,
        days,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get table recommendations
   */
  async getTableRecommendations(partySize, preferences = {}) {
    try {
      const db = this.getDb();

      const { location, tableType } = preferences;
      const where = {
        tableStatus: "AVAILABLE",
        capacity: { gte: partySize },
        isActive: true,
      };

      if (tableType) where.tableType = tableType;
      if (location)
        where.locationDescription = { contains: location, mode: "insensitive" };

      const tables = await db.table.findMany({
        where,
        orderBy: [
          { capacity: "asc" }, // Prefer smaller tables first
          { tableNumber: "asc" },
        ],
        take: 5,
      });

      return {
        partySize,
        preferences,
        recommendations: tables.map((table) => ({
          ...table,
          suitabilityScore: this.calculateSuitabilityScore(table, partySize),
          reason: this.getRecommendationReason(table, partySize),
        })),
      };
    } catch (error) {
      logger.error("Get table recommendations failed", {
        partySize,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get tables dashboard data
   */
  async getTablesDashboard() {
    try {
      const [stats, recentActivity] = await Promise.all([
        this.getTablesStats(),
        this.getRecentTableActivity(),
      ]);

      return {
        overview: stats,
        recentActivity,
        alerts: await this.getTableAlerts(),
        liveStatus: await this.getLiveTableStatus(),
      };
    } catch (error) {
      logger.error("Get tables dashboard failed", { error: error.message });
      throw error;
    }
  }

  // Helper methods
  getPeriodDates(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case "today":
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
        };
      case "yesterday":
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          start: yesterday,
          end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1),
        };
      case "week":
        const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekStart, end: now };
      case "month":
        const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start: monthStart, end: now };
      default:
        return { start: today, end: now };
    }
  }

  getMostUsedTable(tableUsage) {
    let mostUsed = null;
    let maxOrders = 0;

    Object.values(tableUsage).forEach((usage) => {
      if (usage.totalOrders > maxOrders) {
        maxOrders = usage.totalOrders;
        mostUsed = usage;
      }
    });

    return mostUsed;
  }

  getHighestRevenueTable(tableUsage) {
    let highest = null;
    let maxRevenue = 0;

    Object.values(tableUsage).forEach((usage) => {
      if (usage.totalRevenue > maxRevenue) {
        maxRevenue = usage.totalRevenue;
        highest = usage;
      }
    });

    return highest;
  }

  calculateUtilizationScore(stat, days) {
    // Simple utilization score based on orders per day
    const ordersPerDay = stat._count.tableId / days;
    return Math.min(ordersPerDay * 10, 100); // Scale to 0-100
  }

  generateUtilizationInsights(analytics) {
    const insights = [];

    if (analytics.length > 0) {
      const topTable = analytics[0];
      insights.push({
        type: "TOP_PERFORMER",
        message: `Table ${topTable.table.tableNumber} is your most utilized table with ${topTable.orderCount} orders`,
        table: topTable.table,
      });

      const avgUtilization =
        analytics.reduce((sum, a) => sum + a.utilizationScore, 0) /
        analytics.length;
      if (avgUtilization < 30) {
        insights.push({
          type: "LOW_UTILIZATION",
          message:
            "Overall table utilization is low. Consider promotional offers or layout optimization",
          avgUtilization: avgUtilization.toFixed(2),
        });
      }
    }

    return insights;
  }

  calculateSuitabilityScore(table, partySize) {
    const capacityRatio = partySize / table.capacity;
    if (capacityRatio > 1) return 0; // Can't fit
    if (capacityRatio > 0.8) return 100; // Perfect fit
    if (capacityRatio > 0.5) return 80; // Good fit
    return 60; // Adequate but oversized
  }

  getRecommendationReason(table, partySize) {
    const capacityRatio = partySize / table.capacity;
    if (capacityRatio > 0.8) return "Perfect size match for your party";
    if (capacityRatio > 0.5) return "Good fit with comfortable space";
    return "Spacious seating with extra room";
  }

  async getRecentTableActivity() {
    try {
      const db = this.getDb();
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const activities = await db.order.findMany({
        where: {
          orderDateTime: { gte: last24Hours },
          orderType: "DINE_IN",
          tableId: { not: null },
        },
        include: {
          table: {
            select: {
              tableNumber: true,
              tableType: true,
            },
          },
          customer: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { orderDateTime: "desc" },
        take: 10,
      });

      return activities;
    } catch (error) {
      logger.error("Get recent table activity failed", {
        error: error.message,
      });
      return [];
    }
  }

  async getTableAlerts() {
    try {
      const db = this.getDb();
      const alerts = [];

      // Tables that have been cleaning for too long
      const longCleaningTables = await db.table.findMany({
        where: {
          tableStatus: "CLEANING",
          isActive: true,
        },
        select: {
          id: true,
          tableNumber: true,
          updatedAt: true,
        },
      });

      longCleaningTables.forEach((table) => {
        const cleaningDuration = Date.now() - table.updatedAt.getTime();
        if (cleaningDuration > 30 * 60 * 1000) {
          // 30 minutes
          alerts.push({
            type: "LONG_CLEANING",
            message: `Table ${table.tableNumber} has been cleaning for over 30 minutes`,
            tableId: table.id,
            tableNumber: table.tableNumber,
            duration: Math.round(cleaningDuration / (60 * 1000)),
          });
        }
      });

      return alerts;
    } catch (error) {
      logger.error("Get table alerts failed", { error: error.message });
      return [];
    }
  }

  async getLiveTableStatus() {
    try {
      const db = this.getDb();

      const status = await db.table.groupBy({
        by: ["tableStatus"],
        _count: { tableStatus: true },
        where: { isActive: true },
      });

      return status.map((item) => ({
        status: item.tableStatus,
        count: item._count.tableStatus,
      }));
    } catch (error) {
      logger.error("Get live table status failed", { error: error.message });
      return [];
    }
  }

  async invalidateTableCaches() {
    try {
      // Get Redis client through redisClient
      const [tableKeys, availableKeys] = await Promise.all([
        redisClient.keys("cache:table:*"),
        redisClient.keys("cache:available_tables:*"),
      ]);

      // Combine all keys to delete
      const allKeys = [
        "cache:tables_stats",
        ...tableKeys.map((key) => key.replace("cache:", "")), // Remove cache: prefix
        ...availableKeys.map((key) => key.replace("cache:", "")),
      ];

      // Delete all keys
      if (allKeys.length > 0) {
        await Promise.all(allKeys.map((key) => this.cache.del(key)));
      }

      logger.debug("Cache invalidated successfully", {
        keysDeleted: allKeys.length,
        keys: allKeys,
      });
    } catch (error) {
      logger.warn("Cache invalidation failed", { error: error.message });
      // Don't throw error - cache invalidation failure shouldn't break the operation
    }
  }
}

const tablesService = new TablesService();
export default tablesService;
