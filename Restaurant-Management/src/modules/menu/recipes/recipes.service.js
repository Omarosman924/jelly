import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../../middleware/errorHandler.js";

/**
 * Recipes Service V2
 * Advanced recipe management with cost calculation and ingredient tracking
 */
class RecipesService {
  constructor() {
    this.cache = redisClient.cache(1800); // 30 minutes cache
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
   * Get all recipes with pagination and filtering
   */
  async getAllRecipes(options = {}) {
    try {
                const db = this.getDb();

      const {
        page = 1,
        limit = 10,
        search,
        isAvailable,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;
      const where = {};

      if (search) {
        where.OR = [
          { recipeCode: { contains: search, mode: "insensitive" } },
          { recipeNameAr: { contains: search, mode: "insensitive" } },
          { recipeNameEn: { contains: search, mode: "insensitive" } },
        ];
      }

      if (typeof isAvailable === "boolean") {
        where.isAvailable = isAvailable;
      }

      const total = await db.recipe.count({ where });
      const recipes = await db.recipe.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          recipeItems: {
            include: {
              item: {
                select: {
                  itemNameAr: true,
                  itemNameEn: true,
                  currentStock: true,
                  unit: {
                    select: {
                      unitNameEn: true,
                      unitSymbol: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              mealRecipes: true,
            },
          },
        },
      });

      // Add availability status based on ingredients
      const recipesWithStatus = recipes.map((recipe) => ({
        ...recipe,
        canPrepare: this.checkRecipeAvailability(recipe),
        profitMargin: this.calculateProfitMargin(recipe),
      }));

      return {
        recipes: recipesWithStatus,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get all recipes failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get recipe by ID with caching
   */
  async getRecipeById(recipeId) {
    
    try {
                const db = this.getDb();

      const cacheKey = `recipe:${recipeId}`;
      let recipe = await this.cache.get(cacheKey);

      if (!recipe) {
        recipe = await db.recipe.findUnique({
          where: { id: recipeId },
          include: {
            recipeItems: {
              include: {
                item: {
                  include: {
                    unit: true,
                  },
                },
              },
              orderBy: {
                totalCost: "desc",
              },
            },
            mealRecipes: {
              include: {
                meal: {
                  select: {
                    mealNameAr: true,
                    mealNameEn: true,
                    isAvailable: true,
                  },
                },
              },
            },
          },
        });

        if (!recipe) {
          throw new NotFoundError("Recipe");
        }

        // Add calculated fields
        recipe.canPrepare = this.checkRecipeAvailability(recipe);
        recipe.profitMargin = this.calculateProfitMargin(recipe);
        recipe.costBreakdown = this.getCostBreakdown(recipe);

        await this.cache.set(cacheKey, recipe);
      }

      return recipe;
    } catch (error) {
      logger.error("Get recipe by ID failed", {
        recipeId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new recipe with ingredients
   */
  async createRecipe(recipeData, createdBy) {
    try {
                const db = this.getDb();

      const {
        recipeCode,
        recipeNameAr,
        recipeNameEn,
        description,
        preparationTime,
        imageUrl,
        ingredients = [],
      } = recipeData;

      // Check if recipe code exists
      const existingRecipe = await db.recipe.findUnique({
        where: { recipeCode },
      });

      if (existingRecipe) {
        throw new ConflictError("Recipe code already exists");
      }

      // Validate ingredients
      if (ingredients.length === 0) {
        throw new AppError("Recipe must have at least one ingredient", 400);
      }

      // Verify all items exist
      const itemIds = ingredients.map((ing) => ing.itemId);
      const items = await db.item.findMany({
        where: { id: { in: itemIds } },
      });

      if (items.length !== itemIds.length) {
        throw new AppError("One or more ingredients not found", 400);
      }

      // Calculate costs
      const { totalCost, totalCalories } = await this.calculateRecipeCosts(
        ingredients,
        items
      );

      // Calculate suggested selling price (cost + 200% markup)
      const suggestedSellingPrice = totalCost * 3;

      // Create recipe with ingredients in transaction
      const recipe = await db.$transaction(async (prisma) => {
        // Create recipe
        const newRecipe = await prisma.recipe.create({
          data: {
            recipeCode,
            recipeNameAr,
            recipeNameEn,
            description,
            totalCost,
            sellingPrice: suggestedSellingPrice,
            preparationTime,
            totalCalories,
            imageUrl,
            isAvailable: true,
          },
        });

        // Create recipe items
        const recipeItems = ingredients.map((ingredient) => {
          const item = items.find((i) => i.id === ingredient.itemId);
          const unitCost = Number(item.costPrice);
          const totalIngredientCost = Number(ingredient.quantity) * unitCost;

          return {
            recipeId: newRecipe.id,
            itemId: ingredient.itemId,
            quantity: ingredient.quantity,
            unitCost,
            totalCost: totalIngredientCost,
          };
        });

        await prisma.recipeItem.createMany({
          data: recipeItems,
        });

        return newRecipe;
      });

      // Clear caches
      await this.invalidateRecipeCaches();

      logger.info("Recipe created successfully", {
        recipeId: recipe.id,
        recipeCode: recipe.recipeCode,
        totalCost,
        suggestedSellingPrice,
        createdBy: createdBy.id,
      });

      return await this.getRecipeById(recipe.id);
    } catch (error) {
      logger.error("Create recipe failed", {
        recipeCode: recipeData.recipeCode,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update recipe
   */
  async updateRecipe(recipeId, updateData, updatedBy) {
    try {
                const db = this.getDb();

      const existingRecipe = await db.recipe.findUnique({
        where: { id: recipeId },
        include: { recipeItems: true },
      });

      if (!existingRecipe) {
        throw new NotFoundError("Recipe");
      }

      const { ingredients, ...recipeUpdateData } = updateData;

      await db.$transaction(async (prisma) => {
        // Update recipe basic data
        await prisma.recipe.update({
          where: { id: recipeId },
          data: {
            ...recipeUpdateData,
            updatedAt: new Date(),
          },
        });

        // Update ingredients if provided
        if (ingredients) {
          // Delete existing recipe items
          await prisma.recipeItem.deleteMany({
            where: { recipeId },
          });

          // Verify items exist
          const itemIds = ingredients.map((ing) => ing.itemId);
          const items = await prisma.item.findMany({
            where: { id: { in: itemIds } },
          });

          if (items.length !== itemIds.length) {
            throw new AppError("One or more ingredients not found", 400);
          }

          // Calculate new costs
          const { totalCost, totalCalories } = await this.calculateRecipeCosts(
            ingredients,
            items
          );

          // Create new recipe items
          const recipeItems = ingredients.map((ingredient) => {
            const item = items.find((i) => i.id === ingredient.itemId);
            const unitCost = Number(item.costPrice);
            const totalIngredientCost = Number(ingredient.quantity) * unitCost;

            return {
              recipeId,
              itemId: ingredient.itemId,
              quantity: ingredient.quantity,
              unitCost,
              totalCost: totalIngredientCost,
            };
          });

          await prisma.recipeItem.createMany({
            data: recipeItems,
          });

          // Update recipe costs
          await prisma.recipe.update({
            where: { id: recipeId },
            data: {
              totalCost,
              totalCalories,
            },
          });
        }
      });

      // Clear caches
      await this.cache.del(`recipe:${recipeId}`);
      await this.invalidateRecipeCaches();

      logger.info("Recipe updated successfully", {
        recipeId,
        updatedBy: updatedBy.id,
      });

      return await this.getRecipeById(recipeId);
    } catch (error) {
      logger.error("Update recipe failed", {
        recipeId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete recipe
   */
  async deleteRecipe(recipeId, deletedBy) {
    try {
                const db = this.getDb();

      const recipe = await db.recipe.findUnique({
        where: { id: recipeId },
        include: {
          mealRecipes: true,
        },
      });

      if (!recipe) {
        throw new NotFoundError("Recipe");
      }

      // Check if recipe is used in meals
      if (recipe.mealRecipes.length > 0) {
        throw new AppError("Cannot delete recipe that is used in meals", 400);
      }

      // Soft delete
      await db.recipe.update({
        where: { id: recipeId },
        data: {
          isAvailable: false,
          updatedAt: new Date(),
        },
      });

      await this.cache.del(`recipe:${recipeId}`);
      await this.invalidateRecipeCaches();

      logger.info("Recipe deleted successfully", {
        recipeId,
        recipeCode: recipe.recipeCode,
        deletedBy: deletedBy.id,
      });
    } catch (error) {
      logger.error("Delete recipe failed", {
        recipeId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate recipe costs and calories
   */
  async calculateRecipeCosts(ingredients, items) {
    let totalCost = 0;
    let totalCalories = 0;

    for (const ingredient of ingredients) {
      const item = items.find((i) => i.id === ingredient.itemId);
      if (item) {
        totalCost += Number(ingredient.quantity) * Number(item.costPrice);
        if (item.caloriesPerUnit) {
          totalCalories +=
            Number(ingredient.quantity) * Number(item.caloriesPerUnit);
        }
      }
    }

    return { totalCost, totalCalories };
  }

  /**
   * Check if recipe can be prepared based on ingredient availability
   */
  checkRecipeAvailability(recipe) {
    return recipe.recipeItems.every(
      (recipeItem) => recipeItem.item.currentStock >= recipeItem.quantity
    );
  }

  /**
   * Calculate profit margin
   */
  calculateProfitMargin(recipe) {
    if (recipe.totalCost === 0) return 0;
    return (
      ((recipe.sellingPrice - recipe.totalCost) / recipe.sellingPrice) *
      100
    ).toFixed(2);
  }

  /**
   * Get cost breakdown for recipe
   */
  getCostBreakdown(recipe) {
    return recipe.recipeItems.map((recipeItem) => ({
      itemName: recipeItem.item.itemNameEn || recipeItem.item.itemNameAr,
      quantity: recipeItem.quantity,
      unit: recipeItem.item.unit.unitSymbol,
      unitCost: recipeItem.unitCost,
      totalCost: recipeItem.totalCost,
      percentage: ((recipeItem.totalCost / recipe.totalCost) * 100).toFixed(2),
    }));
  }

  /**
   * Get recipe statistics
   */
  async getRecipeStats() {
    try {
                const db = this.getDb();

      const cacheKey = "recipe_stats";
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const [
          totalRecipes,
          availableRecipes,
          avgPreparationTime,
          avgCost,
          avgSellingPrice,
        ] = await Promise.all([
          db.recipe.count(),
          db.recipe.count({ where: { isAvailable: true } }),
          db.recipe.aggregate({
            _avg: { preparationTime: true },
            where: { isAvailable: true },
          }),
          db.recipe.aggregate({
            _avg: { totalCost: true },
            where: { isAvailable: true },
          }),
          db.recipe.aggregate({
            _avg: { sellingPrice: true },
            where: { isAvailable: true },
          }),
        ]);

        stats = {
          totalRecipes,
          availableRecipes,
          unavailableRecipes: totalRecipes - availableRecipes,
          avgPreparationTime: Math.round(
            avgPreparationTime._avg.preparationTime || 0
          ),
          avgCost: Number(avgCost._avg.totalCost || 0).toFixed(2),
          avgSellingPrice: Number(
            avgSellingPrice._avg.sellingPrice || 0
          ).toFixed(2),
          avgProfitMargin:
            avgCost._avg.totalCost && avgSellingPrice._avg.sellingPrice
              ? (
                  ((avgSellingPrice._avg.sellingPrice -
                    avgCost._avg.totalCost) /
                    avgSellingPrice._avg.sellingPrice) *
                  100
                ).toFixed(2)
              : 0,
          timestamp: new Date().toISOString(),
        };

        await this.cache.set(cacheKey, stats, 600);
      }

      return stats;
    } catch (error) {
      logger.error("Get recipe stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Invalidate recipe-related caches
   */
  async invalidateRecipeCaches() {
    const cacheKeys = ["recipe_stats"];
    await Promise.all(cacheKeys.map((key) => this.cache.del(key)));
  }
}

const recipesService = new RecipesService();
export default recipesService;