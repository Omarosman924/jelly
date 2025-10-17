import Joi from "joi";
import { responseHandler } from "../../../utils/response.js";
import logger from "../../../utils/logger.js";

const schemas = {
  createRecipe: Joi.object({
    recipeCode: Joi.string().alphanum().min(3).max(20).required().messages({
      "string.alphanum": "Recipe code must contain only letters and numbers",
      "string.min": "Recipe code must be at least 3 characters",
      "string.max": "Recipe code must not exceed 20 characters",
      "any.required": "Recipe code is required",
    }),

    recipeNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[\u0600-\u06FF\s]+$/)
      .required()
      .messages({
        "string.min": "Arabic recipe name must be at least 2 characters",
        "string.max": "Arabic recipe name must not exceed 100 characters",
        "string.pattern.base":
          "Arabic recipe name can only contain Arabic letters and spaces",
        "any.required": "Arabic recipe name is required",
      }),

    recipeNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .messages({
        "string.min": "English recipe name must be at least 2 characters",
        "string.max": "English recipe name must not exceed 100 characters",
        "string.pattern.base":
          "English recipe name can only contain English letters and spaces",
        "any.required": "English recipe name is required",
      }),

    description: Joi.string().max(500).allow("", null),

    preparationTime: Joi.number()
      .integer()
      .min(1)
      .max(480) // Max 8 hours
      .required()
      .messages({
        "number.min": "Preparation time must be at least 1 minute",
        "number.max": "Preparation time must not exceed 480 minutes (8 hours)",
        "any.required": "Preparation time is required",
      }),

    imageUrl: Joi.string().uri().allow("", null),

    ingredients: Joi.array()
      .items(
        Joi.object({
          itemId: Joi.number().integer().positive().required(),
          quantity: Joi.number().positive().precision(3).required().messages({
            "number.positive": "Ingredient quantity must be positive",
            "any.required": "Ingredient quantity is required",
          }),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one ingredient is required",
        "any.required": "Ingredients are required",
      }),
  }),

  updateRecipe: Joi.object({
    recipeCode: Joi.string().alphanum().min(3).max(20),

    recipeNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[\u0600-\u06FF\s]+$/),

    recipeNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s]+$/),

    description: Joi.string().max(500).allow("", null),

    preparationTime: Joi.number().integer().min(1).max(480),

    sellingPrice: Joi.number().positive().precision(2),

    imageUrl: Joi.string().uri().allow("", null),

    isAvailable: Joi.boolean(),

    ingredients: Joi.array()
      .items(
        Joi.object({
          itemId: Joi.number().integer().positive().required(),
          quantity: Joi.number().positive().precision(3).required(),
        })
      )
      .min(1),
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
