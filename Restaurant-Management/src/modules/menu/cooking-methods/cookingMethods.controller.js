import cookingMethodsService from "./cookingMethods.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";

/**
 * Cooking Methods Controller V2
 * Handles cooking methods management operations
 */
class CookingMethodsController {
  /**
   * Get all cooking methods with pagination and filtering
   */
  getAllCookingMethods = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      search: req.query.search,
      isAvailable:
        req.query.isAvailable === "true"
          ? true
          : req.query.isAvailable === "false"
          ? false
          : undefined,
      sortBy: req.query.sortBy || "methodNameEn",
      sortOrder: req.query.sortOrder || "asc",
    };

    const result = await cookingMethodsService.getAllCookingMethods(options);
    return responseHandler.paginated(
      res,
      result.cookingMethods,
      result.pagination,
      "Cooking methods retrieved successfully"
    );
  });

  /**
   * Get cooking method by ID
   */
  getCookingMethodById = asyncHandler(async (req, res) => {
    const methodId = parseInt(req.params.id);
    if (isNaN(methodId)) {
      return responseHandler.error(res, "Invalid cooking method ID", 400);
    }

    const cookingMethod = await cookingMethodsService.getCookingMethodById(
      methodId
    );
    return responseHandler.success(
      res,
      cookingMethod,
      "Cooking method retrieved successfully"
    );
  });

  /**
   * Create new cooking method
   */
  createCookingMethod = asyncHandler(async (req, res) => {
    const cookingMethod = await cookingMethodsService.createCookingMethod(
      req.body,
      req.user
    );
    return responseHandler.created(
      res,
      cookingMethod,
      "Cooking method created successfully"
    );
  });

  /**
   * Update cooking method
   */
  updateCookingMethod = asyncHandler(async (req, res) => {
    const methodId = parseInt(req.params.id);
    if (isNaN(methodId)) {
      return responseHandler.error(res, "Invalid cooking method ID", 400);
    }

    const cookingMethod = await cookingMethodsService.updateCookingMethod(
      methodId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      cookingMethod,
      "Cooking method updated successfully"
    );
  });

  /**
   * Delete cooking method
   */
  deleteCookingMethod = asyncHandler(async (req, res) => {
    const methodId = parseInt(req.params.id);
    if (isNaN(methodId)) {
      return responseHandler.error(res, "Invalid cooking method ID", 400);
    }

    await cookingMethodsService.deleteCookingMethod(methodId, req.user);
    return responseHandler.success(
      res,
      null,
      "Cooking method deleted successfully"
    );
  });

  /**
   * Get active cooking methods (for dropdowns)
   */
  getActiveCookingMethods = asyncHandler(async (req, res) => {
    const methods = await cookingMethodsService.getActiveCookingMethods();
    return responseHandler.success(
      res,
      methods,
      "Active cooking methods retrieved successfully"
    );
  });

  /**
   * Get cooking methods statistics
   */
  getCookingMethodsStats = asyncHandler(async (req, res) => {
    const stats = await cookingMethodsService.getCookingMethodsStats();
    return responseHandler.success(
      res,
      stats,
      "Cooking methods statistics retrieved successfully"
    );
  });

  /**
   * Calculate method impact on order
   */
  calculateMethodImpact = asyncHandler(async (req, res) => {
    const methodId = parseInt(req.params.id);
    const { quantity = 1 } = req.query;

    if (isNaN(methodId)) {
      return responseHandler.error(res, "Invalid cooking method ID", 400);
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
      return responseHandler.error(
        res,
        "Quantity must be a positive number",
        400
      );
    }

    const impact = await cookingMethodsService.calculateMethodImpact(
      methodId,
      parsedQuantity
    );
    return responseHandler.success(
      res,
      impact,
      "Method impact calculated successfully"
    );
  });

  /**
   * Get popular cooking methods
   */
  getPopularMethods = asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 365); // Max 1 year

    const popularMethods = await cookingMethodsService.getPopularMethods(days);
    return responseHandler.success(
      res,
      {
        period: `Last ${days} days`,
        methods: popularMethods,
        totalMethods: popularMethods.length,
      },
      "Popular cooking methods retrieved successfully"
    );
  });

  /**
   * Get cooking methods usage analytics
   */
  getCookingMethodsAnalytics = asyncHandler(async (req, res) => {
    const { period = "month" } = req.query;

    // Validate period
    if (!["week", "month", "quarter", "year"].includes(period)) {
      return responseHandler.error(
        res,
        "Invalid period. Use: week, month, quarter, or year",
        400
      );
    }

    const days = {
      week: 7,
      month: 30,
      quarter: 90,
      year: 365,
    }[period];

    const [stats, popularMethods] = await Promise.all([
      cookingMethodsService.getCookingMethodsStats(),
      cookingMethodsService.getPopularMethods(days),
    ]);

    const analytics = {
      period,
      overview: {
        totalMethods: stats.totalMethods,
        availableMethods: stats.availableMethods,
        avgCookingTime: stats.avgCookingTime,
        avgAdditionalCost: stats.avgAdditionalCost,
      },
      usage: {
        mostUsedMethod: stats.mostUsedMethod,
        popularMethods: popularMethods,
        usageDistribution: stats.usageDistribution,
      },
      recommendations: this.generateRecommendations(stats, popularMethods),
      timestamp: new Date().toISOString(),
    };

    return responseHandler.success(
      res,
      analytics,
      "Cooking methods analytics retrieved successfully"
    );
  });

  /**
   * Bulk update cooking methods availability
   */
  bulkUpdateAvailability = asyncHandler(async (req, res) => {
    const { methodIds, isAvailable } = req.body;

    if (!Array.isArray(methodIds) || methodIds.length === 0) {
      return responseHandler.error(res, "Method IDs array is required", 400);
    }

    if (typeof isAvailable !== "boolean") {
      return responseHandler.error(res, "isAvailable must be a boolean", 400);
    }

    if (methodIds.length > 20) {
      return responseHandler.error(
        res,
        "Maximum 20 methods can be updated at once",
        400
      );
    }

    const results = {
      updated: [],
      failed: [],
    };

    for (const methodId of methodIds) {
      try {
        const updatedMethod = await cookingMethodsService.updateCookingMethod(
          methodId,
          { isAvailable },
          req.user
        );
        results.updated.push({
          id: methodId,
          success: true,
          method: updatedMethod,
        });
      } catch (error) {
        results.failed.push({
          id: methodId,
          success: false,
          error: error.message,
        });
      }
    }

    const message = `Bulk update completed: ${results.updated.length} updated, ${results.failed.length} failed`;

    if (results.failed.length === 0) {
      return responseHandler.success(res, results, message);
    } else {
      return responseHandler.success(res, results, message, 207); // Multi-status
    }
  });

  /**
   * Generate method recommendations based on analytics
   */
  generateRecommendations(stats, popularMethods) {
    const recommendations = [];

    // Recommend based on usage
    if (stats.mostUsedMethod) {
      recommendations.push({
        type: "OPTIMIZE_POPULAR",
        title: "Optimize Popular Method",
        message: `${stats.mostUsedMethod.methodNameEn} is your most used cooking method. Consider optimizing its workflow.`,
        method: stats.mostUsedMethod,
      });
    }

    // Recommend based on cost
    if (stats.avgAdditionalCost > 10) {
      recommendations.push({
        type: "COST_OPTIMIZATION",
        title: "High Cost Methods",
        message:
          "Your average additional cost is high. Consider reviewing method pricing.",
        avgCost: stats.avgAdditionalCost,
      });
    }

    // Recommend based on time
    if (stats.avgCookingTime > 30) {
      recommendations.push({
        type: "TIME_OPTIMIZATION",
        title: "Long Cooking Times",
        message:
          "Average cooking time is high. Consider faster preparation methods.",
        avgTime: stats.avgCookingTime,
      });
    }

    // Recommend underutilized methods
    if (popularMethods.length < 3 && stats.availableMethods > 5) {
      recommendations.push({
        type: "PROMOTE_VARIETY",
        title: "Promote Cooking Variety",
        message:
          "Many cooking methods are underutilized. Consider promoting variety to customers.",
        availableMethods: stats.availableMethods,
        popularCount: popularMethods.length,
      });
    }

    return recommendations;
  }
}

const cookingMethodsController = new CookingMethodsController();
export default cookingMethodsController;
