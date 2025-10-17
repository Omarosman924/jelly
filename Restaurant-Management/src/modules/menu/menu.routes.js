import express from "express";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

// Import all menu sub-routes
import recipesRoutes from "./recipes/recipes.routes.js";
import mealsRoutes from "./meals/meals.routes.js";
import cookingMethodsRoutes from "./cooking-methods/cookingMethods.routes.js";
import menusRoutes from "./menu/menu.routes.js"; // الـ module الجديد
// import offersRoutes from "./offers/offers.routes.js"; // Will be available when offers module is complete

// Import services for dashboard
import recipesService from "./recipes/recipes.service.js";
import mealsService from "./meals/meals.service.js";
import cookingMethodsService from "./cooking-methods/cookingMethods.service.js";
import menuService from "./menu/menu.service.js"; // الـ service الجديد
// import offersService from "./offers/offers.service.js"; // Will be available when offers module is complete

import logger from "../../utils/logger.js";

const router = express.Router();

/**
 * Main Menu Module Routes V2
 * Combines all menu-related functionality
 */

// Apply authentication to all menu routes
router.use(authMiddleware);

// Mount sub-routes
router.use("/recipes", recipesRoutes);
router.use("/meals", mealsRoutes);
router.use("/cooking-methods", cookingMethodsRoutes);
router.use("/menus", menusRoutes); // الـ routes الجديدة
// router.use("/offers", offersRoutes);

// Main menu dashboard endpoint
router.get(
  "/dashboard",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  asyncHandler(async (req, res) => {
    try {
      // Aggregate data from all menu services
      const [
        recipeStats,
        mealStats,
        cookingMethodStats,
        menuStats,
        availableRecipes,
        availableMeals,
        activeMenus,
        popularMethods,
      ] = await Promise.all([
        recipesService.getRecipeStats(),
        mealsService.getMealStats(),
        cookingMethodsService.getCookingMethodsStats(),
        menuService.getMenuDashboardData(),
        recipesService.getAllRecipes({
          isAvailable: true,
          limit: 5,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
        mealsService.getAllMeals({
          isAvailable: true,
          limit: 5,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
        menuService.getActiveMenus(),
        cookingMethodsService.getPopularMethods(30),
      ]);

      const dashboardData = {
        summary: {
          // Recipe Stats
          totalRecipes: recipeStats.totalRecipes,
          availableRecipes: recipeStats.availableRecipes,
          unavailableRecipes: recipeStats.unavailableRecipes,
          avgRecipeCost: recipeStats.avgCost,
          avgRecipeProfitMargin: recipeStats.avgProfitMargin,

          // Meal Stats
          totalMeals: mealStats.totalMeals,
          availableMeals: mealStats.availableMeals,
          unavailableMeals: mealStats.unavailableMeals,
          avgMealPrice: mealStats.avgSellingPrice,
          avgMealProfitMargin: mealStats.avgProfitMargin,

          // Cooking Method Stats
          totalCookingMethods: cookingMethodStats.totalMethods,
          availableCookingMethods: cookingMethodStats.availableMethods,
          unavailableCookingMethods: cookingMethodStats.unavailableMethods,
          avgCookingTime: cookingMethodStats.avgCookingTime,
          avgAdditionalCost: cookingMethodStats.avgAdditionalCost,

          // Menu Stats
          totalMenus: menuStats.summary.totalMenus,
          activeMenus: menuStats.summary.activeMenus,
          currentActiveMenus: menuStats.summary.currentActiveMenus,
          totalMenuItems: menuStats.summary.totalMenuItems,
          availableMenuItems: menuStats.summary.availableMenuItems,
          avgItemsPerMenu: menuStats.summary.avgItemsPerMenu,

          // Overall Stats
          totalMenuElements:
            recipeStats.totalRecipes +
            mealStats.totalMeals +
            menuStats.summary.totalMenuItems,
          menuCompleteness: Math.round(
            ((recipeStats.availableRecipes +
              mealStats.availableMeals +
              menuStats.summary.availableMenuItems) /
              (recipeStats.totalRecipes +
                mealStats.totalMeals +
                menuStats.summary.totalMenuItems)) *
              100
          ),
          activeOffers: 0, // Will be updated when offers module is complete
        },

        alerts: [
          // Recipe Alerts
          ...(recipeStats.unavailableRecipes > 5
            ? [
                {
                  type: "UNAVAILABLE_RECIPES",
                  message: `${recipeStats.unavailableRecipes} recipes are currently unavailable`,
                  count: recipeStats.unavailableRecipes,
                  priority: "MEDIUM",
                  module: "recipes",
                },
              ]
            : []),

          // Meal Alerts
          ...(mealStats.unavailableMeals > 3
            ? [
                {
                  type: "UNAVAILABLE_MEALS",
                  message: `${mealStats.unavailableMeals} meals are currently unavailable`,
                  count: mealStats.unavailableMeals,
                  priority: "MEDIUM",
                  module: "meals",
                },
              ]
            : []),

          // Cooking Method Alerts
          ...(cookingMethodStats.unavailableMethods > 2
            ? [
                {
                  type: "UNAVAILABLE_METHODS",
                  message: `${cookingMethodStats.unavailableMethods} cooking methods are unavailable`,
                  count: cookingMethodStats.unavailableMethods,
                  priority: "LOW",
                  module: "cooking-methods",
                },
              ]
            : []),

          // Menu Alerts
          ...menuStats.alerts,

          // Low Stock Alerts (if applicable)
          ...(recipeStats.lowStockItems > 0
            ? [
                {
                  type: "LOW_STOCK_INGREDIENTS",
                  message: `${recipeStats.lowStockItems} recipe ingredients are running low`,
                  count: recipeStats.lowStockItems,
                  priority: "HIGH",
                  module: "inventory",
                },
              ]
            : []),
        ],

        recentActivity: [
          // Recent Recipes
          ...availableRecipes.recipes.slice(0, 3).map((recipe) => ({
            type: "NEW_RECIPE",
            message: `New recipe added: ${
              recipe.recipeNameEn || recipe.recipeNameAr
            }`,
            timestamp: recipe.createdAt,
            cost: recipe.totalCost,
            preparationTime: recipe.preparationTime,
            module: "recipes",
            id: recipe.id,
          })),

          // Recent Meals
          ...availableMeals.meals.slice(0, 3).map((meal) => ({
            type: "NEW_MEAL",
            message: `New meal added: ${meal.mealNameEn || meal.mealNameAr}`,
            timestamp: meal.createdAt,
            price: meal.sellingPrice,
            profitMargin: meal.profitMargin,
            module: "meals",
            id: meal.id,
          })),

          // Recent Menu Updates
          ...activeMenus.slice(0, 2).map((menu) => ({
            type: "MENU_ACTIVE",
            message: `Menu is active: ${menu.menuNameEn || menu.menuNameAr}`,
            timestamp: menu.updatedAt || menu.createdAt,
            module: "menus",
            id: menu.id,
          })),
        ]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 8),

        quickStats: {
          // Performance Indicators
          mostUsedCookingMethod:
            cookingMethodStats.mostUsedMethod?.methodNameEn || "None",
          topRecipeByMargin:
            recipeStats.topProfitRecipe?.recipeNameEn || "None",
          topMealByMargin: mealStats.topProfitMeal?.mealNameEn || "None",
          mostActiveMenu: activeMenus[0]?.menuNameEn || "None",

          // Financial Metrics
          avgProfitMargin: `${
            (recipeStats.avgProfitMargin + mealStats.avgProfitMargin) / 2 || 0
          }%`,
          totalMenuValue: recipeStats.totalValue + mealStats.totalValue || 0,

          // Operational Metrics
          avgPreparationTime:
            Math.round(
              (recipeStats.avgPreparationTime * recipeStats.totalRecipes +
                mealStats.avgPreparationTime * mealStats.totalMeals) /
                (recipeStats.totalRecipes + mealStats.totalMeals)
            ) || 0,
          menuCompleteness:
            Math.round(
              ((recipeStats.availableRecipes + mealStats.availableMeals) /
                (recipeStats.totalRecipes + mealStats.totalMeals)) *
                100
            ) || 0,
        },

        popularItems: {
          cookingMethods: popularMethods.slice(0, 5).map((method) => ({
            id: method.id,
            name: method.methodNameEn || method.methodNameAr,
            usageCount: method.usageCount,
            additionalCost: method.additionalCost,
            cookingTime: method.cookingTime,
            totalRevenue: method.totalRevenue,
          })),

          recipes: availableRecipes.recipes
            .filter((r) => r.popularityScore > 0)
            .slice(0, 5)
            .map((recipe) => ({
              id: recipe.id,
              name: recipe.recipeNameEn || recipe.recipeNameAr,
              preparationTime: recipe.preparationTime,
              profitMargin: recipe.profitMargin,
              popularityScore: recipe.popularityScore,
            })),

          meals: availableMeals.meals
            .filter((m) => m.popularityScore > 0)
            .slice(0, 5)
            .map((meal) => ({
              id: meal.id,
              name: meal.mealNameEn || meal.mealNameAr,
              price: meal.sellingPrice,
              profitMargin: meal.profitMargin,
              popularityScore: meal.popularityScore,
            })),

          menus: activeMenus.slice(0, 3).map((menu) => ({
            id: menu.id,
            name: menu.menuNameEn || menu.menuNameAr,
            itemCount: menu.itemCount || 0,
            isCurrentlyActive: menu.isCurrentlyActive,
          })),
        },

        recommendations: [
          // Recipe Recommendations
          ...(recipeStats.avgProfitMargin < 50
            ? [
                {
                  type: "LOW_PROFIT_MARGIN",
                  title: "Review Recipe Pricing",
                  message:
                    "Average recipe profit margin is below 50%. Consider reviewing pricing strategy.",
                  priority: "MEDIUM",
                  module: "recipes",
                  action: "review_pricing",
                },
              ]
            : []),

          // Cooking Method Recommendations
          ...(cookingMethodStats.avgCookingTime > 30
            ? [
                {
                  type: "LONG_COOKING_TIME",
                  title: "Optimize Cooking Times",
                  message:
                    "Average cooking time is high. Consider faster preparation methods.",
                  priority: "LOW",
                  module: "cooking-methods",
                  action: "optimize_methods",
                },
              ]
            : []),

          // Meal Recommendations
          ...(mealStats.availableMeals < 10
            ? [
                {
                  type: "LIMITED_MEAL_OPTIONS",
                  title: "Expand Meal Options",
                  message:
                    "Consider adding more meal combinations to increase variety.",
                  priority: "MEDIUM",
                  module: "meals",
                  action: "add_meals",
                },
              ]
            : []),

          // Menu Recommendations
          ...menuStats.recommendations,

          // Seasonal Recommendations
          {
            type: "SEASONAL_UPDATE",
            title: "Seasonal Menu Update",
            message:
              "Consider updating menus with seasonal ingredients and dishes.",
            priority: "LOW",
            module: "menus",
            action: "seasonal_update",
          },
        ],

        moduleStatus: {
          recipes: {
            status: "ACTIVE",
            health: recipeStats.availableRecipes > 0 ? "HEALTHY" : "WARNING",
            lastUpdate: recipeStats.lastUpdated,
          },
          meals: {
            status: "ACTIVE",
            health: mealStats.availableMeals > 0 ? "HEALTHY" : "WARNING",
            lastUpdate: mealStats.lastUpdated,
          },
          cookingMethods: {
            status: "ACTIVE",
            health:
              cookingMethodStats.availableMethods > 0 ? "HEALTHY" : "WARNING",
            lastUpdate: cookingMethodStats.lastUpdated,
          },
          menus: {
            status: "ACTIVE",
            health:
              menuStats.summary.currentActiveMenus > 0 ? "HEALTHY" : "CRITICAL",
            lastUpdate: menuStats.timestamp,
          },
          offers: {
            status: "DEVELOPMENT",
            health: "PENDING",
            lastUpdate: null,
          },
        },

        timestamp: new Date().toISOString(),
      };

      return responseHandler.success(
        res,
        dashboardData,
        "Menu dashboard data retrieved successfully"
      );
    } catch (error) {
      logger.error("Menu dashboard failed", {
        error: error.message,
        userId: req.user?.id,
      });
      throw error;
    }
  })
);

// Menu overview endpoint for quick access
router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    try {
      const overview = {
        title: "Restaurant Menu Management System",
        version: "2.0",
        description: "Comprehensive menu management system for restaurants",

        modules: {
          recipes: {
            path: "/recipes",
            description:
              "Manage recipes and their ingredients with cost calculation",
            features: [
              "Recipe creation and management",
              "Ingredient tracking",
              "Cost calculation",
              "Preparation time management",
              "Nutritional information",
            ],
            status: "ACTIVE",
            endpoints: 15,
          },

          meals: {
            path: "/meals",
            description: "Manage complete meals combining recipes and items",
            features: [
              "Meal composition",
              "Recipe combinations",
              "Pricing strategies",
              "Preparation coordination",
              "Profit margin analysis",
            ],
            status: "ACTIVE",
            endpoints: 12,
          },

          cookingMethods: {
            path: "/cooking-methods",
            description: "Manage cooking methods and their costs/times",
            features: [
              "Method definitions",
              "Time calculations",
              "Cost implications",
              "Usage analytics",
              "Performance tracking",
            ],
            status: "ACTIVE",
            endpoints: 10,
          },

          menus: {
            path: "/menus",
            description: "Manage restaurant menus and menu item organization",
            features: [
              "Menu creation and management",
              "Item organization",
              "Category management",
              "Seasonal menus",
              "Menu analytics",
              "Bulk operations",
            ],
            status: "ACTIVE",
            endpoints: 18,
          },

          offers: {
            path: "/offers",
            description: "Manage special offers and promotions",
            features: [
              "Discount management",
              "Promotional campaigns",
              "Time-based offers",
              "Customer targeting",
              "Performance tracking",
            ],
            status: "DEVELOPMENT",
            endpoints: 0,
          },
        },

        permissions: {
          VIEW: {
            roles: ["ADMIN", "HALL_MANAGER", "KITCHEN", "CASHIER"],
            description: "View menu items, recipes, and basic information",
          },
          CREATE: {
            roles: ["ADMIN", "KITCHEN"],
            description: "Create new recipes, meals, and cooking methods",
          },
          UPDATE: {
            roles: ["ADMIN", "KITCHEN", "HALL_MANAGER"],
            description: "Update existing menu items and availability",
          },
          DELETE: {
            roles: ["ADMIN"],
            description: "Delete menu items (soft delete with validation)",
          },
          STATS: {
            roles: ["ADMIN", "HALL_MANAGER", "KITCHEN"],
            description: "Access analytics and performance statistics",
          },
          BULK_OPERATIONS: {
            roles: ["ADMIN", "HALL_MANAGER"],
            description: "Perform bulk updates and management operations",
          },
        },

        integrations: {
          inventory: "Real-time ingredient availability checking",
          orders: "Menu item selection and customization",
          kitchen: "Preparation time and method coordination",
          pricing: "Dynamic pricing and profit margin calculation",
          analytics: "Performance tracking and recommendation engine",
        },

        timestamp: new Date().toISOString(),
      };

      return responseHandler.success(
        res,
        overview,
        "Menu system overview retrieved successfully"
      );
    } catch (error) {
      logger.error("Menu overview failed", {
        error: error.message,
      });
      throw error;
    }
  })
);

// Quick access endpoint for order processing
router.get(
  "/quick-access",
  asyncHandler(async (req, res) => {
    try {
      const [
        availableRecipes,
        availableMeals,
        activeCookingMethods,
        activeMenus,
      ] = await Promise.all([
        recipesService.getAllRecipes({
          isAvailable: true,
          limit: 50,
          sortBy: "recipeNameEn",
          sortOrder: "asc",
        }),
        mealsService.getAllMeals({
          isAvailable: true,
          limit: 50,
          sortBy: "mealNameEn",
          sortOrder: "asc",
        }),
        cookingMethodsService.getActiveCookingMethods(),
        menuService.getActiveMenus(),
      ]);

      const quickMenu = {
        availableRecipes: availableRecipes.recipes
          .filter((recipe) => recipe.canPrepare !== false)
          .map((recipe) => ({
            id: recipe.id,
            code: recipe.recipeCode,
            nameEn: recipe.recipeNameEn,
            nameAr: recipe.recipeNameAr,
            sellingPrice: recipe.sellingPrice,
            preparationTime: recipe.preparationTime,
            profitMargin: recipe.profitMargin,
            imageUrl: recipe.imageUrl,
            category: recipe.category?.categoryNameEn,
          })),

        availableMeals: availableMeals.meals
          .filter((meal) => meal.canPrepare !== false)
          .map((meal) => ({
            id: meal.id,
            code: meal.mealCode,
            nameEn: meal.mealNameEn,
            nameAr: meal.mealNameAr,
            sellingPrice: meal.sellingPrice,
            preparationTime: meal.preparationTime,
            profitMargin: meal.profitMargin,
            imageUrl: meal.imageUrl,
            category: meal.category?.categoryNameEn,
          })),

        activeCookingMethods: activeCookingMethods.map((method) => ({
          id: method.id,
          nameEn: method.methodNameEn,
          nameAr: method.methodNameAr,
          additionalCost: method.additionalCost,
          cookingTime: method.cookingTime,
        })),

        activeMenus: activeMenus.map((menu) => ({
          id: menu.id,
          nameEn: menu.menuNameEn,
          nameAr: menu.menuNameAr,
          description: menu.description,
          imageUrl: menu.imageUrl,
          displayOrder: menu.displayOrder,
        })),

        currentOffers: [], // Will be populated when offers module is complete

        categories: await this.getMenuCategories(),

        summary: {
          totalAvailableRecipes: availableRecipes.recipes.filter(
            (r) => r.canPrepare !== false
          ).length,
          totalAvailableMeals: availableMeals.meals.filter(
            (m) => m.canPrepare !== false
          ).length,
          totalCookingMethods: activeCookingMethods.length,
          totalActiveMenus: activeMenus.length,
          totalOffers: 0,
          avgPreparationTime: this.calculateAvgPreparationTime(
            availableRecipes.recipes,
            availableMeals.meals
          ),
        },

        lastUpdated: new Date().toISOString(),
        cacheValid: true,
        timestamp: new Date().toISOString(),
      };

      return responseHandler.success(
        res,
        quickMenu,
        "Quick menu access data retrieved successfully"
      );
    } catch (error) {
      logger.error("Quick access failed", {
        error: error.message,
      });
      throw error;
    }
  })
);

// Get menu categories helper
async function getMenuCategories() {
  try {
    // This would typically come from a categories service
    // For now, return a placeholder structure
    return [
      { id: 1, nameEn: "Appetizers", nameAr: "المقبلات", displayOrder: 1 },
      {
        id: 2,
        nameEn: "Main Courses",
        nameAr: "الأطباق الرئيسية",
        displayOrder: 2,
      },
      { id: 3, nameEn: "Desserts", nameAr: "الحلويات", displayOrder: 3 },
      { id: 4, nameEn: "Beverages", nameAr: "المشروبات", displayOrder: 4 },
    ];
  } catch (error) {
    logger.error("Get menu categories failed", { error: error.message });
    return [];
  }
}

// Calculate average preparation time
function calculateAvgPreparationTime(recipes, meals) {
  try {
    const totalItems = recipes.length + meals.length;
    if (totalItems === 0) return 0;

    const totalTime =
      recipes.reduce((sum, recipe) => sum + (recipe.preparationTime || 0), 0) +
      meals.reduce((sum, meal) => sum + (meal.preparationTime || 0), 0);

    return Math.round(totalTime / totalItems);
  } catch (error) {
    logger.error("Calculate avg preparation time failed", {
      error: error.message,
    });
    return 0;
  }
}

// Search across all menu items
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    try {
      const { query, type, category, priceRange, available = true } = req.query;

      if (!query || query.length < 2) {
        return responseHandler.error(
          res,
          "Search query must be at least 2 characters",
          400
        );
      }

      const searchPromises = [];

      // Search recipes if not type-filtered or specifically requested
      if (!type || type === "recipes") {
        searchPromises.push(
          recipesService
            .getAllRecipes({
              search: query,
              isAvailable: available === "true",
              categoryId: category ? parseInt(category) : undefined,
              limit: 20,
            })
            .then((result) => ({
              type: "recipes",
              items: result.recipes,
              total: result.pagination.total,
            }))
        );
      }

      // Search meals
      if (!type || type === "meals") {
        searchPromises.push(
          mealsService
            .getAllMeals({
              search: query,
              isAvailable: available === "true",
              categoryId: category ? parseInt(category) : undefined,
              limit: 20,
            })
            .then((result) => ({
              type: "meals",
              items: result.meals,
              total: result.pagination.total,
            }))
        );
      }

      // Search cooking methods
      if (!type || type === "cooking-methods") {
        searchPromises.push(
          cookingMethodsService
            .getAllCookingMethods({
              search: query,
              isAvailable: available === "true",
              limit: 10,
            })
            .then((result) => ({
              type: "cooking-methods",
              items: result.cookingMethods,
              total: result.pagination.total,
            }))
        );
      }

      const searchResults = await Promise.all(searchPromises);

      // Apply price filtering if specified
      if (priceRange) {
        const [minPrice, maxPrice] = priceRange
          .split("-")
          .map((p) => parseFloat(p));
        searchResults.forEach((result) => {
          result.items = result.items.filter((item) => {
            const price = item.sellingPrice || item.totalCost || 0;
            return price >= minPrice && price <= maxPrice;
          });
          result.total = result.items.length;
        });
      }

      const response = {
        query,
        filters: { type, category, priceRange, available },
        results: searchResults,
        totalResults: searchResults.reduce(
          (sum, result) => sum + result.total,
          0
        ),
        timestamp: new Date().toISOString(),
      };

      return responseHandler.success(
        res,
        response,
        "Search completed successfully"
      );
    } catch (error) {
      logger.error("Menu search failed", {
        error: error.message,
        query: req.query,
      });
      throw error;
    }
  })
);

// Health check for menu module
router.get(
  "/health",
  asyncHandler(async (req, res) => {
    try {
      const healthChecks = await Promise.allSettled([
        recipesService
          .getRecipeStats()
          .then(() => ({ module: "recipes", status: "HEALTHY" })),
        mealsService
          .getMealStats()
          .then(() => ({ module: "meals", status: "HEALTHY" })),
        cookingMethodsService
          .getCookingMethodsStats()
          .then(() => ({ module: "cooking-methods", status: "HEALTHY" })),
        menuService
          .getMenuStats()
          .then(() => ({ module: "menus", status: "HEALTHY" })),
      ]);

      const moduleHealth = {};
      let overallHealth = "HEALTHY";

      healthChecks.forEach((check, index) => {
        const modules = ["recipes", "meals", "cooking-methods", "menus"];
        const moduleName = modules[index];

        if (check.status === "fulfilled") {
          moduleHealth[moduleName] = check.value.status;
        } else {
          moduleHealth[moduleName] = "UNHEALTHY";
          overallHealth = "DEGRADED";
        }
      });

      const healthData = {
        module: "menu",
        status: overallHealth,
        subModules: {
          ...moduleHealth,
          offers: "DEVELOPMENT", // Will be updated when module is complete
        },
        dependencies: {
          database: "HEALTHY", // This would be checked properly
          cache: "HEALTHY", // This would be checked properly
        },
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };

      return responseHandler.success(
        res,
        healthData,
        "Menu module health check completed"
      );
    } catch (error) {
      logger.error("Menu health check failed", {
        error: error.message,
      });

      return responseHandler.error(res, "Health check failed", 503, {
        module: "menu",
        status: "UNHEALTHY",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

export default router;
