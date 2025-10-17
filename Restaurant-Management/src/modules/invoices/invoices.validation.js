import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

const schemas = {
  generateInvoice: Joi.object({
    orderId: Joi.number().integer().positive().required().messages({
      "number.positive": "Order ID must be positive",
      "any.required": "Order ID is required",
    }),

    isSimplified: Joi.boolean().default(true).messages({
      "boolean.base": "isSimplified must be a boolean value",
    }),
  }),

  cancelInvoice: Joi.object({
    reason: Joi.string().min(10).max(500).required().messages({
      "string.min": "Cancellation reason must be at least 10 characters",
      "string.max": "Cancellation reason must not exceed 500 characters",
      "any.required": "Cancellation reason is required",
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
