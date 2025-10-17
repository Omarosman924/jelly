import Joi from "joi";
import { responseHandler } from "../../../utils/response.js";
import logger from "../../../utils/logger.js";

const schemas = {
  createMenu: Joi.object({
    menuNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(
        /^[\u0600-\u06FF\s\u060C\u061B\u061F\u0640\u066A\u066B\u066C\u066D\u200C\u200D]+$/
      )
      .required()
      .messages({
        "string.min": "Arabic menu name must be at least 2 characters",
        "string.max": "Arabic menu name must not exceed 100 characters",
        "string.pattern.base":
          "Arabic menu name can only contain Arabic letters and spaces",
        "any.required": "Arabic menu name is required",
      }),

    menuNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s&'-]+$/)
      .required()
      .messages({
        "string.min": "English menu name must be at least 2 characters",
        "string.max": "English menu name must not exceed 100 characters",
        "string.pattern.base":
          "English menu name can only contain English letters, spaces, and basic punctuation",
        "any.required": "English menu name is required",
      }),

    description: Joi.string().max(500).allow("", null).messages({
      "string.max": "Description must not exceed 500 characters",
    }),

    imageUrl: Joi.string().uri().allow("", null).messages({
      "string.uri": "Image URL must be a valid URL",
    }),

    displayOrder: Joi.number().integer().min(0).max(999).default(0).messages({
      "number.integer": "Display order must be a whole number",
      "number.min": "Display order cannot be negative",
      "number.max": "Display order cannot exceed 999",
    }),

    startDate: Joi.date().iso().allow(null).messages({
      "date.format": "Start date must be in ISO format",
    }),

    endDate: Joi.date()
      .iso()
      .greater(Joi.ref("startDate"))
      .allow(null)
      .messages({
        "date.format": "End date must be in ISO format",
        "date.greater": "End date must be after start date",
      }),

    isActive: Joi.boolean().default(true),
  }),

  updateMenu: Joi.object({
    menuNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(
        /^[\u0600-\u06FF\s\u060C\u061B\u061F\u0640\u066A\u066B\u066C\u066D\u200C\u200D]+$/
      )
      .messages({
        "string.min": "Arabic menu name must be at least 2 characters",
        "string.max": "Arabic menu name must not exceed 100 characters",
        "string.pattern.base":
          "Arabic menu name can only contain Arabic letters and spaces",
      }),

    menuNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s&'-]+$/)
      .messages({
        "string.min": "English menu name must be at least 2 characters",
        "string.max": "English menu name must not exceed 100 characters",
        "string.pattern.base":
          "English menu name can only contain English letters, spaces, and basic punctuation",
      }),

    description: Joi.string().max(500).allow("", null).messages({
      "string.max": "Description must not exceed 500 characters",
    }),

    imageUrl: Joi.string().uri().allow("", null).messages({
      "string.uri": "Image URL must be a valid URL",
    }),

    displayOrder: Joi.number().integer().min(0).max(999).messages({
      "number.integer": "Display order must be a whole number",
      "number.min": "Display order cannot be negative",
      "number.max": "Display order cannot exceed 999",
    }),

    startDate: Joi.date().iso().allow(null).messages({
      "date.format": "Start date must be in ISO format",
    }),

    endDate: Joi.date().iso().allow(null).messages({
      "date.format": "End date must be in ISO format",
    }),

    isActive: Joi.boolean(),
  }).min(1),

  createMenuItem: Joi.object({
    menuId: Joi.number().integer().positive().required().messages({
      "number.integer": "Menu ID must be a whole number",
      "number.positive": "Menu ID must be positive",
      "any.required": "Menu ID is required",
    }),

    categoryId: Joi.number().integer().positive().allow(null).messages({
      "number.integer": "Category ID must be a whole number",
      "number.positive": "Category ID must be positive",
    }),

    // Only one of these should be provided
    itemId: Joi.number().integer().positive().allow(null).messages({
      "number.integer": "Item ID must be a whole number",
      "number.positive": "Item ID must be positive",
    }),

    recipeId: Joi.number().integer().positive().allow(null).messages({
      "number.integer": "Recipe ID must be a whole number",
      "number.positive": "Recipe ID must be positive",
    }),

    mealId: Joi.number().integer().positive().allow(null).messages({
      "number.integer": "Meal ID must be a whole number",
      "number.positive": "Meal ID must be positive",
    }),

    displayOrder: Joi.number().integer().min(0).max(999).default(0).messages({
      "number.integer": "Display order must be a whole number",
      "number.min": "Display order cannot be negative",
      "number.max": "Display order cannot exceed 999",
    }),

    specialPrice: Joi.number().precision(2).positive().allow(null).messages({
      "number.precision": "Special price can have at most 2 decimal places",
      "number.positive": "Special price must be positive",
    }),

    isAvailable: Joi.boolean().default(true),
    isRecommended: Joi.boolean().default(false),
  }).custom((value, helpers) => {
    // Ensure exactly one of itemId, recipeId, or mealId is provided
    const providedIds = [value.itemId, value.recipeId, value.mealId].filter(
      (id) => id !== null && id !== undefined
    );

    if (providedIds.length === 0) {
      return helpers.error("object.missingRequired", {
        message: "One of itemId, recipeId, or mealId must be provided",
      });
    }

    if (providedIds.length > 1) {
      return helpers.error("object.conflictingValues", {
        message: "Only one of itemId, recipeId, or mealId can be provided",
      });
    }

    return value;
  }),

  updateMenuItem: Joi.object({
    categoryId: Joi.number().integer().positive().allow(null).messages({
      "number.integer": "Category ID must be a whole number",
      "number.positive": "Category ID must be positive",
    }),

    displayOrder: Joi.number().integer().min(0).max(999).messages({
      "number.integer": "Display order must be a whole number",
      "number.min": "Display order cannot be negative",
      "number.max": "Display order cannot exceed 999",
    }),

    specialPrice: Joi.number().precision(2).positive().allow(null).messages({
      "number.precision": "Special price can have at most 2 decimal places",
      "number.positive": "Special price must be positive",
    }),

    isAvailable: Joi.boolean(),
    isRecommended: Joi.boolean(),
  }).min(1),

  bulkUpdateMenuItems: Joi.object({
    menuItemIds: Joi.array()
      .items(Joi.number().integer().positive())
      .min(1)
      .max(50)
      .required()
      .messages({
        "array.min": "At least one menu item ID is required",
        "array.max": "Maximum 50 menu items can be updated at once",
        "any.required": "Menu item IDs are required",
      }),

    updates: Joi.object({
      isAvailable: Joi.boolean(),
      isRecommended: Joi.boolean(),
      categoryId: Joi.number().integer().positive().allow(null),
      specialPrice: Joi.number().precision(2).positive().allow(null),
    })
      .min(1)
      .required(),
  }),

  reorderMenuItems: Joi.object({
    menuId: Joi.number().integer().positive().required().messages({
      "number.integer": "Menu ID must be a whole number",
      "number.positive": "Menu ID must be positive",
      "any.required": "Menu ID is required",
    }),

    itemOrders: Joi.array()
      .items(
        Joi.object({
          menuItemId: Joi.number().integer().positive().required(),
          displayOrder: Joi.number().integer().min(0).max(999).required(),
        })
      )
      .min(1)
      .max(100)
      .required()
      .messages({
        "array.min": "At least one item order is required",
        "array.max": "Maximum 100 items can be reordered at once",
        "any.required": "Item orders are required",
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
