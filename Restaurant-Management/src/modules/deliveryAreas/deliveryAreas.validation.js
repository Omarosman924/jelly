import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

const schemas = {
  createDeliveryArea: Joi.object({
    areaName: Joi.string().min(3).max(100).required().messages({
      "string.min": "Area name must be at least 3 characters",
      "string.max": "Area name must not exceed 100 characters",
      "any.required": "Area name is required",
    }),

    deliveryFee: Joi.number()
      .min(0)
      .max(1000)
      .precision(2)
      .required()
      .messages({
        "number.min": "Delivery fee cannot be negative",
        "number.max": "Delivery fee cannot exceed 1000 SAR",
        "any.required": "Delivery fee is required",
      }),

    estimatedDeliveryTime: Joi.number()
      .integer()
      .min(10)
      .max(300)
      .required()
      .messages({
        "number.min": "Estimated delivery time must be at least 10 minutes",
        "number.max": "Estimated delivery time cannot exceed 300 minutes",
        "any.required": "Estimated delivery time is required",
      }),

    isActive: Joi.boolean().default(true),
  }),

  updateDeliveryArea: Joi.object({
    areaName: Joi.string().min(3).max(100).messages({
      "string.min": "Area name must be at least 3 characters",
      "string.max": "Area name must not exceed 100 characters",
    }),

    deliveryFee: Joi.number().min(0).max(1000).precision(2).messages({
      "number.min": "Delivery fee cannot be negative",
      "number.max": "Delivery fee cannot exceed 1000 SAR",
    }),

    estimatedDeliveryTime: Joi.number().integer().min(10).max(300).messages({
      "number.min": "Estimated delivery time must be at least 10 minutes",
      "number.max": "Estimated delivery time cannot exceed 300 minutes",
    }),

    isActive: Joi.boolean(),
  }).min(1),

  toggleStatus: Joi.object({
    isActive: Joi.boolean().required().messages({
      "any.required": "Status (isActive) is required",
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

      logger.debug("Validation failed", {
        schema: schemaName,
        errors: validationErrors,
        path: req.originalUrl,
      });

      return responseHandler.validationError(res, validationErrors);
    }

    req.body = value;
    next();
  };
};

export default schemas;
