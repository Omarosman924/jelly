import Joi from "joi";
import { responseHandler } from "../../../utils/response.js";
import logger from "../../../utils/logger.js";

const schemas = {
  createCookingMethod: Joi.object({
    methodNameAr: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[\u0600-\u06FF\s]+$/)
      .required()
      .messages({
        "string.min": "Arabic method name must be at least 2 characters",
        "string.max": "Arabic method name must not exceed 50 characters",
        "string.pattern.base":
          "Arabic method name can only contain Arabic letters and spaces",
        "any.required": "Arabic method name is required",
      }),

    methodNameEn: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .messages({
        "string.min": "English method name must be at least 2 characters",
        "string.max": "English method name must not exceed 50 characters",
        "string.pattern.base":
          "English method name can only contain English letters and spaces",
        "any.required": "English method name is required",
      }),

    description: Joi.string().max(200).allow("", null).messages({
      "string.max": "Description must not exceed 200 characters",
    }),

    cookingTime: Joi.number().integer().min(0).max(480).required().messages({
      "number.integer": "Cooking time must be a whole number",
      "number.min": "Cooking time cannot be negative",
      "number.max": "Cooking time cannot exceed 480 minutes (8 hours)",
      "any.required": "Cooking time is required",
    }),

    additionalCost: Joi.number()
      .precision(2)
      .min(0)
      .max(1000)
      .required()
      .messages({
        "number.precision": "Additional cost can have at most 2 decimal places",
        "number.min": "Additional cost cannot be negative",
        "number.max": "Additional cost cannot exceed 1000 SAR",
        "any.required": "Additional cost is required",
      }),
  }),

  updateCookingMethod: Joi.object({
    methodNameAr: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[\u0600-\u06FF\s]+$/)
      .messages({
        "string.min": "Arabic method name must be at least 2 characters",
        "string.max": "Arabic method name must not exceed 50 characters",
        "string.pattern.base":
          "Arabic method name can only contain Arabic letters and spaces",
      }),

    methodNameEn: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/)
      .messages({
        "string.min": "English method name must be at least 2 characters",
        "string.max": "English method name must not exceed 50 characters",
        "string.pattern.base":
          "English method name can only contain English letters and spaces",
      }),

    description: Joi.string().max(200).allow("", null).messages({
      "string.max": "Description must not exceed 200 characters",
    }),

    cookingTime: Joi.number().integer().min(0).max(480).messages({
      "number.integer": "Cooking time must be a whole number",
      "number.min": "Cooking time cannot be negative",
      "number.max": "Cooking time cannot exceed 480 minutes (8 hours)",
    }),

    additionalCost: Joi.number().precision(2).min(0).max(1000).messages({
      "number.precision": "Additional cost can have at most 2 decimal places",
      "number.min": "Additional cost cannot be negative",
      "number.max": "Additional cost cannot exceed 1000 SAR",
    }),

    isAvailable: Joi.boolean(),
  }).min(1),

  bulkUpdateAvailability: Joi.object({
    methodIds: Joi.array()
      .items(Joi.number().integer().positive())
      .min(1)
      .max(20)
      .required()
      .messages({
        "array.min": "At least one method ID is required",
        "array.max": "Maximum 20 methods can be updated at once",
        "any.required": "Method IDs are required",
      }),

    isAvailable: Joi.boolean().required().messages({
      "any.required": "isAvailable status is required",
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
