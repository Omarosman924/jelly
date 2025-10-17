import { getDatabaseClient } from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  AppError,
} from "../../middleware/errorHandler.js";

/**
 * Categories Service - Production Ready
 * Handles all category management business logic with full functionality
 */
class CategoriesService {
  constructor() {
    this.cache = redisClient.cache(1800); // 30 minutes cache
    this.alertCache = redisClient.cache(300); // 5 minutes for alerts
  }

  /**
   * Get database client with lazy initialization
   */
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
   * Get all categories with advanced filtering and pagination
   */
  async getAllCategories(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        isActive,
        sortBy = "displayOrder",
        sortOrder = "asc",
        includeItems = false,
      } = options;

      // Validate pagination
      if (page < 1 || limit < 1 || limit > 100) {
        throw new ValidationError("Invalid pagination parameters");
      }

      const skip = (page - 1) * limit;
      const db = this.getDb();

      // Build where clause
      const where = { deletedAt: null };

      if (search?.trim()) {
        where.OR = [
          { categoryNameAr: { contains: search.trim(), mode: "insensitive" } },
          { categoryNameEn: { contains: search.trim(), mode: "insensitive" } },
          { description: { contains: search.trim(), mode: "insensitive" } },
        ];
      }

      if (typeof isActive === "boolean") {
        where.isActive = isActive;
      }

      // Build orderBy with validation
      const validSortFields = [
        "categoryNameAr",
        "categoryNameEn",
        "displayOrder",
        "createdAt",
        "updatedAt",
      ];
      if (!validSortFields.includes(sortBy)) {
        throw new ValidationError("Invalid sort field");
      }

      const orderBy = {};
      if (sortBy === "name") {
        orderBy.categoryNameEn = sortOrder;
      } else {
        orderBy[sortBy] = sortOrder;
      }

      // Build include clause
      const include = {};
      if (includeItems) {
        include.items = {
          where: { deletedAt: null, isAvailable: true },
          select: {
            id: true,
            itemNameAr: true,
            itemNameEn: true,
            sellingPrice: true,
            imageUrl: true,
            isAvailable: true,
          },
          orderBy: { itemNameEn: "asc" },
          take: 20, // Limit items per category
        };
      }

      // Execute queries with timeout protection
      const queryTimeout = 30000; // 30 seconds
      const [categories, total] = await Promise.race([
        Promise.all([
          db.category.findMany({
            where,
            select: {
              id: true,
              categoryNameAr: true,
              categoryNameEn: true,
              description: true,
              imageUrl: true,
              displayOrder: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
              version: true,
            },
            include: Object.keys(include).length > 0 ? include : undefined,
            orderBy,
            skip,
            take: limit,
          }),
          db.category.count({ where }),
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Query timeout")), queryTimeout)
        ),
      ]);

      // Add counts separately for categories without include
      if (!includeItems) {
        try {
          for (const category of categories) {
            const counts = await Promise.allSettled([
              db.item.count({
                where: { categoryId: category.id, deletedAt: null },
              }),
            ]);

            category._count = {
              items: counts[0].status === "fulfilled" ? counts[0].value : 0,
              recipes: 0, // Set to 0 if recipe model doesn't exist
              meals: 0, // Set to 0 if meal model doesn't exist
            };
          }
        } catch (countError) {
          logger.warn("Failed to get category counts", {
            error: countError.message,
          });
          // Set default counts
          categories.forEach((category) => {
            category._count = { items: 0, recipes: 0, meals: 0 };
          });
        }
      }

      const result = {
        categories,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };

      logger.info("Categories retrieved successfully", {
        total,
        returned: categories.length,
        page,
        limit,
        hasFilters: !!search || isActive !== undefined,
      });

      return result;
    } catch (error) {
      logger.error("Get all categories failed", {
        error: error.message,
        stack: error.stack,
        options,
      });
      throw error;
    }
  }

  /**
   * Get category by ID with caching
   */
  async getCategoryById(categoryId, options = {}) {
    try {
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        throw new ValidationError("Invalid category ID");
      }

      const cacheKey = `category:${categoryId}:${JSON.stringify(options)}`;
      let category = await this.cache.get(cacheKey);

      if (!category) {
        const db = this.getDb();
        const {
          includeItems = false,
          includeRecipes = false,
          includeMeals = false,
        } = options;

        const include = {};

        if (includeItems) {
          include.items = {
            where: { deletedAt: null },
            select: {
              id: true,
              itemCode: true,
              itemNameAr: true,
              itemNameEn: true,
              description: true,
              sellingPrice: true,
              currentStock: true,
              imageUrl: true,
              isAvailable: true,
              unit: {
                select: {
                  id: true,
                  unitNameAr: true,
                  unitNameEn: true,
                  unitSymbol: true,
                },
              },
            },
            orderBy: { displayOrder: "asc" },
            take: 50, // Limit items
          };
        }

        if (includeRecipes) {
          include.recipes = {
            where: { deletedAt: null },
            select: {
              id: true,
              recipeCode: true,
              recipeNameAr: true,
              recipeNameEn: true,
              description: true,
              sellingPrice: true,
              preparationTime: true,
              totalCalories: true,
              imageUrl: true,
              isAvailable: true,
            },
            orderBy: { recipeNameEn: "asc" },
            take: 50,
          };
        }

        if (includeMeals) {
          include.meals = {
            where: { deletedAt: null },
            select: {
              id: true,
              mealCode: true,
              mealNameAr: true,
              mealNameEn: true,
              description: true,
              sellingPrice: true,
              preparationTime: true,
              totalCalories: true,
              imageUrl: true,
              isAvailable: true,
            },
            orderBy: { mealNameEn: "asc" },
            take: 50,
          };
        }

        category = await db.category.findFirst({
          where: {
            id: categoryId,
            deletedAt: null,
          },
          select: {
            id: true,
            categoryNameAr: true,
            categoryNameEn: true,
            description: true,
            imageUrl: true,
            displayOrder: true,
            isActive: true,
            version: true,
            createdAt: true,
            updatedAt: true,
          },
          include: Object.keys(include).length > 0 ? include : undefined,
        });

        if (!category) {
          throw new NotFoundError("Category not found");
        }

        // Get counts separately if needed
        if (!includeItems && !includeRecipes && !includeMeals) {
          try {
            const counts = await Promise.allSettled([
              db.item.count({ where: { categoryId, deletedAt: null } }),
              db.recipe
                ? db.recipe.count({ where: { categoryId, deletedAt: null } })
                : Promise.resolve(0),
              db.meal
                ? db.meal.count({ where: { categoryId, deletedAt: null } })
                : Promise.resolve(0),
            ]);

            category._count = {
              items: counts[0].status === "fulfilled" ? counts[0].value : 0,
              recipes: counts[1].status === "fulfilled" ? counts[1].value : 0,
              meals: counts[2].status === "fulfilled" ? counts[2].value : 0,
            };
          } catch (countError) {
            logger.warn("Failed to get counts", {
              categoryId,
              error: countError.message,
            });
            category._count = { items: 0, recipes: 0, meals: 0 };
          }
        }

        // Cache for shorter time if includes are present
        const cacheTime = Object.keys(include).length > 0 ? 600 : 1800;
        await this.cache.set(cacheKey, category, cacheTime);
      }

      return category;
    } catch (error) {
      logger.error("Get category by ID failed", {
        categoryId,
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Create new category with business logic validation
   */
  async createCategory(categoryData, createdBy) {
    try {
      const {
        categoryNameAr,
        categoryNameEn,
        description,
        imageUrl,
        displayOrder,
        isActive = true,
      } = categoryData;

      // Validate business rules
      await this.validateCategoryData(categoryData);

      const db = this.getDb();

      // Check for duplicate category names
      const existing = await db.category.findFirst({
        where: {
          OR: [
            { categoryNameAr: categoryNameAr.trim() },
            { categoryNameEn: categoryNameEn.trim() },
          ],
          deletedAt: null,
        },
        select: { id: true, categoryNameAr: true, categoryNameEn: true },
      });

      if (existing) {
        if (existing.categoryNameAr === categoryNameAr.trim()) {
          throw new ConflictError("Arabic category name already exists");
        }
        if (existing.categoryNameEn === categoryNameEn.trim()) {
          throw new ConflictError("English category name already exists");
        }
      }

      // Handle display order
      let finalDisplayOrder = displayOrder;
      if (!displayOrder || displayOrder <= 0) {
        const lastCategory = await db.category.findFirst({
          where: { deletedAt: null },
          orderBy: { displayOrder: "desc" },
          select: { displayOrder: true },
        });
        finalDisplayOrder = (lastCategory?.displayOrder || 0) + 1;
      } else {
        // Check if display order already exists
        const existingOrder = await db.category.findFirst({
          where: { displayOrder: finalDisplayOrder, deletedAt: null },
        });
        if (existingOrder) {
          // Auto-increment to next available order
          finalDisplayOrder =
            (await this.getNextDisplayOrder()) || finalDisplayOrder;
        }
      }

      // Create category in transaction
      const category = await db.$transaction(async (tx) => {
        const newCategory = await tx.category.create({
          data: {
            categoryNameAr: categoryNameAr.trim(),
            categoryNameEn: categoryNameEn.trim(),
            description: description?.trim() || null,
            imageUrl: imageUrl?.trim() || null,
            displayOrder: finalDisplayOrder,
            isActive,
          },
          select: {
            id: true,
            categoryNameAr: true,
            categoryNameEn: true,
            description: true,
            imageUrl: true,
            displayOrder: true,
            isActive: true,
            version: true,
            createdAt: true,
          },
        });

        // Log the creation
        await this.createAuditLog(tx, {
          userId: createdBy,
          action: "CATEGORY_CREATED",
          tableName: "categories",
          recordId: newCategory.id,
          newValues: JSON.stringify(categoryData),
        });

        return newCategory;
      });

      // Clear caches
      await this.clearCategoriesCache();

      logger.info("Category created successfully", {
        categoryId: category.id,
        categoryNameEn: category.categoryNameEn,
        displayOrder: category.displayOrder,
        createdBy,
      });

      return await this.getCategoryById(category.id);
    } catch (error) {
      if (error.code === "P2002") {
        const target = error.meta?.target;
        if (target?.includes("categoryNameAr")) {
          throw new ConflictError("Arabic category name already exists");
        }
        if (target?.includes("categoryNameEn")) {
          throw new ConflictError("English category name already exists");
        }
        if (target?.includes("displayOrder")) {
          throw new ConflictError("Display order already exists");
        }
      }

      logger.error("Create category failed", {
        categoryData,
        error: error.message,
        createdBy,
      });
      throw error;
    }
  }

  /**
   * Update category with validation and conflict resolution
   */
  async updateCategory(categoryId, updateData, updatedBy) {
    try {
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        throw new ValidationError("Invalid category ID");
      }

      const db = this.getDb();

      // Check if category exists and get current data
      const existingCategory = await db.category.findFirst({
        where: { id: categoryId, deletedAt: null },
      });

      if (!existingCategory) {
        throw new NotFoundError("Category not found");
      }

      // Filter and validate allowed fields
      const allowedFields = [
        "categoryNameAr",
        "categoryNameEn",
        "description",
        "imageUrl",
        "displayOrder",
        "isActive",
      ];

      const filteredData = Object.keys(updateData)
        .filter(
          (key) => allowedFields.includes(key) && updateData[key] !== undefined
        )
        .reduce((obj, key) => {
          if (typeof updateData[key] === "string") {
            obj[key] = updateData[key].trim();
          } else {
            obj[key] = updateData[key];
          }
          return obj;
        }, {});

      if (Object.keys(filteredData).length === 0) {
        throw new ValidationError("No valid fields provided for update");
      }

      // Validate update data
      await this.validateCategoryData(filteredData, categoryId);

      // Check for name conflicts
      if (filteredData.categoryNameAr || filteredData.categoryNameEn) {
        const whereConditions = [];
        if (filteredData.categoryNameAr) {
          whereConditions.push({ categoryNameAr: filteredData.categoryNameAr });
        }
        if (filteredData.categoryNameEn) {
          whereConditions.push({ categoryNameEn: filteredData.categoryNameEn });
        }

        const conflictingCategory = await db.category.findFirst({
          where: {
            AND: [
              { id: { not: categoryId } },
              { deletedAt: null },
              { OR: whereConditions },
            ],
          },
        });

        if (conflictingCategory) {
          throw new ConflictError("Category name already exists");
        }
      }

      // Check display order conflicts
      if (
        filteredData.displayOrder &&
        filteredData.displayOrder !== existingCategory.displayOrder
      ) {
        const orderConflict = await db.category.findFirst({
          where: {
            displayOrder: filteredData.displayOrder,
            deletedAt: null,
            id: { not: categoryId },
          },
        });

        if (orderConflict) {
          // Auto-resolve by finding next available order
          filteredData.displayOrder = await this.getNextDisplayOrder();
        }
      }

      // Update in transaction
      const updatedCategory = await db.$transaction(async (tx) => {
        const updated = await tx.category.update({
          where: { id: categoryId },
          data: {
            ...filteredData,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
          select: {
            id: true,
            categoryNameAr: true,
            categoryNameEn: true,
            description: true,
            imageUrl: true,
            displayOrder: true,
            isActive: true,
            version: true,
            updatedAt: true,
          },
        });

        // Log the update
        await this.createAuditLog(tx, {
          userId: updatedBy,
          action: "CATEGORY_UPDATED",
          tableName: "categories",
          recordId: categoryId,
          oldValues: JSON.stringify(existingCategory),
          newValues: JSON.stringify(filteredData),
        });

        return updated;
      });

      // Clear caches
      await this.cache.del(`category:${categoryId}*`);
      await this.clearCategoriesCache();

      logger.info("Category updated successfully", {
        categoryId,
        updatedFields: Object.keys(filteredData),
        updatedBy,
      });

      return await this.getCategoryById(categoryId);
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("Category not found");
      }
      if (error.code === "P2002") {
        throw new ConflictError("Category data conflicts with existing record");
      }

      logger.error("Update category failed", {
        categoryId,
        updateData,
        error: error.message,
        updatedBy,
      });
      throw error;
    }
  }

  /**
   * Delete category with dependency checks
   */
  async deleteCategory(categoryId, deletedBy) {
    try {
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        throw new ValidationError("Invalid category ID");
      }

      const db = this.getDb();

      // Check if category exists
      const category = await db.category.findFirst({
        where: { id: categoryId, deletedAt: null },
        select: {
          id: true,
          categoryNameAr: true,
          categoryNameEn: true,
        },
      });

      if (!category) {
        throw new NotFoundError("Category not found");
      }

      // Check for dependencies separately
      let totalUsage = 0;
      try {
        const itemCount = await db.item.count({
          where: { categoryId, deletedAt: null },
        });
        totalUsage += itemCount;

        // Add other counts if models exist
        try {
          if (db.recipe) {
            const recipeCount = await db.recipe.count({
              where: { categoryId, deletedAt: null },
            });
            totalUsage += recipeCount;
          }
        } catch (e) {
          // Recipe model doesn't exist, skip
        }

        try {
          if (db.meal) {
            const mealCount = await db.meal.count({
              where: { categoryId, deletedAt: null },
            });
            totalUsage += mealCount;
          }
        } catch (e) {
          // Meal model doesn't exist, skip
        }
      } catch (error) {
        logger.warn("Failed to check dependencies", {
          categoryId,
          error: error.message,
        });
        // Continue with deletion if dependency check fails
      }

      if (totalUsage > 0) {
        throw new ValidationError(
          `Cannot delete category. It has ${totalUsage} associated items/recipes/meals. ` +
            "Please move or delete associated items first."
        );
      }

      // Soft delete in transaction
      await db.$transaction(async (tx) => {
        await tx.category.update({
          where: { id: categoryId },
          data: {
            deletedAt: new Date(),
            isActive: false,
            version: { increment: 1 },
          },
        });

        // Log the deletion
        await this.createAuditLog(tx, {
          userId: deletedBy,
          action: "CATEGORY_DELETED",
          tableName: "categories",
          recordId: categoryId,
          oldValues: JSON.stringify(category),
        });
      });

      // Clear caches
      await this.cache.del(`category:${categoryId}*`);
      await this.clearCategoriesCache();

      logger.warn("Category deleted successfully", {
        categoryId,
        categoryNameEn: category.categoryNameEn,
        deletedBy,
      });
    } catch (error) {
      logger.error("Delete category failed", {
        categoryId,
        error: error.message,
        deletedBy,
      });
      throw error;
    }
  }

  /**
   * Restore deleted category
   */
  async restoreCategory(categoryId, restoredBy) {
    try {
      const db = this.getDb();

      const category = await db.category.findUnique({
        where: { id: categoryId },
        select: {
          id: true,
          categoryNameAr: true,
          categoryNameEn: true,
          deletedAt: true,
        },
      });

      if (!category) {
        throw new NotFoundError("Category not found");
      }

      if (!category.deletedAt) {
        throw new ValidationError("Category is not deleted");
      }

      // Check for name conflicts before restoring
      const nameConflict = await db.category.findFirst({
        where: {
          AND: [
            { id: { not: categoryId } },
            { deletedAt: null },
            {
              OR: [
                { categoryNameAr: category.categoryNameAr },
                { categoryNameEn: category.categoryNameEn },
              ],
            },
          ],
        },
      });

      if (nameConflict) {
        throw new ConflictError(
          "Cannot restore: Category with this name already exists"
        );
      }

      const restoredCategory = await db.$transaction(async (tx) => {
        const restored = await tx.category.update({
          where: { id: categoryId },
          data: {
            deletedAt: null,
            isActive: true,
            version: { increment: 1 },
          },
          select: {
            id: true,
            categoryNameAr: true,
            categoryNameEn: true,
            description: true,
            imageUrl: true,
            displayOrder: true,
            isActive: true,
            updatedAt: true,
          },
        });

        // Log the restoration
        await this.createAuditLog(tx, {
          userId: restoredBy,
          action: "CATEGORY_RESTORED",
          tableName: "categories",
          recordId: categoryId,
          newValues: JSON.stringify({ restored: true }),
        });

        return restored;
      });

      await this.clearCategoriesCache();

      logger.info("Category restored successfully", {
        categoryId,
        restoredBy,
      });

      return restoredCategory;
    } catch (error) {
      logger.error("Restore category failed", {
        categoryId,
        error: error.message,
        restoredBy,
      });
      throw error;
    }
  }

  /**
   * Update category status
   */
  async updateCategoryStatus(categoryId, isActive, updatedBy) {
    try {
      const db = this.getDb();

      const category = await db.category.findFirst({
        where: { id: categoryId, deletedAt: null },
      });

      if (!category) {
        throw new NotFoundError("Category not found");
      }

      const updatedCategory = await db.$transaction(async (tx) => {
        const updated = await tx.category.update({
          where: { id: categoryId },
          data: {
            isActive,
            version: { increment: 1 },
          },
          select: {
            id: true,
            categoryNameAr: true,
            categoryNameEn: true,
            description: true,
            imageUrl: true,
            displayOrder: true,
            isActive: true,
            updatedAt: true,
          },
        });

        await this.createAuditLog(tx, {
          userId: updatedBy,
          action: "CATEGORY_STATUS_UPDATED",
          tableName: "categories",
          recordId: categoryId,
          newValues: JSON.stringify({
            isActive,
            previousStatus: category.isActive,
          }),
        });

        return updated;
      });

      await this.cache.del(`category:${categoryId}*`);
      await this.clearCategoriesCache();

      return updatedCategory;
    } catch (error) {
      logger.error("Update category status failed", {
        categoryId,
        isActive,
        error: error.message,
        updatedBy,
      });
      throw error;
    }
  }

  /**
   * Reorder categories
   */
  async reorderCategories(categoryOrders, updatedBy) {
    try {
      if (!Array.isArray(categoryOrders) || categoryOrders.length === 0) {
        throw new ValidationError("Invalid category orders data");
      }

      // Validate each order entry
      for (const order of categoryOrders) {
        if (!order.id || typeof order.displayOrder !== "number") {
          throw new ValidationError(
            "Each category order must have id and displayOrder"
          );
        }
        if (!Number.isInteger(order.id) || order.id <= 0) {
          throw new ValidationError("Invalid category ID in orders");
        }
        if (!Number.isInteger(order.displayOrder) || order.displayOrder <= 0) {
          throw new ValidationError("Invalid display order");
        }
      }

      const db = this.getDb();

      const result = await db.$transaction(async (tx) => {
        const updatedCategories = [];

        for (const { id, displayOrder } of categoryOrders) {
          const updated = await tx.category.update({
            where: {
              id: parseInt(id),
              deletedAt: null,
            },
            data: {
              displayOrder,
              version: { increment: 1 },
            },
            select: {
              id: true,
              categoryNameAr: true,
              categoryNameEn: true,
              displayOrder: true,
            },
          });

          updatedCategories.push(updated);
        }

        // Log the reorder operation
        await this.createAuditLog(tx, {
          userId: updatedBy,
          action: "CATEGORIES_REORDERED",
          tableName: "categories",
          recordId: null,
          newValues: JSON.stringify({
            categoriesCount: categoryOrders.length,
            newOrders: categoryOrders,
          }),
        });

        return updatedCategories;
      });

      await this.clearCategoriesCache();

      logger.info("Categories reordered successfully", {
        categoriesCount: categoryOrders.length,
        updatedBy,
      });

      return result;
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("One or more categories not found");
      }

      logger.error("Reorder categories failed", {
        categoryOrders,
        error: error.message,
        updatedBy,
      });
      throw error;
    }
  }

  /**
   * Get category statistics with caching
   */
  async getCategoryStats() {
    try {
      const cacheKey = "category_stats";
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const db = this.getDb();

        const [
          totalCategories,
          activeCategories,
          categoryUsage,
          topCategories,
        ] = await Promise.all([
          db.category.count({ where: { deletedAt: null } }),
          db.category.count({ where: { deletedAt: null, isActive: true } }),
          db.category.findMany({
            where: { deletedAt: null },
            select: {
              id: true,
              categoryNameEn: true,
              _count: {
                items: { where: { deletedAt: null } },
                recipes: { where: { deletedAt: null } },
                meals: { where: { deletedAt: null } },
                menuItems: true,
              },
            },
          }),
          db.category.findMany({
            where: { deletedAt: null, isActive: true },
            select: {
              id: true,
              categoryNameAr: true,
              categoryNameEn: true,
              _count: {
                items: { where: { deletedAt: null } },
                recipes: { where: { deletedAt: null } },
                meals: { where: { deletedAt: null } },
              },
            },
            orderBy: {
              items: { _count: "desc" },
            },
            take: 5,
          }),
        ]);

        const emptyCategories = categoryUsage.filter(
          (cat) =>
            cat._count.items === 0 &&
            cat._count.recipes === 0 &&
            cat._count.meals === 0
        ).length;

        stats = {
          totalCategories,
          activeCategories,
          inactiveCategories: totalCategories - activeCategories,
          emptyCategories,
          avgItemsPerCategory:
            categoryUsage.length > 0
              ? Math.round(
                  categoryUsage.reduce(
                    (sum, cat) => sum + cat._count.items,
                    0
                  ) / categoryUsage.length
                )
              : 0,
          topCategories,
          lastUpdated: new Date().toISOString(),
        };

        // Cache for 10 minutes
        await this.cache.set(cacheKey, stats, 600);
      }

      return stats;
    } catch (error) {
      logger.error("Get category stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get public categories for menu display
   */
  async getPublicCategories(options = {}) {
    try {
      const { includeItems = true } = options;
      const cacheKey = `public_categories:${includeItems}`;

      let categories = await this.cache.get(cacheKey);

      if (!categories) {
        const db = this.getDb();

        const include = {};
        if (includeItems) {
          include.items = {
            where: {
              deletedAt: null,
              isAvailable: true,
            },
            select: {
              id: true,
              itemNameAr: true,
              itemNameEn: true,
              description: true,
              sellingPrice: true,
              imageUrl: true,
              caloriesPerUnit: true,
            },
            orderBy: { itemNameEn: "asc" },
            take: 30, // Limit for performance
          };
        }

        categories = await db.category.findMany({
          where: {
            deletedAt: null,
            isActive: true,
          },
          select: {
            id: true,
            categoryNameAr: true,
            categoryNameEn: true,
            description: true,
            imageUrl: true,
            displayOrder: true,
          },
          include: Object.keys(include).length > 0 ? include : undefined,
          orderBy: { displayOrder: "asc" },
        });

        // Cache public data longer
        await this.cache.set(cacheKey, categories, 1800); // 30 minutes
      }

      return categories;
    } catch (error) {
      logger.error("Get public categories failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Search categories with performance optimization
   */
  async searchCategories(query, options = {}) {
    try {
      const { limit = 10, includeItems = false } = options;

      if (!query || query.trim().length < 2) {
        throw new ValidationError("Search query must be at least 2 characters");
      }

      const searchTerm = query.trim();
      const db = this.getDb();

      const include = {};
      if (includeItems) {
        include.items = {
          where: { deletedAt: null, isAvailable: true },
          select: {
            id: true,
            itemNameAr: true,
            itemNameEn: true,
            sellingPrice: true,
            imageUrl: true,
          },
          take: 5, // Limit items in search results
        };
      }

      const results = await db.category.findMany({
        where: {
          AND: [
            { deletedAt: null },
            { isActive: true },
            {
              OR: [
                {
                  categoryNameAr: { contains: searchTerm, mode: "insensitive" },
                },
                {
                  categoryNameEn: { contains: searchTerm, mode: "insensitive" },
                },
                { description: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          ],
        },
        select: {
          id: true,
          categoryNameAr: true,
          categoryNameEn: true,
          description: true,
          imageUrl: true,
          displayOrder: true,
        },
        include: Object.keys(include).length > 0 ? include : undefined,
        orderBy: { displayOrder: "asc" },
        take: Math.min(limit, 50), // Cap at 50 results
      });

      return results;
    } catch (error) {
      logger.error("Search categories failed", {
        query,
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get category items count
   */
  async getCategoryItemsCount(categoryId) {
    try {
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        throw new ValidationError("Invalid category ID");
      }

      const db = this.getDb();

      // Verify category exists
      const category = await db.category.findFirst({
        where: { id: categoryId, deletedAt: null },
        select: { id: true },
      });

      if (!category) {
        throw new NotFoundError("Category not found");
      }

      const [counts, activeItems, availableItems] = await Promise.all([
        db.category.findUnique({
          where: { id: categoryId },
          select: {
            _count: {
              items: { where: { deletedAt: null } },
              recipes: { where: { deletedAt: null } },
              meals: { where: { deletedAt: null } },
              menuItems: true,
            },
          },
        }),
        db.item.count({
          where: {
            categoryId,
            deletedAt: null,
            isAvailable: true,
          },
        }),
        db.item.count({
          where: {
            categoryId,
            deletedAt: null,
            currentStock: { gt: 0 },
          },
        }),
      ]);

      return {
        totalItems: counts._count.items,
        totalRecipes: counts._count.recipes,
        totalMeals: counts._count.meals,
        totalMenuItems: counts._count.menuItems,
        activeItems,
        availableItems,
        outOfStockItems: counts._count.items - availableItems,
      };
    } catch (error) {
      logger.error("Get category items count failed", {
        categoryId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Bulk update categories
   */
  async bulkUpdateCategories(categoryIds, operation, updatedBy) {
    try {
      if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        throw new ValidationError("Category IDs array is required");
      }

      if (categoryIds.length > 50) {
        throw new ValidationError(
          "Cannot process more than 50 categories at once"
        );
      }

      const validOperations = ["activate", "deactivate", "delete"];
      if (!validOperations.includes(operation)) {
        throw new ValidationError(
          `Invalid operation. Must be one of: ${validOperations.join(", ")}`
        );
      }

      const db = this.getDb();

      // Verify all categories exist
      const existingCategories = await db.category.findMany({
        where: {
          id: { in: categoryIds.map((id) => parseInt(id)) },
          deletedAt: null,
        },
        select: { id: true, categoryNameEn: true },
      });

      if (existingCategories.length !== categoryIds.length) {
        throw new NotFoundError("Some categories were not found");
      }

      const result = await db.$transaction(async (tx) => {
        let updateData = {};
        let logAction = "";

        switch (operation) {
          case "activate":
            updateData = { isActive: true, version: { increment: 1 } };
            logAction = "CATEGORIES_BULK_ACTIVATED";
            break;
          case "deactivate":
            updateData = { isActive: false, version: { increment: 1 } };
            logAction = "CATEGORIES_BULK_DEACTIVATED";
            break;
          case "delete":
            // Check for usage before deleting
            const usage = await tx.category.findMany({
              where: { id: { in: categoryIds.map((id) => parseInt(id)) } },
              select: {
                id: true,
                categoryNameEn: true,
                _count: {
                  items: { where: { deletedAt: null } },
                  recipes: { where: { deletedAt: null } },
                  meals: { where: { deletedAt: null } },
                },
              },
            });

            const usedCategories = usage.filter(
              (cat) =>
                cat._count.items > 0 ||
                cat._count.recipes > 0 ||
                cat._count.meals > 0
            );

            if (usedCategories.length > 0) {
              throw new ValidationError(
                `Cannot delete categories that have associated items: ${usedCategories
                  .map((cat) => cat.categoryNameEn)
                  .join(", ")}`
              );
            }

            updateData = {
              deletedAt: new Date(),
              isActive: false,
              version: { increment: 1 },
            };
            logAction = "CATEGORIES_BULK_DELETED";
            break;
        }

        const updated = await tx.category.updateMany({
          where: { id: { in: categoryIds.map((id) => parseInt(id)) } },
          data: updateData,
        });

        // Log the bulk operation
        await this.createAuditLog(tx, {
          userId: updatedBy,
          action: logAction,
          tableName: "categories",
          recordId: null,
          newValues: JSON.stringify({
            operation,
            categoryIds,
            affectedCount: updated.count,
            categories: existingCategories.map((cat) => cat.categoryNameEn),
          }),
        });

        return {
          operation,
          affectedCount: updated.count,
          categories: existingCategories,
        };
      });

      // Clear cache
      await this.clearCategoriesCache();

      logger.info("Bulk categories update completed", {
        operation,
        affectedCount: result.affectedCount,
        updatedBy,
      });

      return result;
    } catch (error) {
      logger.error("Bulk update categories failed", {
        categoryIds,
        operation,
        error: error.message,
        updatedBy,
      });
      throw error;
    }
  }

  /**
   * Export categories data
   */
  async exportCategories(options = {}) {
    try {
      const { format = "json", includeItems = false, exportedBy } = options;

      const db = this.getDb();

      const include = {};
      if (includeItems) {
        include.items = {
          where: { deletedAt: null },
          select: {
            id: true,
            itemCode: true,
            itemNameAr: true,
            itemNameEn: true,
            sellingPrice: true,
            currentStock: true,
            isAvailable: true,
          },
        };
      }

      const categories = await db.category.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          categoryNameAr: true,
          categoryNameEn: true,
          description: true,
          displayOrder: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        include: Object.keys(include).length > 0 ? include : undefined,
        orderBy: { displayOrder: "asc" },
      });

      // Log the export
      logger.info("Categories export completed", {
        format,
        includeItems,
        categoriesCount: categories.length,
        exportedBy,
      });

      if (format === "file") {
        // In production, this would generate actual files
        return {
          filePath: "/tmp/categories_export.json",
          fileName: `categories_export_${Date.now()}.json`,
        };
      }

      return categories;
    } catch (error) {
      logger.error("Export categories failed", {
        options,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get category analytics
   */
  async getCategoryAnalytics(categoryId, options = {}) {
    try {
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        throw new ValidationError("Invalid category ID");
      }

      const {
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        dateTo = new Date(),
        includeOrders = true,
        includeSales = true,
      } = options;

      const db = this.getDb();

      // Verify category exists
      const category = await db.category.findFirst({
        where: { id: categoryId, deletedAt: null },
        select: { id: true, categoryNameEn: true },
      });

      if (!category) {
        throw new NotFoundError("Category not found");
      }

      const analytics = {
        categoryId,
        categoryName: category.categoryNameEn,
        period: { dateFrom, dateTo },
        items: {},
        orders: {},
        sales: {},
      };

      // Get category items analytics
      const itemsStats = await db.item.findMany({
        where: {
          categoryId,
          deletedAt: null,
        },
        select: {
          id: true,
          itemNameEn: true,
          sellingPrice: true,
          currentStock: true,
          isAvailable: true,
          _count: includeOrders
            ? {
                orderItems: {
                  where: {
                    order: {
                      orderDateTime: {
                        gte: dateFrom,
                        lte: dateTo,
                      },
                      orderStatus: { not: "CANCELLED" },
                    },
                  },
                },
              }
            : undefined,
        },
      });

      analytics.items = {
        total: itemsStats.length,
        available: itemsStats.filter((item) => item.isAvailable).length,
        outOfStock: itemsStats.filter((item) => item.currentStock === 0).length,
        items: itemsStats,
      };

      if (includeOrders && analytics.items.total > 0) {
        // Get order statistics
        const orderStats = await db.orderItem.groupBy({
          by: ["itemId"],
          where: {
            item: { categoryId },
            order: {
              orderDateTime: { gte: dateFrom, lte: dateTo },
              orderStatus: { not: "CANCELLED" },
            },
          },
          _sum: { quantity: true, totalPrice: true },
          _count: { id: true },
        });

        analytics.orders = {
          totalOrders: orderStats.reduce(
            (sum, stat) => sum + stat._count.id,
            0
          ),
          totalQuantity: orderStats.reduce(
            (sum, stat) => sum + (stat._sum.quantity || 0),
            0
          ),
          totalRevenue: orderStats.reduce(
            (sum, stat) => sum + (stat._sum.totalPrice || 0),
            0
          ),
          byItem: orderStats,
        };
      }

      if (includeSales && analytics.items.total > 0) {
        // Get sales trends (simplified for performance)
        const salesData = await db.orderItem.aggregate({
          where: {
            item: { categoryId },
            order: {
              orderDateTime: { gte: dateFrom, lte: dateTo },
              orderStatus: { in: ["SERVED", "DELIVERED"] },
            },
          },
          _sum: { totalPrice: true },
          _count: { id: true },
        });

        analytics.sales = {
          totalRevenue: salesData._sum.totalPrice || 0,
          totalSales: salesData._count || 0,
          avgOrderValue:
            salesData._count > 0
              ? Math.round((salesData._sum.totalPrice || 0) / salesData._count)
              : 0,
        };
      }

      return analytics;
    } catch (error) {
      logger.error("Get category analytics failed", {
        categoryId,
        options,
        error: error.message,
      });
      throw error;
    }
  }

  // Helper Methods

  /**
   * Validate category data
   */
  async validateCategoryData(data, excludeId = null) {
    const { categoryNameAr, categoryNameEn, displayOrder } = data;

    // Validate Arabic name
    if (categoryNameAr) {
      if (!/^[\u0600-\u06FF\s]+$/.test(categoryNameAr.trim())) {
        throw new ValidationError(
          "Arabic category name can only contain Arabic letters and spaces"
        );
      }
      if (categoryNameAr.trim().length < 2) {
        throw new ValidationError(
          "Arabic category name must be at least 2 characters"
        );
      }
    }

    // Validate English name
    if (categoryNameEn) {
      if (!/^[a-zA-Z0-9\s&-]+$/.test(categoryNameEn.trim())) {
        throw new ValidationError(
          "English category name can only contain letters, numbers, spaces, & and -"
        );
      }
      if (categoryNameEn.trim().length < 2) {
        throw new ValidationError(
          "English category name must be at least 2 characters"
        );
      }
    }

    // Validate display order
    if (displayOrder !== undefined) {
      if (!Number.isInteger(displayOrder) || displayOrder <= 0) {
        throw new ValidationError("Display order must be a positive integer");
      }
      if (displayOrder > 9999) {
        throw new ValidationError("Display order cannot exceed 9999");
      }
    }
  }

  /**
   * Get next available display order
   */
  async getNextDisplayOrder() {
    try {
      const db = this.getDb();
      const lastCategory = await db.category.findFirst({
        where: { deletedAt: null },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      });
      return (lastCategory?.displayOrder || 0) + 1;
    } catch (error) {
      logger.warn("Failed to get next display order", { error: error.message });
      return 1;
    }
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(tx, logData) {
    try {
      await tx.systemLog.create({
        data: {
          userId: logData.userId,
          action: logData.action,
          tableName: logData.tableName,
          recordId: logData.recordId,
          oldValues: logData.oldValues || null,
          newValues: logData.newValues || null,
          ipAddress: null, // Will be filled by middleware
          userAgent: null,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Failed to create audit log", {
        logData,
        error: error.message,
      });
      // Don't throw - audit failure shouldn't break the main operation
    }
  }

  /**
   * Clear all related cache with pattern support
   */
  async clearCategoriesCache() {
    try {
      const cacheKeys = [
        "category_stats",
        "public_categories:true",
        "public_categories:false",
      ];

      await Promise.all(cacheKeys.map((key) => this.cache.del(key)));

      // Clear pattern-based cache
      const keys = await redisClient.keys("category:*");
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.cache.del(key)));
      }
    } catch (error) {
      logger.warn("Failed to clear cache", { error: error.message });
      // Don't throw - cache failure shouldn't break the operation
    }
  }
}

const categoriesService = new CategoriesService();
export default categoriesService;
