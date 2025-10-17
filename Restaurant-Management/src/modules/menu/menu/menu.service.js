import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../../middleware/errorHandler.js";

/**
 * Menu Service
 * Manages restaurant menus and menu items
 */
class MenuService {
  constructor() {
    this.cache = redisClient.cache(3600); // 1 hour cache
  }

  getDb() {
    try {
      return getDatabaseClient();
    } catch (error) {
      logger.error("Failed to get database client", {
        error: error.message,
        service: "MenuService",
      });
      throw new AppError("Database connection failed", 503);
    }
  }

  /**
   * Get all menus with pagination and filtering
   */
  async getAllMenus(options = {}) {
    try {
      const db = this.getDb();
      const {
        page = 1,
        limit = 20,
        search,
        isActive,
        includeItems = false,
        sortBy = "displayOrder",
        sortOrder = "asc",
      } = options;

      const skip = (page - 1) * limit;
      const where = {};

      if (search) {
        where.OR = [
          { menuNameAr: { contains: search, mode: "insensitive" } },
          { menuNameEn: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      if (typeof isActive === "boolean") {
        where.isActive = isActive;
      }

      // Check if menu is currently active based on dates
      if (options.currentOnly) {
        const now = new Date();
        where.AND = [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ];
      }

      const include = {
        _count: {
          select: {
            menuItems: true,
          },
        },
      };

      if (includeItems) {
        include.menuItems = {
          where: { isAvailable: true },
          include: {
            category: {
              select: {
                id: true,
                categoryNameAr: true,
                categoryNameEn: true,
              },
            },
            item: {
              select: {
                id: true,
                itemNameAr: true,
                itemNameEn: true,
                sellingPrice: true,
                imageUrl: true,
                isAvailable: true,
              },
            },
            recipe: {
              select: {
                id: true,
                recipeNameAr: true,
                recipeNameEn: true,
                sellingPrice: true,
                imageUrl: true,
                isAvailable: true,
              },
            },
            meal: {
              select: {
                id: true,
                mealNameAr: true,
                mealNameEn: true,
                sellingPrice: true,
                imageUrl: true,
                isAvailable: true,
              },
            },
          },
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        };
      }

      const [menus, total] = await Promise.all([
        db.menu.findMany({
          where,
          skip,
          take: limit,
          include,
          orderBy: { [sortBy]: sortOrder },
        }),
        db.menu.count({ where }),
      ]);

      // Add computed fields
      const menusWithStats = menus.map((menu) => ({
        ...menu,
        itemCount: menu._count.menuItems,
        isCurrentlyActive: this.isMenuCurrentlyActive(menu),
        status: this.getMenuStatus(menu),
      }));

      logger.info("Menus retrieved successfully", {
        total,
        returned: menus.length,
        filters: { search, isActive, includeItems },
      });

      return {
        menus: menusWithStats,
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
      logger.error("Get all menus failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get menu by ID with full details
   */
  async getMenuById(menuId, includeItems = false) {
    try {
      const db = this.getDb();
      const cacheKey = `menu:${menuId}:${includeItems}`;

      let menu = await this.cache.get(cacheKey);

      if (!menu) {
        const include = {
          _count: {
            select: {
              menuItems: true,
            },
          },
        };

        if (includeItems) {
          include.menuItems = {
            include: {
              category: {
                select: {
                  id: true,
                  categoryNameAr: true,
                  categoryNameEn: true,
                  displayOrder: true,
                },
              },
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  itemNameAr: true,
                  itemNameEn: true,
                  description: true,
                  sellingPrice: true,
                  imageUrl: true,
                  isAvailable: true,
                  caloriesPerUnit: true,
                },
              },
              recipe: {
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
              },
              meal: {
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
              },
            },
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          };
        }

        menu = await db.menu.findUnique({
          where: { id: menuId },
          include,
        });

        if (!menu) {
          throw new NotFoundError("Menu");
        }

        // Add computed fields
        menu.itemCount = menu._count.menuItems;
        menu.isCurrentlyActive = this.isMenuCurrentlyActive(menu);
        menu.status = this.getMenuStatus(menu);

        if (includeItems) {
          // Group items by category
          menu.categorizedItems = this.groupMenuItemsByCategory(menu.menuItems);

          // Calculate menu statistics
          menu.stats = this.calculateMenuStats(menu.menuItems);
        }

        await this.cache.set(cacheKey, menu, 1800); // 30 minutes cache
      }

      return menu;
    } catch (error) {
      logger.error("Get menu by ID failed", {
        menuId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new menu
   */
  async createMenu(menuData, createdBy) {
    try {
      const db = this.getDb();

      // Check for duplicate menu names
      const existingMenu = await db.menu.findFirst({
        where: {
          OR: [
            { menuNameAr: menuData.menuNameAr },
            { menuNameEn: menuData.menuNameEn },
          ],
          deletedAt: null,
        },
      });

      if (existingMenu) {
        throw new ConflictError("Menu name already exists");
      }

      // Validate date range
      if (menuData.startDate && menuData.endDate) {
        if (new Date(menuData.startDate) >= new Date(menuData.endDate)) {
          throw new AppError("End date must be after start date", 400);
        }
      }

      const menu = await db.menu.create({
        data: {
          ...menuData,
          startDate: menuData.startDate ? new Date(menuData.startDate) : null,
          endDate: menuData.endDate ? new Date(menuData.endDate) : null,
        },
      });

      // Clear caches
      await this.invalidateMenuCaches();

      logger.info("Menu created successfully", {
        menuId: menu.id,
        menuNameEn: menu.menuNameEn,
        createdBy: createdBy?.id || "system",
      });

      return await this.getMenuById(menu.id);
    } catch (error) {
      logger.error("Create menu failed", {
        menuNameEn: menuData.menuNameEn,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update menu
   */
  async updateMenu(menuId, updateData, updatedBy) {
    try {
      const db = this.getDb();

      const existingMenu = await db.menu.findUnique({
        where: { id: menuId },
      });

      if (!existingMenu) {
        throw new NotFoundError("Menu");
      }

      // Check for duplicate names if updating
      if (updateData.menuNameAr || updateData.menuNameEn) {
        const duplicateCheck = await db.menu.findFirst({
          where: {
            OR: [
              ...(updateData.menuNameAr
                ? [{ menuNameAr: updateData.menuNameAr }]
                : []),
              ...(updateData.menuNameEn
                ? [{ menuNameEn: updateData.menuNameEn }]
                : []),
            ],
            NOT: { id: menuId },
            deletedAt: null,
          },
        });

        if (duplicateCheck) {
          throw new ConflictError("Menu name already exists");
        }
      }

      // Validate date range if both dates are provided
      if (
        updateData.startDate !== undefined &&
        updateData.endDate !== undefined
      ) {
        const startDate = updateData.startDate || existingMenu.startDate;
        const endDate = updateData.endDate || existingMenu.endDate;

        if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
          throw new AppError("End date must be after start date", 400);
        }
      }

      // Prepare update data
      const dataToUpdate = { ...updateData };
      if (updateData.startDate !== undefined) {
        dataToUpdate.startDate = updateData.startDate
          ? new Date(updateData.startDate)
          : null;
      }
      if (updateData.endDate !== undefined) {
        dataToUpdate.endDate = updateData.endDate
          ? new Date(updateData.endDate)
          : null;
      }

      const updatedMenu = await db.menu.update({
        where: { id: menuId },
        data: dataToUpdate,
      });

      // Clear caches
      await this.cache.del(`menu:${menuId}:true`);
      await this.cache.del(`menu:${menuId}:false`);
      await this.invalidateMenuCaches();

      logger.info("Menu updated successfully", {
        menuId,
        updatedBy: updatedBy?.id || "system",
        fields: Object.keys(updateData),
      });

      return await this.getMenuById(menuId);
    } catch (error) {
      logger.error("Update menu failed", {
        menuId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete menu (soft delete)
   */
  async deleteMenu(menuId, deletedBy) {
    try {
      const db = this.getDb();

      const menu = await db.menu.findUnique({
        where: { id: menuId },
        include: {
          _count: {
            select: {
              menuItems: true,
            },
          },
        },
      });

      if (!menu) {
        throw new NotFoundError("Menu");
      }

      // Soft delete menu and all its items
      await db.$transaction(async (tx) => {
        // Soft delete menu items first
        await tx.menuItem.updateMany({
          where: { menuId },
          data: { deletedAt: new Date() },
        });

        // Soft delete menu
        await tx.menu.update({
          where: { id: menuId },
          data: { deletedAt: new Date() },
        });
      });

      // Clear caches
      await this.cache.del(`menu:${menuId}:true`);
      await this.cache.del(`menu:${menuId}:false`);
      await this.invalidateMenuCaches();

      logger.info("Menu soft deleted", {
        menuId,
        menuNameEn: menu.menuNameEn,
        menuItemsCount: menu._count.menuItems,
        deletedBy: deletedBy?.id || "system",
      });
    } catch (error) {
      logger.error("Delete menu failed", {
        menuId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add item to menu
   */
  async addMenuItem(menuItemData, createdBy) {
    try {
      const db = this.getDb();

      // Validate menu exists and is active
      const menu = await db.menu.findUnique({
        where: { id: menuItemData.menuId, deletedAt: null },
      });

      if (!menu) {
        throw new NotFoundError("Menu");
      }

      // Validate that the referenced item/recipe/meal exists and is available
      await this.validateMenuItemReference(menuItemData);

      // Check for duplicates
      const existingItem = await this.checkMenuItemDuplicate(menuItemData);
      if (existingItem) {
        throw new ConflictError("Item already exists in this menu");
      }

      const menuItem = await db.menuItem.create({
        data: menuItemData,
        include: {
          category: {
            select: {
              id: true,
              categoryNameAr: true,
              categoryNameEn: true,
            },
          },
          item: {
            select: {
              id: true,
              itemNameAr: true,
              itemNameEn: true,
              sellingPrice: true,
              imageUrl: true,
            },
          },
          recipe: {
            select: {
              id: true,
              recipeNameAr: true,
              recipeNameEn: true,
              sellingPrice: true,
              imageUrl: true,
            },
          },
          meal: {
            select: {
              id: true,
              mealNameAr: true,
              mealNameEn: true,
              sellingPrice: true,
              imageUrl: true,
            },
          },
        },
      });

      // Clear caches
      await this.cache.del(`menu:${menuItemData.menuId}:true`);
      await this.cache.del(`menu:${menuItemData.menuId}:false`);
      await this.invalidateMenuCaches();

      logger.info("Menu item added successfully", {
        menuItemId: menuItem.id,
        menuId: menuItemData.menuId,
        createdBy: createdBy?.id || "system",
      });

      return menuItem;
    } catch (error) {
      logger.error("Add menu item failed", {
        menuItemData,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update menu item
   */
  async updateMenuItem(menuItemId, updateData, updatedBy) {
    try {
      const db = this.getDb();

      const existingMenuItem = await db.menuItem.findUnique({
        where: { id: menuItemId, deletedAt: null },
        include: { menu: true },
      });

      if (!existingMenuItem) {
        throw new NotFoundError("Menu item");
      }

      const updatedMenuItem = await db.menuItem.update({
        where: { id: menuItemId },
        data: updateData,
        include: {
          category: {
            select: {
              id: true,
              categoryNameAr: true,
              categoryNameEn: true,
            },
          },
          item: {
            select: {
              id: true,
              itemNameAr: true,
              itemNameEn: true,
              sellingPrice: true,
              imageUrl: true,
            },
          },
          recipe: {
            select: {
              id: true,
              recipeNameAr: true,
              recipeNameEn: true,
              sellingPrice: true,
              imageUrl: true,
            },
          },
          meal: {
            select: {
              id: true,
              mealNameAr: true,
              mealNameEn: true,
              sellingPrice: true,
              imageUrl: true,
            },
          },
        },
      });

      // Clear caches
      await this.cache.del(`menu:${existingMenuItem.menuId}:true`);
      await this.cache.del(`menu:${existingMenuItem.menuId}:false`);
      await this.invalidateMenuCaches();

      logger.info("Menu item updated successfully", {
        menuItemId,
        menuId: existingMenuItem.menuId,
        updatedBy: updatedBy?.id || "system",
        fields: Object.keys(updateData),
      });

      return updatedMenuItem;
    } catch (error) {
      logger.error("Update menu item failed", {
        menuItemId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove menu item
   */
  async removeMenuItem(menuItemId, deletedBy) {
    try {
      const db = this.getDb();

      const menuItem = await db.menuItem.findUnique({
        where: { id: menuItemId, deletedAt: null },
      });

      if (!menuItem) {
        throw new NotFoundError("Menu item");
      }

      await db.menuItem.update({
        where: { id: menuItemId },
        data: { deletedAt: new Date() },
      });

      // Clear caches
      await this.cache.del(`menu:${menuItem.menuId}:true`);
      await this.cache.del(`menu:${menuItem.menuId}:false`);
      await this.invalidateMenuCaches();

      logger.info("Menu item removed successfully", {
        menuItemId,
        menuId: menuItem.menuId,
        deletedBy: deletedBy?.id || "system",
      });
    } catch (error) {
      logger.error("Remove menu item failed", {
        menuItemId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active menus (for display)
   */
  async getActiveMenus() {
    try {
      const db = this.getDb();
      const cacheKey = "active_menus";

      let menus = await this.cache.get(cacheKey);

      if (!menus) {
        const now = new Date();

        menus = await db.menu.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            AND: [
              { OR: [{ startDate: null }, { startDate: { lte: now } }] },
              { OR: [{ endDate: null }, { endDate: { gte: now } }] },
            ],
          },
          select: {
            id: true,
            menuNameAr: true,
            menuNameEn: true,
            description: true,
            imageUrl: true,
            displayOrder: true,
            startDate: true,
            endDate: true,
          },
          orderBy: [{ displayOrder: "asc" }, { menuNameEn: "asc" }],
        });

        await this.cache.set(cacheKey, menus, 1800); // 30 minutes cache
      }

      return menus;
    } catch (error) {
      logger.error("Get active menus failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Bulk update menu items
   */
  async bulkUpdateMenuItems(menuItemIds, updates, updatedBy) {
    try {
      const db = this.getDb();
      const results = { updated: [], failed: [] };

      // Get all menu items to validate they exist
      const menuItems = await db.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
          deletedAt: null,
        },
        include: { menu: true },
      });

      const foundIds = menuItems.map((item) => item.id);
      const notFoundIds = menuItemIds.filter((id) => !foundIds.includes(id));

      // Add not found items to failed results
      notFoundIds.forEach((id) => {
        results.failed.push({
          id,
          success: false,
          error: "Menu item not found",
        });
      });

      // Update found items
      if (menuItems.length > 0) {
        try {
          await db.menuItem.updateMany({
            where: {
              id: { in: foundIds },
            },
            data: updates,
          });

          // Add successful updates to results
          menuItems.forEach((item) => {
            results.updated.push({
              id: item.id,
              success: true,
              menuId: item.menuId,
            });
          });

          // Clear caches for affected menus
          const uniqueMenuIds = [
            ...new Set(menuItems.map((item) => item.menuId)),
          ];
          await Promise.all(
            uniqueMenuIds.map((menuId) =>
              Promise.all([
                this.cache.del(`menu:${menuId}:true`),
                this.cache.del(`menu:${menuId}:false`),
              ])
            )
          );
          await this.invalidateMenuCaches();
        } catch (updateError) {
          // If bulk update fails, mark all as failed
          menuItems.forEach((item) => {
            results.failed.push({
              id: item.id,
              success: false,
              error: updateError.message,
            });
          });
        }
      }

      logger.info("Bulk menu items update completed", {
        totalRequested: menuItemIds.length,
        updated: results.updated.length,
        failed: results.failed.length,
        updatedBy: updatedBy?.id || "system",
      });

      return results;
    } catch (error) {
      logger.error("Bulk update menu items failed", {
        menuItemIds,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Reorder menu items
   */
  async reorderMenuItems(menuId, itemOrders, updatedBy) {
    try {
      const db = this.getDb();

      // Validate menu exists
      const menu = await db.menu.findUnique({
        where: { id: menuId, deletedAt: null },
      });

      if (!menu) {
        throw new NotFoundError("Menu");
      }

      // Validate all menu item IDs belong to this menu
      const menuItemIds = itemOrders.map((order) => order.menuItemId);
      const menuItems = await db.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
          menuId,
          deletedAt: null,
        },
      });

      if (menuItems.length !== menuItemIds.length) {
        throw new AppError("Some menu items do not belong to this menu", 400);
      }

      // Update display orders in transaction
      await db.$transaction(async (tx) => {
        for (const order of itemOrders) {
          await tx.menuItem.update({
            where: { id: order.menuItemId },
            data: { displayOrder: order.displayOrder },
          });
        }
      });

      // Clear caches
      await this.cache.del(`menu:${menuId}:true`);
      await this.cache.del(`menu:${menuId}:false`);
      await this.invalidateMenuCaches();

      logger.info("Menu items reordered successfully", {
        menuId,
        itemsReordered: itemOrders.length,
        updatedBy: updatedBy?.id || "system",
      });

      return { success: true, itemsReordered: itemOrders.length };
    } catch (error) {
      logger.error("Reorder menu items failed", {
        menuId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get menu statistics
   */
  async getMenuStats() {
    try {
      const db = this.getDb();
      const cacheKey = "menu_stats";

      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const [
          totalMenus,
          activeMenus,
          totalMenuItems,
          availableMenuItems,
          currentActiveMenus,
          categoryDistribution,
          popularItems,
        ] = await Promise.all([
          db.menu.count({ where: { deletedAt: null } }),
          db.menu.count({ where: { isActive: true, deletedAt: null } }),
          db.menuItem.count({ where: { deletedAt: null } }),
          db.menuItem.count({ where: { isAvailable: true, deletedAt: null } }),
          this.getCurrentActiveMenusCount(),
          this.getCategoryDistribution(),
          this.getPopularMenuItems(),
        ]);

        stats = {
          totalMenus,
          activeMenus,
          inactiveMenus: totalMenus - activeMenus,
          currentActiveMenus,
          totalMenuItems,
          availableMenuItems,
          unavailableMenuItems: totalMenuItems - availableMenuItems,
          avgItemsPerMenu:
            totalMenus > 0 ? (totalMenuItems / totalMenus).toFixed(2) : 0,
          categoryDistribution,
          popularItems,
          timestamp: new Date().toISOString(),
        };

        await this.cache.set(cacheKey, stats, 1800); // 30 minutes cache
      }

      return stats;
    } catch (error) {
      logger.error("Get menu stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get menu recommendations
   */
  async getMenuRecommendations() {
    try {
      const recommendations = [];
      const stats = await this.getMenuStats();

      // Low item count recommendation
      if (stats.avgItemsPerMenu < 5) {
        recommendations.push({
          type: "INCREASE_VARIETY",
          title: "Increase Menu Variety",
          message: `Average of ${stats.avgItemsPerMenu} items per menu is low. Consider adding more items to improve customer choice.`,
          priority: "HIGH",
        });
      }

      // Inactive items recommendation
      if (stats.unavailableMenuItems > stats.availableMenuItems * 0.2) {
        recommendations.push({
          type: "ACTIVATE_ITEMS",
          title: "Review Inactive Items",
          message: `${stats.unavailableMenuItems} menu items are inactive. Review and activate popular items.`,
          priority: "MEDIUM",
        });
      }

      // Seasonal menu recommendation
      const now = new Date();
      const hasSeasonalMenus = await this.checkSeasonalMenus();
      if (!hasSeasonalMenus) {
        recommendations.push({
          type: "SEASONAL_MENUS",
          title: "Create Seasonal Menus",
          message:
            "Consider creating seasonal menus to offer variety throughout the year.",
          priority: "LOW",
        });
      }

      return recommendations;
    } catch (error) {
      logger.error("Get menu recommendations failed", {
        error: error.message,
      });
      throw error;
    }
  }

  // Helper methods
  isMenuCurrentlyActive(menu) {
    if (!menu.isActive) return false;

    const now = new Date();

    if (menu.startDate && new Date(menu.startDate) > now) return false;
    if (menu.endDate && new Date(menu.endDate) < now) return false;

    return true;
  }

  getMenuStatus(menu) {
    if (!menu.isActive) return "INACTIVE";

    const now = new Date();

    if (menu.startDate && new Date(menu.startDate) > now) return "SCHEDULED";
    if (menu.endDate && new Date(menu.endDate) < now) return "EXPIRED";

    return "ACTIVE";
  }

  groupMenuItemsByCategory(menuItems) {
    const categorized = {};

    menuItems.forEach((item) => {
      const categoryId = item.categoryId || "uncategorized";
      const categoryName = item.category
        ? item.category.categoryNameEn || item.category.categoryNameAr
        : "Uncategorized";

      if (!categorized[categoryId]) {
        categorized[categoryId] = {
          category: item.category || {
            id: null,
            categoryNameEn: "Uncategorized",
            categoryNameAr: "غير مصنف",
          },
          items: [],
        };
      }

      categorized[categoryId].items.push(item);
    });

    return Object.values(categorized);
  }

  calculateMenuStats(menuItems) {
    const stats = {
      totalItems: menuItems.length,
      availableItems: menuItems.filter((item) => item.isAvailable).length,
      recommendedItems: menuItems.filter((item) => item.isRecommended).length,
      itemTypes: {
        items: menuItems.filter((item) => item.itemId).length,
        recipes: menuItems.filter((item) => item.recipeId).length,
        meals: menuItems.filter((item) => item.mealId).length,
      },
      priceRange: this.calculatePriceRange(menuItems),
    };

    stats.unavailableItems = stats.totalItems - stats.availableItems;
    stats.availabilityRate =
      stats.totalItems > 0
        ? ((stats.availableItems / stats.totalItems) * 100).toFixed(2)
        : 0;

    return stats;
  }

  calculatePriceRange(menuItems) {
    const prices = menuItems
      .map((item) => {
        if (item.specialPrice) return Number(item.specialPrice);
        if (item.item) return Number(item.item.sellingPrice);
        if (item.recipe) return Number(item.recipe.sellingPrice);
        if (item.meal) return Number(item.meal.sellingPrice);
        return 0;
      })
      .filter((price) => price > 0);

    if (prices.length === 0) return { min: 0, max: 0, avg: 0 };

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: (
        prices.reduce((sum, price) => sum + price, 0) / prices.length
      ).toFixed(2),
    };
  }

  async validateMenuItemReference(menuItemData) {
    const db = this.getDb();

    if (menuItemData.itemId) {
      const item = await db.item.findUnique({
        where: { id: menuItemData.itemId, isAvailable: true, deletedAt: null },
      });
      if (!item) throw new NotFoundError("Item");
    }

    if (menuItemData.recipeId) {
      const recipe = await db.recipe.findUnique({
        where: {
          id: menuItemData.recipeId,
          isAvailable: true,
          deletedAt: null,
        },
      });
      if (!recipe) throw new NotFoundError("Recipe");
    }

    if (menuItemData.mealId) {
      const meal = await db.meal.findUnique({
        where: { id: menuItemData.mealId, isAvailable: true, deletedAt: null },
      });
      if (!meal) throw new NotFoundError("Meal");
    }
  }

  async checkMenuItemDuplicate(menuItemData) {
    const db = this.getDb();

    const where = {
      menuId: menuItemData.menuId,
      deletedAt: null,
    };

    if (menuItemData.itemId) where.itemId = menuItemData.itemId;
    if (menuItemData.recipeId) where.recipeId = menuItemData.recipeId;
    if (menuItemData.mealId) where.mealId = menuItemData.mealId;

    return await db.menuItem.findFirst({ where });
  }

  async getCurrentActiveMenusCount() {
    const db = this.getDb();
    const now = new Date();

    return await db.menu.count({
      where: {
        isActive: true,
        deletedAt: null,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
    });
  }

  async getCategoryDistribution() {
    try {
      const db = this.getDb();

      const distribution = await db.menuItem.groupBy({
        by: ["categoryId"],
        _count: { categoryId: true },
        where: { deletedAt: null },
      });

      // Get category names
      const categoryIds = distribution
        .map((d) => d.categoryId)
        .filter((id) => id !== null);
      const categories = await db.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, categoryNameEn: true, categoryNameAr: true },
      });

      return distribution.map((d) => {
        const category = categories.find((c) => c.id === d.categoryId);
        return {
          categoryId: d.categoryId,
          categoryName: category ? category.categoryNameEn : "Uncategorized",
          count: d._count.categoryId,
        };
      });
    } catch (error) {
      logger.error("Get category distribution failed", {
        error: error.message,
      });
      return [];
    }
  }

  async getPopularMenuItems(limit = 10) {
    try {
      const db = this.getDb();

      // This would need order data to be truly accurate
      // For now, return recommended items
      const popularItems = await db.menuItem.findMany({
        where: {
          isRecommended: true,
          isAvailable: true,
          deletedAt: null,
        },
        include: {
          item: { select: { itemNameEn: true, sellingPrice: true } },
          recipe: { select: { recipeNameEn: true, sellingPrice: true } },
          meal: { select: { mealNameEn: true, sellingPrice: true } },
          menu: { select: { menuNameEn: true } },
        },
        take: limit,
      });

      return popularItems.map((item) => ({
        id: item.id,
        name:
          item.item?.itemNameEn ||
          item.recipe?.recipeNameEn ||
          item.meal?.mealNameEn,
        menuName: item.menu.menuNameEn,
        price:
          item.specialPrice ||
          item.item?.sellingPrice ||
          item.recipe?.sellingPrice ||
          item.meal?.sellingPrice,
        isRecommended: item.isRecommended,
      }));
    } catch (error) {
      logger.error("Get popular menu items failed", { error: error.message });
      return [];
    }
  }

  async checkSeasonalMenus() {
    try {
      const db = this.getDb();

      const seasonalMenus = await db.menu.count({
        where: {
          OR: [{ startDate: { not: null } }, { endDate: { not: null } }],
          deletedAt: null,
        },
      });

      return seasonalMenus > 0;
    } catch (error) {
      logger.error("Check seasonal menus failed", { error: error.message });
      return false;
    }
  }

  async invalidateMenuCaches() {
    try {
      const cacheKeys = ["active_menus", "menu_stats"];
      await Promise.all(cacheKeys.map((key) => this.cache.del(key)));
    } catch (error) {
      logger.warn("Cache invalidation failed", { error: error.message });
    }
  }
}

const menuService = new MenuService();
export default menuService;
