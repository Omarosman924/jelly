import Joi from "joi";
import { responseHandler } from "../../../utils/response.js";
import logger from "../../../utils/logger.js";

const schemas = {
  createWasteRequest: Joi.object({
    itemId: Joi.number().integer().positive().required().messages({
      "number.positive": "Item ID must be positive",
      "any.required": "Item is required",
    }),

    wasteQuantity: Joi.number().positive().precision(3).required().messages({
      "number.positive": "Waste quantity must be positive",
      "any.required": "Waste quantity is required",
    }),

    reason: Joi.string().min(10).max(500).required().messages({
      "string.min": "Reason must be at least 10 characters",
      "string.max": "Reason must not exceed 500 characters",
      "any.required": "Reason for waste is required",
    }),
  }),

  approveRequest: Joi.object({
    adminNotes: Joi.string().max(500).allow("", null).messages({
      "string.max": "Admin notes must not exceed 500 characters",
    }),
  }),

  rejectRequest: Joi.object({
    adminNotes: Joi.string().min(10).max(500).required().messages({
      "string.min": "Rejection reason must be at least 10 characters",
      "string.max": "Rejection reason must not exceed 500 characters",
      "any.required": "Rejection reason is required",
    }),
  }),

  bulkApprove: Joi.object({
    requestIds: Joi.array()
      .items(Joi.number().integer().positive())
      .min(1)
      .max(20)
      .required()
      .messages({
        "array.min": "At least one request ID is required",
        "array.max": "Maximum 20 requests can be approved at once",
        "any.required": "Request IDs are required",
      }),

    adminNotes: Joi.string().max(500).allow("", null).messages({
      "string.max": "Admin notes must not exceed 500 characters",
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
