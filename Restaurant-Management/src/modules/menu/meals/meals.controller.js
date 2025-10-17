import mealsService from "./meals.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";

/**
 * Meals Controller V2
 * Handles complex meal management with recipes and items
 */
class MealsController {
  /**
   * Get all meals with pagination and filtering
   */
  getAllMeals = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100),
      search: req.query.search,
      isAvailable:
        req.query.isAvailable === "true"
          ? true
          : req.query.isAvailable === "false"
          ? false
          : undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await mealsService.getAllMeals(options);
    return responseHandler.paginated(
      res,
      result.meals,
      result.pagination,
      "Meals retrieved successfully"
    );
  });

  /**
   * Get meal by ID
   */
  getMealById = asyncHandler(async (req, res) => {
    const mealId = parseInt(req.params.id);
    if (isNaN(mealId)) {
      return responseHandler.error(res, "Invalid meal ID", 400);
    }

    const meal = await mealsService.getMealById(mealId);
    return responseHandler.success(res, meal, "Meal retrieved successfully");
  });

  /**
   * Create new meal
   */
  createMeal = asyncHandler(async (req, res) => {
    const meal = await mealsService.createMeal(req.body, req.user);
    return responseHandler.created(res, meal, "Meal created successfully");
  });

  /**
   * Update meal
   */
  updateMeal = asyncHandler(async (req, res) => {
    const mealId = parseInt(req.params.id);
    if (isNaN(mealId)) {
      return responseHandler.error(res, "Invalid meal ID", 400);
    }

    const meal = await mealsService.updateMeal(mealId, req.body, req.user);
    return responseHandler.success(res, meal, "Meal updated successfully");
  });

  /**
   * Delete meal
   */
  deleteMeal = asyncHandler(async (req, res) => {
    const mealId = parseInt(req.params.id);
    if (isNaN(mealId)) {
      return responseHandler.error(res, "Invalid meal ID", 400);
    }

    await mealsService.deleteMeal(mealId, req.user);
    return responseHandler.success(res, null, "Meal deleted successfully");
  });

  /**
   * Get available meals (for orders)
   */
  getAvailableMeals = asyncHandler(async (req, res) => {
    const options = {
      page: 1,
      limit: 100,
      isAvailable: true,
      sortBy: "mealNameEn",
      sortOrder: "asc",
    };

    const result = await mealsService.getAllMeals(options);

    // Filter only meals that can be prepared
    const availableMeals = result.meals
      .filter((meal) => meal.canPrepare)
      .map((meal) => ({
        id: meal.id,
        mealCode: meal.mealCode,
        mealNameAr: meal.mealNameAr,
        mealNameEn: meal.mealNameEn,
        sellingPrice: meal.sellingPrice,
        preparationTime: meal.preparationTime,
        totalCalories: meal.totalCalories,
        imageUrl: meal.imageUrl,
        profitMargin: meal.profitMargin,
      }));

    return responseHandler.success(
      res,
      availableMeals,
      "Available meals retrieved successfully"
    );
  });

  /**
   * Get meal statistics
   */
  getMealStats = asyncHandler(async (req, res) => {
    const stats = await mealsService.getMealStats();
    return responseHandler.success(
      res,
      stats,
      "Meal statistics retrieved successfully"
    );
  });

  /**
   * Calculate meal cost
   */
  calculateMealCost = asyncHandler(async (req, res) => {
    const mealId = parseInt(req.params.id);
    if (isNaN(mealId)) {
      return responseHandler.error(res, "Invalid meal ID", 400);
    }

    const meal = await mealsService.getMealById(mealId);

    const costAnalysis = {
      mealId: meal.id,
      mealName: meal.mealNameEn || meal.mealNameAr,
      totalCost: meal.totalCost,
      sellingPrice: meal.sellingPrice,
      profitMargin: meal.profitMargin,
      canPrepare: meal.canPrepare,
      components: {
        recipes: meal.mealRecipes?.length || 0,
        items: meal.mealItems?.length || 0,
      },
      timestamp: new Date().toISOString(),
    };

    return responseHandler.success(
      res,
      costAnalysis,
      "Meal cost calculated successfully"
    );
  });

  /**
   * Update meal selling price
   */
  updateMealPrice = asyncHandler(async (req, res) => {
    const mealId = parseInt(req.params.id);
    if (isNaN(mealId)) {
      return responseHandler.error(res, "Invalid meal ID", 400);
    }

    const { sellingPrice } = req.body;

    if (!sellingPrice || sellingPrice <= 0) {
      return responseHandler.error(res, "Valid selling price is required", 400);
    }

    const meal = await mealsService.updateMeal(
      mealId,
      { sellingPrice },
      req.user
    );

    return responseHandler.success(
      res,
      meal,
      "Meal price updated successfully"
    );
  });

  /**
   * Get meal nutrition info
   */
  getMealNutrition = asyncHandler(async (req, res) => {
    const mealId = parseInt(req.params.id);
    if (isNaN(mealId)) {
      return responseHandler.error(res, "Invalid meal ID", 400);
    }

    const meal = await mealsService.getMealById(mealId);

    const nutritionInfo = {
      mealId: meal.id,
      mealName: meal.mealNameEn || meal.mealNameAr,
      totalCalories: meal.totalCalories,
      preparationTime: meal.preparationTime,
      servingSize: "1 portion",
      // Additional nutrition data would be calculated from ingredients
      estimatedNutrition: {
        calories: meal.totalCalories,
        caloriesPerSAR: meal.totalCalories / (meal.sellingPrice || 1),
        preparationTimePerCalorie:
          (meal.preparationTime || 0) / (meal.totalCalories || 1),
      },
      timestamp: new Date().toISOString(),
    };

    return responseHandler.success(
      res,
      nutritionInfo,
      "Meal nutrition information retrieved successfully"
    );
  });
}

const mealsController = new MealsController();
export default mealsController;
