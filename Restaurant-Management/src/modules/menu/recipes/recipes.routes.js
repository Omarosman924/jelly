import express from "express";
import recipesController from "./recipes.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../../middleware/authMiddleware.js";
import { validateRequest } from "./recipes.validation.js";

const router = express.Router();

/**
 * Recipes Routes V2
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authMiddleware);

// Public routes (all authenticated users can view)
router.get("/", recipesController.getAllRecipes);
router.get("/available", recipesController.getAvailableRecipes);
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  recipesController.getRecipeStats
);
router.get("/:id", recipesController.getRecipeById);
router.get("/:id/cost", recipesController.calculateRecipeCost);

// Kitchen and admin routes
router.post(
  "/",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("createRecipe"),
  recipesController.createRecipe
);

router.put(
  "/:id",
  requireRole("ADMIN", "KITCHEN"),
  validateRequest("updateRecipe"),
  recipesController.updateRecipe
);

router.patch(
  "/:id/price",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updatePrice"),
  recipesController.updateRecipePrice
);

router.delete("/:id", requireRole("ADMIN"), recipesController.deleteRecipe);

export default router;
