import { getDatabaseClient } from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";
import {
  NotFoundError,
  ConflictError,
  AppError,
} from "../../middleware/errorHandler.js";

/**
 * Delivery Areas Service
 * Handles delivery area management
 */
class DeliveryAreasService {
  constructor() {
    this._db = null;
    this._cache = null;
  }

  get db() {
    if (!this._db) {
      this._db = getDatabaseClient();
      if (!this._db) {
        throw new AppError("Database client not initialized", 500);
      }
    }
    return this._db;
  }

  get cache() {
    if (!this._cache) {
      this._cache = redisClient.cache(3600); // 1 hour cache
    }
    return this._cache;
  }

  /**
   * Get all delivery areas with pagination
   */
  async getAllDeliveryAreas(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        isActive,
        sortBy = "areaName",
        sortOrder = "asc",
      } = options;

      const skip = (page - 1) * limit;
      const where = {};

      // Search filter
      if (search) {
        where.areaName = { contains: search, mode: "insensitive" };
      }

      // Active filter
      if (typeof isActive === "boolean") {
        where.isActive = isActive;
      }

      const [total, areas] = await Promise.all([
        this.db.deliveryArea.count({ where }),
        this.db.deliveryArea.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            _count: {
              select: {
                customers: true,
              },
            },
          },
        }),
      ]);

      const enrichedAreas = areas.map((area) => ({
        ...area,
        customersCount: area._count.customers,
        deliveryFee: Number(area.deliveryFee),
      }));

      logger.info("Delivery areas retrieved successfully", {
        total,
        returned: areas.length,
      });

      return {
        areas: enrichedAreas,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get all delivery areas failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get delivery area by ID
   */
  async getDeliveryAreaById(areaId) {
    try {
      const cacheKey = `delivery_area:${areaId}`;
      let area = await this.cache.get(cacheKey);

      if (!area) {
        area = await this.db.deliveryArea.findUnique({
          where: { id: areaId },
          include: {
            _count: {
              select: {
                customers: true,
              },
            },
          },
        });

        if (!area) {
          throw new NotFoundError("Delivery area not found");
        }

        await this.cache.set(cacheKey, area, 3600);
      }

      return {
        ...area,
        customersCount: area._count.customers,
        deliveryFee: Number(area.deliveryFee),
      };
    } catch (error) {
      logger.error("Get delivery area by ID failed", {
        areaId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new delivery area
   */
  async createDeliveryArea(areaData, createdBy) {
    try {
      const { areaName, deliveryFee, estimatedDeliveryTime, isActive } =
        areaData;

      // Check if area name already exists
      const existingArea = await this.db.deliveryArea.findFirst({
        where: {
          areaName: { equals: areaName, mode: "insensitive" },
        },
      });

      if (existingArea) {
        throw new ConflictError("Delivery area with this name already exists");
      }

      const area = await this.db.deliveryArea.create({
        data: {
          areaName,
          deliveryFee,
          estimatedDeliveryTime,
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      logger.info("Delivery area created successfully", {
        areaId: area.id,
        areaName: area.areaName,
        createdBy: createdBy?.id,
      });

      return {
        ...area,
        deliveryFee: Number(area.deliveryFee),
      };
    } catch (error) {
      logger.error("Create delivery area failed", {
        areaName: areaData.areaName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update delivery area
   */
  async updateDeliveryArea(areaId, updateData, updatedBy) {
    try {
      const existingArea = await this.db.deliveryArea.findUnique({
        where: { id: areaId },
      });

      if (!existingArea) {
        throw new NotFoundError("Delivery area not found");
      }

      // Check name uniqueness if name is being updated
      if (
        updateData.areaName &&
        updateData.areaName !== existingArea.areaName
      ) {
        const duplicateName = await this.db.deliveryArea.findFirst({
          where: {
            areaName: { equals: updateData.areaName, mode: "insensitive" },
            NOT: { id: areaId },
          },
        });

        if (duplicateName) {
          throw new ConflictError(
            "Another delivery area with this name already exists"
          );
        }
      }

      const updatedArea = await this.db.deliveryArea.update({
        where: { id: areaId },
        data: updateData,
      });

      // Clear cache
      await this.cache.del(`delivery_area:${areaId}`);

      logger.info("Delivery area updated successfully", {
        areaId,
        updatedBy: updatedBy?.id,
      });

      return {
        ...updatedArea,
        deliveryFee: Number(updatedArea.deliveryFee),
      };
    } catch (error) {
      logger.error("Update delivery area failed", {
        areaId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete delivery area (soft delete)
   */
  async deleteDeliveryArea(areaId, deletedBy) {
    try {
      const area = await this.db.deliveryArea.findUnique({
        where: { id: areaId },
        include: {
          _count: {
            select: {
              customers: true,
            },
          },
        },
      });

      if (!area) {
        throw new NotFoundError("Delivery area not found");
      }

      // Check if area has customers
      if (area._count.customers > 0) {
        throw new ConflictError(
          `Cannot delete delivery area with ${area._count.customers} active customers. Deactivate it instead.`
        );
      }

      // Soft delete
      await this.db.deliveryArea.update({
        where: { id: areaId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      // Clear cache
      await this.cache.del(`delivery_area:${areaId}`);

      logger.info("Delivery area deleted successfully", {
        areaId,
        deletedBy: deletedBy?.id,
      });
    } catch (error) {
      logger.error("Delete delivery area failed", {
        areaId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Toggle delivery area status
   */
  async toggleDeliveryAreaStatus(areaId, isActive, updatedBy) {
    try {
      const area = await this.db.deliveryArea.findUnique({
        where: { id: areaId },
      });

      if (!area) {
        throw new NotFoundError("Delivery area not found");
      }

      const updatedArea = await this.db.deliveryArea.update({
        where: { id: areaId },
        data: { isActive },
      });

      // Clear cache
      await this.cache.del(`delivery_area:${areaId}`);

      logger.info("Delivery area status toggled", {
        areaId,
        newStatus: isActive,
        updatedBy: updatedBy?.id,
      });

      return {
        ...updatedArea,
        deliveryFee: Number(updatedArea.deliveryFee),
      };
    } catch (error) {
      logger.error("Toggle delivery area status failed", {
        areaId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get delivery area statistics
   */
  async getDeliveryAreaStats() {
    try {
      const cacheKey = "delivery_area_stats";
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const [totalAreas, activeAreas, areasWithCustomers] = await Promise.all(
          [
            this.db.deliveryArea.count(),
            this.db.deliveryArea.count({ where: { isActive: true } }),
            this.db.deliveryArea.findMany({
              include: {
                _count: {
                  select: {
                    customers: true,
                  },
                },
              },
            }),
          ]
        );

        const totalCustomers = areasWithCustomers.reduce(
          (sum, area) => sum + area._count.customers,
          0
        );

        const topAreas = areasWithCustomers
          .sort((a, b) => b._count.customers - a._count.customers)
          .slice(0, 5)
          .map((area) => ({
            id: area.id,
            areaName: area.areaName,
            customersCount: area._count.customers,
            deliveryFee: Number(area.deliveryFee),
          }));

        stats = {
          totalAreas,
          activeAreas,
          inactiveAreas: totalAreas - activeAreas,
          totalCustomers,
          topAreas,
          timestamp: new Date().toISOString(),
        };

        // Cache for 30 minutes
        await this.cache.set(cacheKey, stats, 1800);
      }

      return stats;
    } catch (error) {
      logger.error("Get delivery area stats failed", {
        error: error.message,
      });
      throw error;
    }
  }
}

const deliveryAreasService = new DeliveryAreasService();
export default deliveryAreasService;
