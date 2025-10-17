import menuService from "./menu.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";
import logger from "../../../utils/logger.js";

/**
 * Menu Controller
 * Handles menu management operations
 */
class MenuController {
  /**
   * Get all menus with pagination and filtering
   */
  getAllMenus = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      search: req.query.search,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      includeItems: req.query.includeItems === "true",
      currentOnly: req.query.currentOnly === "true",
      sortBy: req.query.sortBy || "displayOrder",
      sortOrder: req.query.sortOrder || "asc",
    };

    const result = await menuService.getAllMenus(options);
    return responseHandler.paginated(
      res,
      result.menus,
      result.pagination,
      "Menus retrieved successfully"
    );
  });

  /**
   * Get menu by ID
   */
  getMenuById = asyncHandler(async (req, res) => {
    const menuId = parseInt(req.params.id);
    if (isNaN(menuId)) {
      return responseHandler.error(res, "Invalid menu ID", 400);
    }

    const includeItems = req.query.includeItems === "true";
    const menu = await menuService.getMenuById(menuId, includeItems);

    return responseHandler.success(res, menu, "Menu retrieved successfully");
  });

  /**
   * Create new menu
   */
  createMenu = asyncHandler(async (req, res) => {
    const menu = await menuService.createMenu(req.body, req.user);
    return responseHandler.created(res, menu, "Menu created successfully");
  });

  /**
   * Update menu
   */
  updateMenu = asyncHandler(async (req, res) => {
    const menuId = parseInt(req.params.id);
    if (isNaN(menuId)) {
      return responseHandler.error(res, "Invalid menu ID", 400);
    }

    const menu = await menuService.updateMenu(menuId, req.body, req.user);
    return responseHandler.success(res, menu, "Menu updated successfully");
  });

  /**
   * Delete menu
   */
  deleteMenu = asyncHandler(async (req, res) => {
    const menuId = parseInt(req.params.id);
    if (isNaN(menuId)) {
      return responseHandler.error(res, "Invalid menu ID", 400);
    }

    await menuService.deleteMenu(menuId, req.user);
    return responseHandler.success(res, null, "Menu deleted successfully");
  });

  /**
   * Get active menus (for public display)
   */
  getActiveMenus = asyncHandler(async (req, res) => {
    const menus = await menuService.getActiveMenus();
    return responseHandler.success(
      res,
      menus,
      "Active menus retrieved successfully"
    );
  });

  /**
   * Add item to menu
   */
  addMenuItem = asyncHandler(async (req, res) => {
    const menuItem = await menuService.addMenuItem(req.body, req.user);
    return responseHandler.created(
      res,
      menuItem,
      "Menu item added successfully"
    );
  });

  /**
   * Update menu item
   */
  updateMenuItem = asyncHandler(async (req, res) => {
    const menuItemId = parseInt(req.params.menuItemId);
    if (isNaN(menuItemId)) {
      return responseHandler.error(res, "Invalid menu item ID", 400);
    }

    const menuItem = await menuService.updateMenuItem(
      menuItemId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      menuItem,
      "Menu item updated successfully"
    );
  });

  /**
   * Remove menu item
   */
  removeMenuItem = asyncHandler(async (req, res) => {
    const menuItemId = parseInt(req.params.menuItemId);
    if (isNaN(menuItemId)) {
      return responseHandler.error(res, "Invalid menu item ID", 400);
    }

    await menuService.removeMenuItem(menuItemId, req.user);
    return responseHandler.success(res, null, "Menu item removed successfully");
  });

  /**
   * Bulk update menu items
   */
  bulkUpdateMenuItems = asyncHandler(async (req, res) => {
    const { menuItemIds, updates } = req.body;

    const results = await menuService.bulkUpdateMenuItems(
      menuItemIds,
      updates,
      req.user
    );

    const message = `Bulk update completed: ${results.updated.length} updated, ${results.failed.length} failed`;

    if (results.failed.length === 0) {
      return responseHandler.success(res, results, message);
    } else {
      return responseHandler.success(res, results, message, 207); // Multi-status
    }
  });

  /**
   * Reorder menu items
   */
  reorderMenuItems = asyncHandler(async (req, res) => {
    const { menuId, itemOrders } = req.body;

    const result = await menuService.reorderMenuItems(
      menuId,
      itemOrders,
      req.user
    );
    return responseHandler.success(
      res,
      result,
      "Menu items reordered successfully"
    );
  });

  /**
   * Get menu statistics
   */
  getMenuStats = asyncHandler(async (req, res) => {
    const stats = await menuService.getMenuStats();
    return responseHandler.success(
      res,
      stats,
      "Menu statistics retrieved successfully"
    );
  });

  /**
   * Get menu recommendations
   */
  getMenuRecommendations = asyncHandler(async (req, res) => {
    const recommendations = await menuService.getMenuRecommendations();
    return responseHandler.success(
      res,
      {
        recommendations,
        count: recommendations.length,
        timestamp: new Date().toISOString(),
      },
      "Menu recommendations generated successfully"
    );
  });

  /**
   * Get menu analytics
   */
  getMenuAnalytics = asyncHandler(async (req, res) => {
    const { period = "month" } = req.query;

    // Validate period
    if (!["week", "month", "quarter", "year"].includes(period)) {
      return responseHandler.error(
        res,
        "Invalid period. Use: week, month, quarter, or year",
        400
      );
    }

    const [stats, recommendations] = await Promise.all([
      menuService.getMenuStats(),
      menuService.getMenuRecommendations(),
    ]);

    const analytics = {
      period,
      overview: {
        totalMenus: stats.totalMenus,
        activeMenus: stats.activeMenus,
        currentActiveMenus: stats.currentActiveMenus,
        totalMenuItems: stats.totalMenuItems,
        availableMenuItems: stats.availableMenuItems,
        avgItemsPerMenu: stats.avgItemsPerMenu,
      },
      distribution: {
        categories: stats.categoryDistribution,
        menuStatus: {
          active: stats.activeMenus,
          inactive: stats.inactiveMenus,
        },
        itemStatus: {
          available: stats.availableMenuItems,
          unavailable: stats.unavailableMenuItems,
        },
      },
      popular: {
        items: stats.popularItems,
      },
      recommendations,
      insights: this.generateMenuInsights(stats),
      timestamp: new Date().toISOString(),
    };

    return responseHandler.success(
      res,
      analytics,
      "Menu analytics retrieved successfully"
    );
  });

  /**
   * Copy menu
   */
  copyMenu = asyncHandler(async (req, res) => {
    const sourceMenuId = parseInt(req.params.id);
    if (isNaN(sourceMenuId)) {
      return responseHandler.error(res, "Invalid menu ID", 400);
    }

    const { menuNameAr, menuNameEn, copyItems = true } = req.body;

    if (!menuNameAr || !menuNameEn) {
      return responseHandler.error(
        res,
        "Menu names are required for copy",
        400
      );
    }

    // Get source menu
    const sourceMenu = await menuService.getMenuById(sourceMenuId, copyItems);

    // Create new menu data
    const newMenuData = {
      menuNameAr,
      menuNameEn,
      description: sourceMenu.description,
      imageUrl: sourceMenu.imageUrl,
      displayOrder: sourceMenu.displayOrder,
      isActive: false, // Start as inactive
    };

    // Create the new menu
    const newMenu = await menuService.createMenu(newMenuData, req.user);

    // Copy menu items if requested
    if (copyItems && sourceMenu.menuItems) {
      const copyPromises = sourceMenu.menuItems.map((item) => {
        const menuItemData = {
          menuId: newMenu.id,
          categoryId: item.categoryId,
          itemId: item.itemId,
          recipeId: item.recipeId,
          mealId: item.mealId,
          displayOrder: item.displayOrder,
          specialPrice: item.specialPrice,
          isAvailable: item.isAvailable,
          isRecommended: item.isRecommended,
        };
        return menuService.addMenuItem(menuItemData, req.user);
      });

      await Promise.all(copyPromises);
    }

    // Get the complete copied menu
    const copiedMenu = await menuService.getMenuById(newMenu.id, true);

    return responseHandler.created(res, copiedMenu, "Menu copied successfully");
  });

  /**
   * Get menu by date range
   */
  getMenusByDateRange = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return responseHandler.error(
        res,
        "Start date and end date are required",
        400
      );
    }

    const options = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
      includeItems: req.query.includeItems === "true",
    };

    const result = await menuService.getMenusByDateRange(options);
    return responseHandler.success(
      res,
      result,
      "Menus for date range retrieved successfully"
    );
  });

  /**
   * Generate menu insights
   */
  generateMenuInsights(stats) {
    const insights = [];

    // Low variety insight
    if (stats.avgItemsPerMenu < 5) {
      insights.push({
        type: "LOW_VARIETY",
        title: "Low Menu Variety",
        message: `Average of ${stats.avgItemsPerMenu} items per menu. Consider adding more variety.`,
        severity: "WARNING",
        actionRequired: true,
      });
    }

    // High unavailability insight
    const unavailabilityRate =
      stats.totalMenuItems > 0
        ? (stats.unavailableMenuItems / stats.totalMenuItems) * 100
        : 0;

    if (unavailabilityRate > 20) {
      insights.push({
        type: "HIGH_UNAVAILABILITY",
        title: "High Item Unavailability",
        message: `${unavailabilityRate.toFixed(
          1
        )}% of menu items are unavailable. Review and activate items.`,
        severity: "ERROR",
        actionRequired: true,
      });
    }

    // Inactive menus insight
    if (stats.inactiveMenus > stats.activeMenus) {
      insights.push({
        type: "INACTIVE_MENUS",
        title: "Many Inactive Menus",
        message: `${stats.inactiveMenus} inactive menus vs ${stats.activeMenus} active. Consider activating or removing unused menus.`,
        severity: "INFO",
        actionRequired: false,
      });
    }

    // Good performance insight
    if (stats.avgItemsPerMenu >= 8 && unavailabilityRate < 10) {
      insights.push({
        type: "GOOD_PERFORMANCE",
        title: "Well-Managed Menus",
        message:
          "Good menu variety and item availability. Keep up the good work!",
        severity: "SUCCESS",
        actionRequired: false,
      });
    }

    return insights;
  }
}

const menuController = new MenuController();
export default menuController;
