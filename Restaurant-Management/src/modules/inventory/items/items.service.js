import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../../middleware/errorHandler.js";

/**
 * Items Service V2
 * Advanced inventory item management with stock tracking and alerts
 */
class ItemsService {
  constructor() {
    this.cache = redisClient.cache(1800); // 30 minutes cache
    this.alertCache = redisClient.cache(300); // 5 minutes for alerts
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
   * Get all items with advanced filtering and pagination
   */
  async getAllItems(options = {}) {
    try {
      const db = this.getDb();
      const {
        page = 1,
        limit = 10,
        search,
        itemType,
        unitId,
        isAvailable,
        lowStock = false,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {};

      if (search) {
        where.OR = [
          { itemCode: { contains: search, mode: "insensitive" } },
          { itemNameAr: { contains: search, mode: "insensitive" } },
          { itemNameEn: { contains: search, mode: "insensitive" } },
        ];
      }

      if (itemType) {
        where.itemType = itemType;
      }

      if (unitId) {
        where.unitId = unitId;
      }

      if (typeof isAvailable === "boolean") {
        where.isAvailable = isAvailable;
      }

      if (lowStock) {
        where.currentStock = {
          lte: db.$queryRaw`min_stock_level`,
        };
      }

      // Build order by
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      // Get total count
      const total = await db.item.count({ where });

      // Get items with related data
      const items = await db.item.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          unit: {
            select: {
              unitNameAr: true,
              unitNameEn: true,
              unitSymbol: true,
            },
          },
        },
      });

      // Add stock status and alerts
      const itemsWithStatus = await Promise.all(
        items.map(async (item) => {
          const stockStatus = this.getStockStatus(item);
          const stockValue = this.calculateStockValue(item);

          return {
            ...item,
            stockStatus,
            stockValue,
            stockPercentage: this.calculateStockPercentage(item),
          };
        })
      );

      logger.info("Items retrieved successfully", {
        total,
        returned: items.length,
        filters: { search, itemType, lowStock },
      });

      return {
        items: itemsWithStatus,
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
      logger.error("Get all items failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get item by ID with caching
   */
  async getItemById(itemId) {
    try {
      const db = this.getDb();
      const cacheKey = `item:${itemId}`;
      let item = await this.cache.get(cacheKey);

      if (!item) {
        item = await db.item.findUnique({
          where: { id: itemId },
          include: {
            unit: true,
            stockMovements: {
              take: 10,
              orderBy: { createdAt: "desc" },
              include: {
                createdByStaff: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        });

        if (!item) {
          throw new NotFoundError("Item");
        }

        // Add calculated fields
        item.stockStatus = this.getStockStatus(item);
        item.stockValue = this.calculateStockValue(item);
        item.stockPercentage = this.calculateStockPercentage(item);

        await this.cache.set(cacheKey, item);
      }

      return item;
    } catch (error) {
      logger.error("Get item by ID failed", {
        itemId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new item
   */
  async createItem(itemData, createdBy) {
    try {
      const db = this.getDb();
      const {
        itemCode,
        itemNameAr,
        itemNameEn,
        description,
        unitId,
        itemType,
        costPrice,
        sellingPrice,
        minStockLevel,
        caloriesPerUnit,
        imageUrl,
        initialStock = 0,
      } = itemData;

      // Check if item code already exists
      const existingItem = await db.item.findUnique({
        where: { itemCode },
      });

      if (existingItem) {
        throw new ConflictError("Item code already exists");
      }

      // Verify unit exists
      const unit = await db.unit.findUnique({
        where: { id: unitId },
      });

      if (!unit) {
        throw new NotFoundError("Unit");
      }

      // Create item in transaction
      const item = await db.$transaction(async (prisma) => {
        // Create item
        const newItem = await prisma.item.create({
          data: {
            itemCode,
            itemNameAr,
            itemNameEn,
            description,
            unitId,
            itemType,
            costPrice,
            sellingPrice,
            currentStock: initialStock,
            minStockLevel,
            caloriesPerUnit,
            imageUrl,
            isAvailable: true,
          },
        });

        // Create initial stock movement if initial stock > 0
        if (initialStock > 0) {
          await prisma.stockMovement.create({
            data: {
              itemId: newItem.id,
              movementType: "ADJUSTMENT",
              quantityChange: initialStock,
              quantityBefore: 0,
              quantityAfter: initialStock,
              referenceType: "initial_stock",
              createdByStaffId: createdBy.staff?.id || createdBy.id,
            },
          });
        }

        return newItem;
      });

      logger.info("Item created successfully", {
        itemId: item.id,
        itemCode: item.itemCode,
        createdBy: createdBy.id,
      });

      // Clear cache and get complete item data
      await this.invalidateItemCaches();
      return await this.getItemById(item.id);
    } catch (error) {
      logger.error("Create item failed", {
        itemCode: itemData.itemCode,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update item
   */
  async updateItem(itemId, updateData, updatedBy) {
    try {
      const db = this.getDb();
      const existingItem = await db.item.findUnique({
        where: { id: itemId },
      });

      if (!existingItem) {
        throw new NotFoundError("Item");
      }

      // Check item code uniqueness if being updated
      if (
        updateData.itemCode &&
        updateData.itemCode !== existingItem.itemCode
      ) {
        const codeExists = await db.item.findFirst({
          where: {
            itemCode: updateData.itemCode,
            NOT: { id: itemId },
          },
        });

        if (codeExists) {
          throw new ConflictError("Item code already exists");
        }
      }

      // Verify unit exists if being updated
      if (updateData.unitId) {
        const unit = await db.unit.findUnique({
          where: { id: updateData.unitId },
        });

        if (!unit) {
          throw new NotFoundError("Unit");
        }
      }

      // Update item
      const updatedItem = await db.item.update({
        where: { id: itemId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });

      // Clear cache
      await this.cache.del(`item:${itemId}`);
      await this.invalidateItemCaches();

      logger.info("Item updated successfully", {
        itemId,
        updatedBy: updatedBy.id,
        fields: Object.keys(updateData),
      });

      return await this.getItemById(itemId);
    } catch (error) {
      logger.error("Update item failed", {
        itemId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete item
   */
  async deleteItem(itemId, deletedBy) {
    try {
      const db = this.getDb();
      const item = await db.item.findUnique({
        where: { id: itemId },
        include: {
          recipeItems: true,
          mealItems: true,
        },
      });

      if (!item) {
        throw new NotFoundError("Item");
      }

      // Check if item is used in recipes or meals
      if (item.recipeItems.length > 0 || item.mealItems.length > 0) {
        throw new AppError(
          "Cannot delete item that is used in recipes or meals",
          400
        );
      }

      // Soft delete by setting isAvailable to false
      await db.item.update({
        where: { id: itemId },
        data: {
          isAvailable: false,
          updatedAt: new Date(),
        },
      });

      // Clear cache
      await this.cache.del(`item:${itemId}`);
      await this.invalidateItemCaches();

      logger.info("Item deleted successfully", {
        itemId,
        itemCode: item.itemCode,
        deletedBy: deletedBy.id,
      });
    } catch (error) {
      logger.error("Delete item failed", {
        itemId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Adjust stock
   */
  async adjustStock(itemId, adjustment, adjustedBy) {
    try {
      const db = this.getDb();
      const { quantity, reason, referenceId, referenceType } = adjustment;

      const item = await db.item.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        throw new NotFoundError("Item");
      }

      const newQuantity = Number(item.currentStock) + Number(quantity);

      if (newQuantity < 0) {
        throw new AppError("Insufficient stock for adjustment", 400);
      }

      // Perform stock adjustment in transaction
      await db.$transaction(async (prisma) => {
        // Update item stock
        await prisma.item.update({
          where: { id: itemId },
          data: { currentStock: newQuantity },
        });

        // Create stock movement record
        await prisma.stockMovement.create({
          data: {
            itemId,
            movementType: "ADJUSTMENT",
            quantityChange: quantity,
            quantityBefore: item.currentStock,
            quantityAfter: newQuantity,
            referenceId,
            referenceType: referenceType || reason,
            createdByStaffId: adjustedBy.staff?.id || adjustedBy.id,
          },
        });
      });

      // Clear cache
      await this.cache.del(`item:${itemId}`);

      // Check for low stock alerts
      await this.checkLowStockAlert(itemId, newQuantity);

      logger.info("Stock adjusted successfully", {
        itemId,
        quantity,
        newQuantity,
        adjustedBy: adjustedBy.id,
      });

      return await this.getItemById(itemId);
    } catch (error) {
      logger.error("Stock adjustment failed", {
        itemId,
        adjustment,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get low stock items
   */
  async getLowStockItems() {
    try {
      const db = this.getDb();
      const cacheKey = "low_stock_items";
      let lowStockItems = await this.alertCache.get(cacheKey);

      if (!lowStockItems) {
        lowStockItems = await db.item.findMany({
          where: {
            AND: [
              { isAvailable: true },
              {
                OR: [
                  { currentStock: { lt: db.$queryRaw`min_stock_level` } },
                  { currentStock: { equals: 0 } },
                ],
              },
            ],
          },
          include: {
            unit: {
              select: {
                unitNameAr: true,
                unitNameEn: true,
                unitSymbol: true,
              },
            },
          },
          orderBy: { currentStock: "asc" },
        });

        // Add stock status to each item
        lowStockItems = lowStockItems.map((item) => ({
          ...item,
          stockStatus: this.getStockStatus(item),
          stockPercentage: this.calculateStockPercentage(item),
        }));

        await this.alertCache.set(cacheKey, lowStockItems);
      }

      return lowStockItems;
    } catch (error) {
      logger.error("Get low stock items failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats() {
    try {
      const db = this.getDb();
      const cacheKey = "inventory_stats";
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const [
          totalItems,
          availableItems,
          outOfStockCount,
          totalValue,
          itemsByType,
        ] = await Promise.all([
          db.item.count(),
          db.item.count({ where: { isAvailable: true } }),
          db.item.count({
            where: {
              AND: [{ isAvailable: true }, { currentStock: { equals: 0 } }],
            },
          }),
          db.item.aggregate({
            _sum: {
              currentStock: true,
            },
            where: { isAvailable: true },
          }),
          db.item.groupBy({
            by: ["itemType"],
            _count: true,
            where: { isAvailable: true },
          }),
        ]);

        // Get low stock count using raw query
        const lowStockResult = await db.$queryRaw`
        SELECT COUNT(*) as count 
        FROM "Item" 
        WHERE "isAvailable" = true 
        AND "currentStock" < "minStockLevel"
      `;

        const lowStockCount = Number(lowStockResult[0].count);

        stats = {
          totalItems,
          availableItems,
          unavailableItems: totalItems - availableItems,
          lowStockCount,
          outOfStockCount,
          totalStockUnits: totalValue._sum.currentStock || 0,
          itemTypeDistribution: itemsByType.reduce((acc, item) => {
            acc[item.itemType] = item._count;
            return acc;
          }, {}),
          timestamp: new Date().toISOString(),
        };

        // Cache for 10 minutes
        await this.cache.set(cacheKey, stats, 600);
      }

      return stats;
    } catch (error) {
      logger.error("Get inventory stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get stock status (helper method)
   */
  getStockStatus(item) {
    if (item.currentStock === 0) return "OUT_OF_STOCK";
    if (item.currentStock < item.minStockLevel) return "LOW_STOCK";
    if (item.currentStock <= item.minStockLevel * 1.5) return "WARNING";
    return "IN_STOCK";
  }

  /**
   * Calculate stock value (helper method)
   */
  calculateStockValue(item) {
    return Number(item.currentStock) * Number(item.costPrice);
  }

  /**
   * Calculate stock percentage (helper method)
   */
  calculateStockPercentage(item) {
    if (item.minStockLevel === 0) return 100;
    return Math.round((item.currentStock / item.minStockLevel) * 100);
  }

  /**
   * Check for low stock alert
   */
  async checkLowStockAlert(itemId, currentStock) {
    try {
      const db = this.getDb();
      const item = await db.item.findUnique({
        where: { id: itemId },
        select: { minStockLevel: true, itemNameAr: true, itemNameEn: true },
      });

      if (currentStock <= item.minStockLevel) {
        // Publish low stock alert
        await redisClient.publish("inventory_alerts", {
          type: "LOW_STOCK",
          itemId,
          itemName: item.itemNameEn || item.itemNameAr,
          currentStock,
          minStockLevel: item.minStockLevel,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Low stock alert check failed", {
        itemId,
        error: error.message,
      });
    }
  }

  /**
   * Invalidate item-related caches
   */
  async invalidateItemCaches() {
    const cacheKeys = ["inventory_stats", "low_stock_items"];
    await Promise.all(cacheKeys.map((key) => this.cache.del(key)));
  }
}
const itemsService = new ItemsService();
export default itemsService;
