import Joi from "joi";
import { responseHandler } from "../../../utils/response.js";
import logger from "../../../utils/logger.js";

const schemas = {
  createItem: Joi.object({
    itemCode: Joi.string().alphanum().min(3).max(20).required().messages({
      "string.alphanum": "Item code must contain only letters and numbers",
      "string.min": "Item code must be at least 3 characters",
      "string.max": "Item code must not exceed 20 characters",
      "any.required": "Item code is required",
    }),
    itemNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[\u0600-\u06FF\s]+$/)
      .required()
      .messages({
        "string.min": "Arabic name must be at least 2 characters",
        "string.max": "Arabic name must not exceed 100 characters",
        "string.pattern.base":
          "Arabic name can only contain Arabic letters and spaces",
        "any.required": "Arabic name is required",
      }),
    itemNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .messages({
        "string.min": "English name must be at least 2 characters",
        "string.max": "English name must not exceed 100 characters",
        "string.pattern.base":
          "English name can only contain English letters and spaces",
        "any.required": "English name is required",
      }),
    description: Joi.string().max(500).allow("", null),
    unitId: Joi.number().integer().positive().required().messages({
      "number.positive": "Unit ID must be positive",
      "any.required": "Unit is required",
    }),
    itemType: Joi.string().valid("CONSUMABLE", "PAYABLE").required().messages({
      "any.only": "Item type must be either CONSUMABLE or PAYABLE",
      "any.required": "Item type is required",
    }),
    costPrice: Joi.number().positive().precision(2).required().messages({
      "number.positive": "Cost price must be positive",
      "any.required": "Cost price is required",
    }),
    sellingPrice: Joi.number().positive().precision(2).required().messages({
      "number.positive": "Selling price must be positive",
      "any.required": "Selling price is required",
    }),
    minStockLevel: Joi.number().min(0).precision(2).required().messages({
      "number.min": "Minimum stock level cannot be negative",
      "any.required": "Minimum stock level is required",
    }),
    caloriesPerUnit: Joi.number().integer().min(0),
    imageUrl: Joi.string().uri().allow("", null),
    initialStock: Joi.number().min(0).precision(2).default(0),
  }),

  updateItem: Joi.object({
    itemCode: Joi.string().alphanum().min(3).max(20),
    itemNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[\u0600-\u06FF\s]+$/),
    itemNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s]+$/),
    description: Joi.string().max(500).allow("", null),
    unitId: Joi.number().integer().positive(),
    itemType: Joi.string().valid("CONSUMABLE", "PAYABLE"),
    costPrice: Joi.number().positive().precision(2),
    sellingPrice: Joi.number().positive().precision(2),
    minStockLevel: Joi.number().min(0).precision(2),
    caloriesPerUnit: Joi.number().integer().min(0),
    imageUrl: Joi.string().uri().allow("", null),
    isAvailable: Joi.boolean(),
  }).min(1),

  adjustStock: Joi.object({
    quantity: Joi.number().required().messages({
      "any.required": "Quantity is required",
    }),
    reason: Joi.string().min(3).max(200).required().messages({
      "string.min": "Reason must be at least 3 characters",
      "string.max": "Reason must not exceed 200 characters",
      "any.required": "Reason is required",
    }),
    referenceId: Joi.number().integer().positive(),
    referenceType: Joi.string().max(50),
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
