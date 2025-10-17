import Joi from "joi";
import { responseHandler } from "../../../utils/response.js";
import logger from "../../../utils/logger.js";

const schemas = {
  createSupplier: Joi.object({
    supplierName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Supplier name must be at least 2 characters",
      "string.max": "Supplier name must not exceed 100 characters",
      "any.required": "Supplier name is required",
    }),

    taxNumber: Joi.string()
      .pattern(/^[0-9]{15}$/)
      .messages({
        "string.pattern.base": "Tax number must be 15 digits",
      }),

    commercialRegister: Joi.string().min(10).max(20).messages({
      "string.min": "Commercial register must be at least 10 characters",
      "string.max": "Commercial register must not exceed 20 characters",
    }),

    nationalAddress: Joi.string().max(500).messages({
      "string.max": "National address must not exceed 500 characters",
    }),

    representativeName: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/)
      .messages({
        "string.min": "Representative name must be at least 2 characters",
        "string.max": "Representative name must not exceed 100 characters",
        "string.pattern.base":
          "Representative name can only contain letters and spaces",
      }),

    representativePhone: Joi.string()
      .pattern(/^(\+966|966|0)?[5][0-9]{8}$/)
      .messages({
        "string.pattern.base": "Please provide a valid Saudi phone number",
      }),

    contactEmail: Joi.string().email().messages({
      "string.email": "Please provide a valid email address",
    }),
  }),

  updateSupplier: Joi.object({
    supplierName: Joi.string().min(2).max(100),

    taxNumber: Joi.string().pattern(/^[0-9]{15}$/),

    commercialRegister: Joi.string().min(10).max(20),

    nationalAddress: Joi.string().max(500),

    representativeName: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/),

    representativePhone: Joi.string().pattern(/^(\+966|966|0)?[5][0-9]{8}$/),

    contactEmail: Joi.string().email(),

    isActive: Joi.boolean(),
  }).min(1),
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
