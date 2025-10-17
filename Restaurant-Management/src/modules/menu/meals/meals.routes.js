import express from "express";
import mealsController from "./meals.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";
import { validateRequest } from "./meals.validation.js";

const router = express.Router();

/**
 * Meals Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Public routes (all authenticated users can view)
router.get("/", mealsController.getAllMeals);
router.get("/available", mealsController.getAvailableMeals);
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  mealsController.getMealStats
);
router.get("/:id", mealsController.getMealById);
router.get("/:id/cost", mealsController.calculateMealCost);
router.get("/:id/nutrition", mealsController.getMealNutrition);

// Kitchen and admin routes
router.post(
  "/",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("createMeal"),
  mealsController.createMeal
);

router.put(
  "/:id",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("updateMeal"),
  mealsController.updateMeal
);

router.patch(
  "/:id/price",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updatePrice"),
  mealsController.updateMealPrice
);

router.delete("/:id", requireRole("ADMIN"), mealsController.deleteMeal);

export default router;
