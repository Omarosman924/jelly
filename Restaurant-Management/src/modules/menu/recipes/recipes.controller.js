import recipesService from "./recipes.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";

/**
 * Recipes Controller V2
 * Handles recipe management with cost calculation
 */
class RecipesController {
  /**
   * Get all recipes with pagination and filtering
   */
  getAllRecipes = asyncHandler(async (req, res) => {
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

    const result = await recipesService.getAllRecipes(options);
    return responseHandler.paginated(
      res,
      result.recipes,
      result.pagination,
      "Recipes retrieved successfully"
    );
  });

  /**
   * Get recipe by ID
   */
  getRecipeById = asyncHandler(async (req, res) => {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) {
      return responseHandler.error(res, "Invalid recipe ID", 400);
    }

    const recipe = await recipesService.getRecipeById(recipeId);
    return responseHandler.success(
      res,
      recipe,
      "Recipe retrieved successfully"
    );
  });

  /**
   * Create new recipe
   */
  createRecipe = asyncHandler(async (req, res) => {
    const recipe = await recipesService.createRecipe(req.body, req.user);
    return responseHandler.created(res, recipe, "Recipe created successfully");
  });

  /**
   * Update recipe
   */
  updateRecipe = asyncHandler(async (req, res) => {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) {
      return responseHandler.error(res, "Invalid recipe ID", 400);
    }

    const recipe = await recipesService.updateRecipe(
      recipeId,
      req.body,
      req.user
    );
    return responseHandler.success(res, recipe, "Recipe updated successfully");
  });

  /**
   * Delete recipe
   */
  deleteRecipe = asyncHandler(async (req, res) => {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) {
      return responseHandler.error(res, "Invalid recipe ID", 400);
    }

    await recipesService.deleteRecipe(recipeId, req.user);
    return responseHandler.success(res, null, "Recipe deleted successfully");
  });

  /**
   * Get recipe statistics
   */
  getRecipeStats = asyncHandler(async (req, res) => {
    const stats = await recipesService.getRecipeStats();
    return responseHandler.success(
      res,
      stats,
      "Recipe statistics retrieved successfully"
    );
  });

  /**
   * Get available recipes (for orders)
   */
  getAvailableRecipes = asyncHandler(async (req, res) => {
    const options = {
      page: 1,
      limit: 100,
      isAvailable: true,
      sortBy: "recipeNameEn",
      sortOrder: "asc",
    };

    const result = await recipesService.getAllRecipes(options);

    // Filter only recipes that can be prepared
    const availableRecipes = result.recipes
      .filter((recipe) => recipe.canPrepare)
      .map((recipe) => ({
        id: recipe.id,
        recipeCode: recipe.recipeCode,
        recipeNameAr: recipe.recipeNameAr,
        recipeNameEn: recipe.recipeNameEn,
        sellingPrice: recipe.sellingPrice,
        preparationTime: recipe.preparationTime,
        totalCalories: recipe.totalCalories,
        imageUrl: recipe.imageUrl,
        profitMargin: recipe.profitMargin,
      }));

    return responseHandler.success(
      res,
      availableRecipes,
      "Available recipes retrieved successfully"
    );
  });

  /**
   * Calculate recipe cost
   */
  calculateRecipeCost = asyncHandler(async (req, res) => {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) {
      return responseHandler.error(res, "Invalid recipe ID", 400);
    }

    const recipe = await recipesService.getRecipeById(recipeId);

    const costAnalysis = {
      recipeId: recipe.id,
      recipeName: recipe.recipeNameEn || recipe.recipeNameAr,
      totalCost: recipe.totalCost,
      sellingPrice: recipe.sellingPrice,
      profitMargin: recipe.profitMargin,
      costBreakdown: recipe.costBreakdown,
      canPrepare: recipe.canPrepare,
      timestamp: new Date().toISOString(),
    };

    return responseHandler.success(
      res,
      costAnalysis,
      "Recipe cost calculated successfully"
    );
  });

  /**
   * Update recipe selling price
   */
  updateRecipePrice = asyncHandler(async (req, res) => {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) {
      return responseHandler.error(res, "Invalid recipe ID", 400);
    }

    const { sellingPrice } = req.body;

    if (!sellingPrice || sellingPrice <= 0) {
      return responseHandler.error(res, "Valid selling price is required", 400);
    }

    const recipe = await recipesService.updateRecipe(
      recipeId,
      { sellingPrice },
      req.user
    );

    return responseHandler.success(
      res,
      recipe,
      "Recipe price updated successfully"
    );
  });
}

const recipesController = new RecipesController();
export default recipesController;
