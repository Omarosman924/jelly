import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../../middleware/errorHandler.js";

/**
 * Meals Service V2
 * Complex meal management with recipes and items combination
 */
class MealsService {
  constructor() {
    this.cache = redisClient.cache(1800);
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
  async getAllMeals(options = {}) {
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
          { mealCode: { contains: search, mode: "insensitive" } },
          { mealNameAr: { contains: search, mode: "insensitive" } },
          { mealNameEn: { contains: search, mode: "insensitive" } },
        ];
      }

      if (typeof isAvailable === "boolean") where.isAvailable = isAvailable;

      const total = await db.meal.count({ where });
      const meals = await db.meal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          mealRecipes: {
            include: {
              recipe: {
                select: {
                  recipeNameAr: true,
                  recipeNameEn: true,
                  preparationTime: true,
                },
              },
            },
          },
          mealItems: {
            include: {
              item: {
                select: {
                  itemNameAr: true,
                  itemNameEn: true,
                  currentStock: true,
                  unit: { select: { unitSymbol: true } },
                },
              },
            },
          },
        },
      });

      return {
        meals: meals.map((meal) => ({
          ...meal,
          canPrepare: this.checkMealAvailability(meal),
          profitMargin: this.calculateProfitMargin(meal),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get all meals failed", { error: error.message });
      throw error;
    }
  }

  async getMealById(mealId) {
    try {
            const db = this.getDb();

      const meal = await db.meal.findUnique({
        where: { id: mealId },
        include: {
          mealRecipes: {
            include: {
              recipe: {
                select: {
                  id: true,
                  recipeNameAr: true,
                  recipeNameEn: true,
                  preparationTime: true,
                  totalCost: true,
                  totalCalories: true,
                },
              },
            },
          },
          mealItems: {
            include: {
              item: {
                select: {
                  id: true,
                  itemNameAr: true,
                  itemNameEn: true,
                  currentStock: true,
                  costPrice: true,
                  caloriesPerUnit: true,
                  unit: { select: { unitSymbol: true } },
                },
              },
            },
          },
        },
      });

      if (!meal) {
        throw new NotFoundError("Meal not found");
      }

      return {
        ...meal,
        canPrepare: this.checkMealAvailability(meal),
        profitMargin: this.calculateProfitMargin(meal),
      };
    } catch (error) {
      logger.error("Get meal by ID failed", { mealId, error: error.message });
      throw error;
    }
  }

  async createMeal(mealData) {
    try {
            const db = this.getDb();

      const { recipes = [], items = [], ...basicMealData } = mealData;

      if (recipes.length === 0 && items.length === 0) {
        throw new AppError(
          "Meal must contain at least one recipe or item",
          400
        );
      }

      // Check if meal code already exists
      const existingMeal = await db.meal.findUnique({
        where: { mealCode: basicMealData.mealCode },
      });

      if (existingMeal) {
        throw new ConflictError("Meal code already exists");
      }

      // Calculate total costs
      const { totalCost, totalCalories, totalPreparationTime } =
        await this.calculateMealCosts(recipes, items);

      const meal = await db.$transaction(async (prisma) => {
        const newMeal = await prisma.meal.create({
          data: {
            ...basicMealData,
            totalCost,
            sellingPrice: totalCost * 2.5, // 150% markup
            preparationTime: totalPreparationTime,
            totalCalories,
            isAvailable: true,
          },
        });

        // Create meal recipes
        if (recipes.length > 0) {
          await prisma.mealRecipe.createMany({
            data: recipes.map((r) => ({
              mealId: newMeal.id,
              recipeId: r.recipeId,
              quantity: r.quantity,
              cost: r.cost || 0,
            })),
          });
        }

        // Create meal items
        if (items.length > 0) {
          await prisma.mealItem.createMany({
            data: items.map((i) => ({
              mealId: newMeal.id,
              itemId: i.itemId,
              quantity: i.quantity,
              cost: i.cost || 0,
            })),
          });
        }

        return newMeal;
      });

      logger.info("Meal created successfully", {
        mealId: meal.id,
        totalCost,
      });

      return this.getMealById(meal.id);
    } catch (error) {
      logger.error("Create meal failed", { error: error.message });
      throw error;
    }
  }

  async updateMeal(mealId, updateData) {
    try {
            const db = this.getDb();

      const { recipes, items, ...basicUpdateData } = updateData;

      const existingMeal = await this.getMealById(mealId);

      const meal = await db.$transaction(async (prisma) => {
        // Update basic meal data
        const updatedMeal = await prisma.meal.update({
          where: { id: mealId },
          data: {
            ...basicUpdateData,
            updatedAt: new Date(),
          },
        });

        // Update recipes if provided
        if (recipes !== undefined) {
          await prisma.mealRecipe.deleteMany({
            where: { mealId },
          });

          if (recipes.length > 0) {
            await prisma.mealRecipe.createMany({
              data: recipes.map((r) => ({
                mealId,
                recipeId: r.recipeId,
                quantity: r.quantity,
                cost: r.cost || 0,
              })),
            });
          }
        }

        // Update items if provided
        if (items !== undefined) {
          await prisma.mealItem.deleteMany({
            where: { mealId },
          });

          if (items.length > 0) {
            await prisma.mealItem.createMany({
              data: items.map((i) => ({
                mealId,
                itemId: i.itemId,
                quantity: i.quantity,
                cost: i.cost || 0,
              })),
            });
          }
        }

        // Recalculate costs if recipes or items were updated
        if (recipes !== undefined || items !== undefined) {
          const { totalCost, totalCalories, totalPreparationTime } =
            await this.calculateMealCosts(recipes || [], items || []);

          await prisma.meal.update({
            where: { id: mealId },
            data: {
              totalCost,
              totalCalories,
              preparationTime: totalPreparationTime,
            },
          });
        }

        return updatedMeal;
      });

      logger.info("Meal updated successfully", {
        mealId,
      });

      return this.getMealById(mealId);
    } catch (error) {
      logger.error("Update meal failed", { mealId, error: error.message });
      throw error;
    }
  }

  async deleteMeal(mealId, deletedBy) {
    try {
            const db = this.getDb();

      const existingMeal = await this.getMealById(mealId);

      await db.$transaction(async (prisma) => {
        // Delete meal recipes
        await prisma.mealRecipe.deleteMany({
          where: { mealId },
        });

        // Delete meal items
        await prisma.mealItem.deleteMany({
          where: { mealId },
        });

        // Delete the meal
        await prisma.meal.delete({
          where: { id: mealId },
        });
      });

      logger.info("Meal deleted successfully", {
        mealId,
        deletedBy: deletedBy.id,
      });

      return true;
    } catch (error) {
      logger.error("Delete meal failed", { mealId, error: error.message });
      throw error;
    }
  }

  async getMealStats() {
    try {
            const db = this.getDb();

      const [totalMeals, availableMeals, avgCost, avgPrice] = await Promise.all(
        [
          db.meal.count(),
          db.meal.count({ where: { isAvailable: true } }),
          db.meal.aggregate({
            _avg: { totalCost: true },
          }),
          db.meal.aggregate({
            _avg: { sellingPrice: true },
          }),
        ]
      );

      return {
        totalMeals,
        availableMeals,
        unavailableMeals: totalMeals - availableMeals,
        averageCost: avgCost._avg.totalCost || 0,
        averagePrice: avgPrice._avg.sellingPrice || 0,
        averageProfitMargin:
          avgPrice._avg.sellingPrice && avgCost._avg.totalCost
            ? (
                ((avgPrice._avg.sellingPrice - avgCost._avg.totalCost) /
                  avgPrice._avg.sellingPrice) *
                100
              ).toFixed(2)
            : 0,
      };
    } catch (error) {
      logger.error("Get meal stats failed", { error: error.message });
      throw error;
    }
  }

  async calculateMealCosts(recipes, items) {
    const db = this.getDb();
    let totalCost = 0;
    let totalCalories = 0;
    let totalPreparationTime = 0;

    // Calculate recipe costs
    if (recipes.length > 0) {
      const recipeIds = recipes.map((r) => r.recipeId);
      const recipeData = await db.recipe.findMany({
        where: { id: { in: recipeIds } },
      });

      for (const recipe of recipes) {
        const recipeInfo = recipeData.find((r) => r.id === recipe.recipeId);
        if (recipeInfo) {
          totalCost += Number(recipeInfo.totalCost) * Number(recipe.quantity);
          totalCalories +=
            (recipeInfo.totalCalories || 0) * Number(recipe.quantity);
          totalPreparationTime += recipeInfo.preparationTime || 0;
        }
      }
    }

    // Calculate item costs
    if (items.length > 0) {
      const itemIds = items.map((i) => i.itemId);
      const itemData = await db.item.findMany({
        where: { id: { in: itemIds } },
      });

      for (const item of items) {
        const itemInfo = itemData.find((i) => i.id === item.itemId);
        if (itemInfo) {
          totalCost += Number(itemInfo.costPrice) * Number(item.quantity);
          totalCalories +=
            (itemInfo.caloriesPerUnit || 0) * Number(item.quantity);
        }
      }
    }

    return { totalCost, totalCalories, totalPreparationTime };
  }

  checkMealAvailability(meal) {
    const recipesAvailable = meal.mealRecipes.every(
      (mr) => mr.recipe && mr.quantity > 0
    );

    const itemsAvailable = meal.mealItems.every(
      (mi) => mi.item.currentStock >= mi.quantity
    );

    return recipesAvailable && itemsAvailable;
  }

  calculateProfitMargin(meal) {
    if (meal.totalCost === 0) return 0;
    return (
      ((meal.sellingPrice - meal.totalCost) / meal.sellingPrice) *
      100
    ).toFixed(2);
  }
}

// Create and export an instance of the service
const mealsService = new MealsService();
export default mealsService;