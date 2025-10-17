import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

const schemas = {
  createTable: Joi.object({
    tableNumber: Joi.string()
      .min(1)
      .max(20)
      .pattern(/^[A-Z0-9-_]+$/)
      .required()
      .messages({
        "string.min": "Table number must be at least 1 character",
        "string.max": "Table number must not exceed 20 characters",
        "string.pattern.base":
          "Table number can only contain uppercase letters, numbers, hyphens and underscores",
        "any.required": "Table number is required",
      }),

    tableType: Joi.string()
      .valid("DOUBLE", "TRIPLE", "QUAD", "FAMILY")
      .required()
      .messages({
        "any.only": "Table type must be one of: DOUBLE, TRIPLE, QUAD, FAMILY",
        "any.required": "Table type is required",
      }),

    capacity: Joi.number().integer().min(1).max(20).required().messages({
      "number.integer": "Capacity must be a whole number",
      "number.min": "Capacity must be at least 1",
      "number.max": "Capacity cannot exceed 20 people",
      "any.required": "Capacity is required",
    }),

    locationDescription: Joi.string().max(200).allow("", null).messages({
      "string.max": "Location description must not exceed 200 characters",
    }),
  }),

  updateTable: Joi.object({
    tableNumber: Joi.string()
      .min(1)
      .max(20)
      .pattern(/^[A-Z0-9-_]+$/)
      .messages({
        "string.min": "Table number must be at least 1 character",
        "string.max": "Table number must not exceed 20 characters",
        "string.pattern.base":
          "Table number can only contain uppercase letters, numbers, hyphens and underscores",
      }),

    tableType: Joi.string()
      .valid("DOUBLE", "TRIPLE", "QUAD", "FAMILY")
      .messages({
        "any.only": "Table type must be one of: DOUBLE, TRIPLE, QUAD, FAMILY",
      }),

    capacity: Joi.number().integer().min(1).max(20).messages({
      "number.integer": "Capacity must be a whole number",
      "number.min": "Capacity must be at least 1",
      "number.max": "Capacity cannot exceed 20 people",
    }),

    locationDescription: Joi.string().max(200).allow("", null).messages({
      "string.max": "Location description must not exceed 200 characters",
    }),

    isActive: Joi.boolean(),
  }).min(1),

  updateTableStatus: Joi.object({
    status: Joi.string()
      .valid("AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING")
      .required()
      .messages({
        "any.only":
          "Status must be one of: AVAILABLE, OCCUPIED, RESERVED, CLEANING",
        "any.required": "Status is required",
      }),
  }),

  bulkStatusUpdate: Joi.object({
    tableIds: Joi.array()
      .items(Joi.number().integer().positive())
      .min(1)
      .max(50)
      .required()
      .messages({
        "array.min": "At least one table ID is required",
        "array.max": "Maximum 50 tables can be updated at once",
        "any.required": "Table IDs are required",
      }),

    status: Joi.string()
      .valid("AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING")
      .required()
      .messages({
        "any.only":
          "Status must be one of: AVAILABLE, OCCUPIED, RESERVED, CLEANING",
        "any.required": "Status is required",
      }),
  }),

  resetTables: Joi.object({
    resetAll: Joi.boolean().required(),
    status: Joi.string()
      .valid("AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING")
      .default("AVAILABLE")
      .messages({
        "any.only":
          "Status must be one of: AVAILABLE, OCCUPIED, RESERVED, CLEANING",
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

// Additional validation for query parameters
export const validateQuery = (req, res, next) => {
  const querySchema = Joi.object({
    status: Joi.string().valid("AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"),
    tableType: Joi.string().valid("DOUBLE", "TRIPLE", "QUAD", "FAMILY"),
    capacity: Joi.number().integer().min(1).max(20),
    includeInactive: Joi.boolean().default(false),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });

  const { error, value } = querySchema.validate(req.query, {
    allowUnknown: true,
    stripUnknown: false, // Keep unknown fields
  });

  if (error) {
    const validationErrors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
      value: detail.context?.value,
    }));

    return responseHandler.validationError(res, validationErrors);
  }

  // Instead of modifying req.query, add validated data to a new property
  req.validatedQuery = value;
  next();
};

export default schemas;
