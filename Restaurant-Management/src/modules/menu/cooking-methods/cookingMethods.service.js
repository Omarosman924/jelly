import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../../middleware/errorHandler.js";

/**
 * Cooking Methods Service V2
 * Manages cooking methods and their impact on preparation time and cost
 */
class CookingMethodsService {
  constructor() {
    this.cache = redisClient.cache(3600); // 1 hour cache
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
   * Get all cooking methods with pagination and filtering
   */
  async getAllCookingMethods(options = {}) {
    try {
                  const db = this.getDb();

      const {
        page = 1,
        limit = 50,
        search,
        isAvailable,
        sortBy = "methodNameEn",
        sortOrder = "asc",
      } = options;

      const skip = (page - 1) * limit;
      const where = {};

      if (search) {
        where.OR = [
          { methodNameAr: { contains: search, mode: "insensitive" } },
          { methodNameEn: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      if (typeof isAvailable === "boolean") {
        where.isAvailable = isAvailable;
      }

      const total = await db.cookingMethod.count({ where });
      const cookingMethods = await db.cookingMethod.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      // Add usage statistics
      const methodsWithStats = cookingMethods.map((method) => ({
        ...method,
        usageCount: method._count.orderItems,
        impactOnPrice: Number(method.additionalCost),
        impactOnTime: method.cookingTime,
      }));

      logger.info("Cooking methods retrieved successfully", {
        total,
        returned: cookingMethods.length,
        filters: { search, isAvailable },
      });

      return {
        cookingMethods: methodsWithStats,
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
      logger.error("Get all cooking methods failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get cooking method by ID
   */
  async getCookingMethodById(methodId) {
    try {
                  const db = this.getDb();

      const cacheKey = `cooking_method:${methodId}`;
      let cookingMethod = await this.cache.get(cacheKey);

      if (!cookingMethod) {
        cookingMethod = await db.cookingMethod.findUnique({
          where: { id: methodId },
          include: {
            orderItems: {
              include: {
                order: {
                  select: {
                    id: true,
                    orderNumber: true,
                    orderDateTime: true,
                    totalAmount: true,
                  },
                },
              },
              orderBy: {
                order: {
                  orderDateTime: "desc",
                },
              },
              take: 10, // Last 10 orders using this method
            },
            _count: {
              select: {
                orderItems: true,
              },
            },
          },
        });

        if (!cookingMethod) {
          throw new NotFoundError("Cooking method");
        }

        // Calculate usage statistics
        cookingMethod.stats = {
          totalUsage: cookingMethod._count.orderItems,
          recentUsage: cookingMethod.orderItems.length,
          avgOrderValue:
            cookingMethod.orderItems.length > 0
              ? cookingMethod.orderItems.reduce(
                  (sum, item) => sum + Number(item.order.totalAmount),
                  0
                ) / cookingMethod.orderItems.length
              : 0,
          lastUsed: cookingMethod.orderItems[0]?.order.orderDateTime || null,
        };

        await this.cache.set(cacheKey, cookingMethod);
      }

      return cookingMethod;
    } catch (error) {
      logger.error("Get cooking method by ID failed", {
        methodId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new cooking method
   */
  async createCookingMethod(methodData, createdBy) {
    try {
                  const db = this.getDb();

      const {
        methodNameAr,
        methodNameEn,
        description,
        cookingTime,
        additionalCost,
      } = methodData;

      // Check for duplicate names
      const existingMethod = await db.cookingMethod.findFirst({
        where: {
          OR: [{ methodNameAr }, { methodNameEn }],
        },
      });

      if (existingMethod) {
        throw new ConflictError("Cooking method name already exists");
      }

      // Validate cooking time and cost
      if (cookingTime < 0 || cookingTime > 480) {
        // Max 8 hours
        throw new AppError(
          "Cooking time must be between 0 and 480 minutes",
          400
        );
      }

      if (additionalCost < 0 || additionalCost > 1000) {
        // Reasonable limits
        throw new AppError(
          "Additional cost must be between 0 and 1000 SAR",
          400
        );
      }

      const cookingMethod = await db.cookingMethod.create({
        data: {
          methodNameAr,
          methodNameEn,
          description,
          cookingTime: Number(cookingTime),
          additionalCost: Number(additionalCost),
          isAvailable: true,
        },
      });

      // Clear cache
      await this.invalidateCookingMethodCaches();

      logger.info("Cooking method created successfully", {
        methodId: cookingMethod.id,
        methodNameEn: cookingMethod.methodNameEn,
        createdBy: createdBy?.id || "system",
      });

      return await this.getCookingMethodById(cookingMethod.id);
    } catch (error) {
      logger.error("Create cooking method failed", {
        methodNameEn: methodData.methodNameEn,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update cooking method
   */
  async updateCookingMethod(methodId, updateData, updatedBy) {
    try {
                  const db = this.getDb();

      const existingMethod = await db.cookingMethod.findUnique({
        where: { id: methodId },
      });

      if (!existingMethod) {
        throw new NotFoundError("Cooking method");
      }

      // Check for duplicate names if updating
      if (updateData.methodNameAr || updateData.methodNameEn) {
        const duplicateCheck = await db.cookingMethod.findFirst({
          where: {
            OR: [
              ...(updateData.methodNameAr
                ? [{ methodNameAr: updateData.methodNameAr }]
                : []),
              ...(updateData.methodNameEn
                ? [{ methodNameEn: updateData.methodNameEn }]
                : []),
            ],
            NOT: { id: methodId },
          },
        });

        if (duplicateCheck) {
          throw new ConflictError("Cooking method name already exists");
        }
      }

      // Validate values if provided
      if (updateData.cookingTime !== undefined) {
        if (updateData.cookingTime < 0 || updateData.cookingTime > 480) {
          throw new AppError(
            "Cooking time must be between 0 and 480 minutes",
            400
          );
        }
      }

      if (updateData.additionalCost !== undefined) {
        if (updateData.additionalCost < 0 || updateData.additionalCost > 1000) {
          throw new AppError(
            "Additional cost must be between 0 and 1000 SAR",
            400
          );
        }
      }

      const updatedMethod = await db.cookingMethod.update({
        where: { id: methodId },
        data: {
          ...updateData,
          cookingTime:
            updateData.cookingTime !== undefined
              ? Number(updateData.cookingTime)
              : undefined,
          additionalCost:
            updateData.additionalCost !== undefined
              ? Number(updateData.additionalCost)
              : undefined,
        },
      });

      // Clear cache
      await this.cache.del(`cooking_method:${methodId}`);
      await this.invalidateCookingMethodCaches();

      logger.info("Cooking method updated successfully", {
        methodId,
        updatedBy: updatedBy?.id || "system",
        fields: Object.keys(updateData),
      });

      return await this.getCookingMethodById(methodId);
    } catch (error) {
      logger.error("Update cooking method failed", {
        methodId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete cooking method
   */
  async deleteCookingMethod(methodId, deletedBy) {
    try {
                  const db = this.getDb();

      const cookingMethod = await db.cookingMethod.findUnique({
        where: { id: methodId },
        include: {
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      if (!cookingMethod) {
        throw new NotFoundError("Cooking method");
      }

      // Check if method is used in any orders
      if (cookingMethod._count.orderItems > 0) {
        // Soft delete only
        await db.cookingMethod.update({
          where: { id: methodId },
          data: {
            isAvailable: false,
          },
        });

        logger.info("Cooking method soft deleted (has order references)", {
          methodId,
          methodNameEn: cookingMethod.methodNameEn,
          orderReferences: cookingMethod._count.orderItems,
          deletedBy: deletedBy?.id || "system",
        });
      } else {
        // Hard delete if not referenced
        await db.cookingMethod.delete({
          where: { id: methodId },
        });

        logger.info("Cooking method hard deleted", {
          methodId,
          methodNameEn: cookingMethod.methodNameEn,
          deletedBy: deletedBy?.id || "system",
        });
      }

      // Clear cache
      await this.cache.del(`cooking_method:${methodId}`);
      await this.invalidateCookingMethodCaches();
    } catch (error) {
      logger.error("Delete cooking method failed", {
        methodId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active cooking methods (for dropdowns)
   */
  async getActiveCookingMethods() {
    try {
                  const db = this.getDb();

      const cacheKey = "active_cooking_methods";
      let methods = await this.cache.get(cacheKey);

      if (!methods) {
        methods = await db.cookingMethod.findMany({
          where: { isAvailable: true },
          select: {
            id: true,
            methodNameAr: true,
            methodNameEn: true,
            cookingTime: true,
            additionalCost: true,
          },
          orderBy: [
            { additionalCost: "asc" }, // Cheapest first
            { cookingTime: "asc" }, // Then fastest
          ],
        });

        await this.cache.set(cacheKey, methods, 1800); // 30 minutes
      }

      return methods;
    } catch (error) {
      logger.error("Get active cooking methods failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get cooking methods statistics
   */
  async getCookingMethodsStats() {
    try {
                  const db = this.getDb();

      const cacheKey = "cooking_methods_stats";
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const [
          totalMethods,
          availableMethods,
          avgCookingTime,
          avgAdditionalCost,
          mostUsedMethod,
          methodUsage,
        ] = await Promise.all([
          db.cookingMethod.count(),
          db.cookingMethod.count({ where: { isAvailable: true } }),
          db.cookingMethod.aggregate({
            _avg: { cookingTime: true },
            where: { isAvailable: true },
          }),
          db.cookingMethod.aggregate({
            _avg: { additionalCost: true },
            where: { isAvailable: true },
          }),
          this.getMostUsedCookingMethod(),
          this.getCookingMethodUsageStats(),
        ]);

        stats = {
          totalMethods,
          availableMethods,
          unavailableMethods: totalMethods - availableMethods,
          avgCookingTime: Math.round(avgCookingTime._avg.cookingTime || 0),
          avgAdditionalCost: Number(
            avgAdditionalCost._avg.additionalCost || 0
          ).toFixed(2),
          mostUsedMethod,
          usageDistribution: methodUsage,
          timestamp: new Date().toISOString(),
        };

        // Cache for 30 minutes
        await this.cache.set(cacheKey, stats, 1800);
      }

      return stats;
    } catch (error) {
      logger.error("Get cooking methods stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get most used cooking method
   */
  async getMostUsedCookingMethod() {
    try {
                  const db = this.getDb();
      const result = await db.cookingMethod.findFirst({
        include: {
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
        orderBy: {
          orderItems: {
            _count: "desc",
          },
        },
      });

      return result
        ? {
            id: result.id,
            methodNameEn: result.methodNameEn,
            methodNameAr: result.methodNameAr,
            usageCount: result._count.orderItems,
          }
        : null;
    } catch (error) {
      logger.error("Get most used cooking method failed", {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get cooking method usage statistics
   */
  async getCookingMethodUsageStats() {
    try {
                  const db = this.getDb();

      const usageStats = await db.orderItem.groupBy({
        by: ["cookingMethodId"],
        _count: { cookingMethodId: true },
        where: {
          cookingMethodId: { not: null },
        },
        orderBy: {
          _count: {
            cookingMethodId: "desc",
          },
        },
        take: 10, // Top 10 most used methods
      });

      // Get method names
      if (usageStats.length > 0) {
        const methodIds = usageStats.map((stat) => stat.cookingMethodId);
        const methods = await db.cookingMethod.findMany({
          where: { id: { in: methodIds } },
          select: {
            id: true,
            methodNameEn: true,
            methodNameAr: true,
          },
        });

        return usageStats.map((stat) => {
          const method = methods.find((m) => m.id === stat.cookingMethodId);
          return {
            methodId: stat.cookingMethodId,
            methodName:
              method?.methodNameEn || method?.methodNameAr || "Unknown",
            usageCount: stat._count.cookingMethodId,
          };
        });
      }

      return [];
    } catch (error) {
      logger.error("Get cooking method usage stats failed", {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Calculate impact on order (time and cost)
   */
  async calculateMethodImpact(methodId, quantity = 1) {
    try {
                  const db = this.getDb();

      const method = await db.cookingMethod.findUnique({
        where: { id: methodId, isAvailable: true },
      });

      if (!method) {
        throw new NotFoundError("Cooking method");
      }

      return {
        additionalTime: method.cookingTime * quantity,
        additionalCost: Number(method.additionalCost) * quantity,
        method: {
          id: method.id,
          nameEn: method.methodNameEn,
          nameAr: method.methodNameAr,
        },
      };
    } catch (error) {
      logger.error("Calculate method impact failed", {
        methodId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get popular cooking methods by time period
   */
  async getPopularMethods(days = 30) {
    try {
                  const db = this.getDb();

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const popularMethods = await db.orderItem.groupBy({
        by: ["cookingMethodId"],
        _count: { cookingMethodId: true },
        _sum: { totalPrice: true },
        where: {
          cookingMethodId: { not: null },
          order: {
            orderDateTime: { gte: startDate },
          },
        },
        orderBy: {
          _count: {
            cookingMethodId: "desc",
          },
        },
        take: 5,
      });

      if (popularMethods.length > 0) {
        const methodIds = popularMethods.map((m) => m.cookingMethodId);
        const methods = await db.cookingMethod.findMany({
          where: { id: { in: methodIds } },
        });

        return popularMethods.map((stat) => {
          const method = methods.find((m) => m.id === stat.cookingMethodId);
          return {
            ...method,
            usageCount: stat._count.cookingMethodId,
            totalRevenue: stat._sum.totalPrice || 0,
          };
        });
      }

      return [];
    } catch (error) {
      logger.error("Get popular methods failed", {
        days,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Invalidate cooking method related caches
   */
  async invalidateCookingMethodCaches() {
    const cacheKeys = ["active_cooking_methods", "cooking_methods_stats"];
    await Promise.all(cacheKeys.map((key) => this.cache.del(key)));
  }
}

const cookingMethodsService = new CookingMethodsService();
export default cookingMethodsService;
