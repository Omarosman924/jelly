import Joi from "joi";
import { responseHandler } from "../../../utils/response.js";
import logger from "../../../utils/logger.js";

const schemas = {
  createMeal: Joi.object({
    mealCode: Joi.string().alphanum().min(3).max(20).required().messages({
      "string.alphanum": "Meal code must contain only letters and numbers",
      "string.min": "Meal code must be at least 3 characters",
      "string.max": "Meal code must not exceed 20 characters",
      "any.required": "Meal code is required",
    }),

    mealNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[\u0600-\u06FF\s]+$/)
      .required()
      .messages({
        "string.min": "Arabic meal name must be at least 2 characters",
        "string.max": "Arabic meal name must not exceed 100 characters",
        "string.pattern.base":
          "Arabic meal name can only contain Arabic letters and spaces",
        "any.required": "Arabic meal name is required",
      }),

    mealNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .messages({
        "string.min": "English meal name must be at least 2 characters",
        "string.max": "English meal name must not exceed 100 characters",
        "string.pattern.base":
          "English meal name can only contain English letters and spaces",
        "any.required": "English meal name is required",
      }),

    description: Joi.string().max(500).allow("", null),

    imageUrl: Joi.string().uri().allow("", null),

    recipes: Joi.array()
      .items(
        Joi.object({
          recipeId: Joi.number().integer().positive().required(),
          quantity: Joi.number().positive().precision(3).required().messages({
            "number.positive": "Recipe quantity must be positive",
            "any.required": "Recipe quantity is required",
          }),
        })
      )
      .optional(),

    items: Joi.array()
      .items(
        Joi.object({
          itemId: Joi.number().integer().positive().required(),
          quantity: Joi.number().positive().precision(3).required().messages({
            "number.positive": "Item quantity must be positive",
            "any.required": "Item quantity is required",
          }),
        })
      )
      .optional(),
  }).custom((value, helpers) => {
    // Custom validation to ensure at least one recipe or item
    if (
      (!value.recipes || value.recipes.length === 0) &&
      (!value.items || value.items.length === 0)
    ) {
      return helpers.error("any.custom", {
        message: "Meal must contain at least one recipe or item",
      });
    }
    return value;
  }),

  updateMeal: Joi.object({
    mealCode: Joi.string().alphanum().min(3).max(20),

    mealNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[\u0600-\u06FF\s]+$/),

    mealNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s]+$/),

    description: Joi.string().max(500).allow("", null),

    sellingPrice: Joi.number().positive().precision(2),

    imageUrl: Joi.string().uri().allow("", null),

    isAvailable: Joi.boolean(),

    recipes: Joi.array()
      .items(
        Joi.object({
          recipeId: Joi.number().integer().positive().required(),
          quantity: Joi.number().positive().precision(3).required(),
        })
      )
      .optional(),

    items: Joi.array()
      .items(
        Joi.object({
          itemId: Joi.number().integer().positive().required(),
          quantity: Joi.number().positive().precision(3).required(),
        })
      )
      .optional(),
  }).min(1),

  updatePrice: Joi.object({
    sellingPrice: Joi.number().positive().precision(2).required().messages({
      "number.positive": "Selling price must be positive",
      "any.required": "Selling price is required",
    }),
  }),
};

export const validateRequest = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      logger.error("Validation schema not found", { schemaName });
      return responseHandler.error(res, "Internal validation error", 500);
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }));

      return responseHandler.validationError(res, validationErrors);
    }

    req.body = value;
    next();
  };
};

export default schemas;
