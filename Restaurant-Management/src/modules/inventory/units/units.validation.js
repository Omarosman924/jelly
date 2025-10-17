import Joi from "joi";
import { responseHandler } from "../../../utils/response.js";
import logger from "../../../utils/logger.js";
import { ValidationError } from "../../../middleware/errorHandler.js";
import { getDatabaseClient } from "../../../utils/database.js";

/**
 * Production-Ready Units Validation
 * Enhanced validation with security, business rules, and monitoring
 */

// Enhanced validation schemas
const schemas = {
  createUnit: Joi.object({
    unitNameAr: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[\u0600-\u06FF\s]+$/)
      .required()
      .trim()
      .messages({
        "string.min": "Arabic unit name must be at least 2 characters",
        "string.max": "Arabic unit name must not exceed 50 characters",
        "string.pattern.base":
          "Arabic unit name can only contain Arabic letters and spaces",
        "any.required": "Arabic unit name is required",
        "string.empty": "Arabic unit name cannot be empty",
      }),

    unitNameEn: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .trim()
      .messages({
        "string.min": "English unit name must be at least 2 characters",
        "string.max": "English unit name must not exceed 50 characters",
        "string.pattern.base":
          "English unit name can only contain English letters and spaces",
        "any.required": "English unit name is required",
        "string.empty": "English unit name cannot be empty",
      }),

    unitSymbol: Joi.string()
      .min(1)
      .max(10)
      .pattern(/^[a-zA-Z0-9]+$/)
      .required()
      .trim()
      .lowercase()
      .custom((value, helpers) => {
        // Check for reserved symbols
        const reserved = [
          "null",
          "undefined",
          "nan",
          "true",
          "false",
          "infinity",
          "void",
          "nil",
        ];
        if (reserved.includes(value.toLowerCase())) {
          return helpers.error("custom.reserved", { symbol: value });
        }
        return value;
      })
      .messages({
        "string.min": "Unit symbol must be at least 1 character",
        "string.max": "Unit symbol must not exceed 10 characters",
        "string.pattern.base":
          "Unit symbol can only contain letters and numbers (no spaces or special characters)",
        "any.required": "Unit symbol is required",
        "string.empty": "Unit symbol cannot be empty",
        "custom.reserved":
          "Unit symbol '{{#symbol}}' is reserved and cannot be used",
      }),

    description: Joi.string().max(200).allow("", null).trim().messages({
      "string.max": "Description must not exceed 200 characters",
    }),

    isActive: Joi.boolean().default(true).messages({
      "boolean.base": "Active status must be true or false",
    }),
  }),

  updateUnit: Joi.object({
    unitNameAr: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[\u0600-\u06FF\s]+$/)
      .trim()
      .messages({
        "string.min": "Arabic unit name must be at least 2 characters",
        "string.max": "Arabic unit name must not exceed 50 characters",
        "string.pattern.base":
          "Arabic unit name can only contain Arabic letters and spaces",
      }),

    unitNameEn: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s]+$/)
      .trim()
      .messages({
        "string.min": "English unit name must be at least 2 characters",
        "string.max": "English unit name must not exceed 50 characters",
        "string.pattern.base":
          "English unit name can only contain English letters and spaces",
      }),

    unitSymbol: Joi.string()
      .min(1)
      .max(10)
      .pattern(/^[a-zA-Z0-9]+$/)
      .trim()
      .lowercase()
      .custom((value, helpers) => {
        const reserved = [
          "null",
          "undefined",
          "nan",
          "true",
          "false",
          "infinity",
          "void",
          "nil",
        ];
        if (reserved.includes(value.toLowerCase())) {
          return helpers.error("custom.reserved", { symbol: value });
        }
        return value;
      })
      .messages({
        "string.min": "Unit symbol must be at least 1 character",
        "string.max": "Unit symbol must not exceed 10 characters",
        "string.pattern.base":
          "Unit symbol can only contain letters and numbers",
        "custom.reserved":
          "Unit symbol '{{#symbol}}' is reserved and cannot be used",
      }),

    description: Joi.string().max(200).allow("", null).trim().messages({
      "string.max": "Description must not exceed 200 characters",
    }),

    isActive: Joi.boolean().messages({
      "boolean.base": "Active status must be true or false",
    }),
  })
    .min(1)
    .messages({
      "object.min": "At least one field is required for update",
    }),

  // Query parameter validation - FIXED: Better handling for query params
  queryParams: Joi.object({
    page: Joi.alternatives()
      .try(
        Joi.number().integer().min(1).max(1000),
        Joi.string()
          .pattern(/^\d+$/)
          .custom((value) => parseInt(value))
      )
      .default(1)
      .messages({
        "alternatives.match": "Page must be a valid number",
        "number.min": "Page must be at least 1",
        "number.max": "Page cannot exceed 1000",
      }),

    limit: Joi.alternatives()
      .try(
        Joi.number().integer().min(1).max(100),
        Joi.string()
          .pattern(/^\d+$/)
          .custom((value) => parseInt(value))
      )
      .default(50)
      .messages({
        "alternatives.match": "Limit must be a valid number",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit cannot exceed 100",
      }),

    search: Joi.string()
      .min(1)
      .max(100)
      .trim()
      .pattern(/^[a-zA-Z\u0600-\u06FF0-9\s]+$/)
      .allow("")
      .optional()
      .messages({
        "string.min": "Search query must be at least 1 character",
        "string.max": "Search query cannot exceed 100 characters",
        "string.pattern.base": "Search query contains invalid characters",
      }),

    isActive: Joi.alternatives()
      .try(
        Joi.boolean(),
        Joi.string()
          .valid("true", "false")
          .custom((value) => value === "true")
      )
      .optional()
      .messages({
        "alternatives.match":
          "isActive must be a boolean or 'true'/'false' string",
      }),

    sortBy: Joi.string()
      .valid("unitNameAr", "unitNameEn", "unitSymbol", "createdAt")
      .default("unitNameEn")
      .messages({
        "any.only":
          "sortBy must be one of: unitNameAr, unitNameEn, unitSymbol, createdAt",
      }),

    sortOrder: Joi.string().valid("asc", "desc").default("asc").messages({
      "any.only": "sortOrder must be either 'asc' or 'desc'",
    }),
  }),

  // ID parameter validation
  idParam: Joi.object({
    id: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string()
          .pattern(/^\d+$/)
          .custom((value) => parseInt(value))
      )
      .required()
      .messages({
        "alternatives.match": "ID must be a valid positive number",
        "any.required": "ID is required",
      }),
  }),

  // Symbol validation
  symbolValidation: Joi.object({
    unitSymbol: Joi.string()
      .min(1)
      .max(10)
      .pattern(/^[a-zA-Z0-9]+$/)
      .required()
      .trim()
      .messages({
        "string.min": "Unit symbol must be at least 1 character",
        "string.max": "Unit symbol must not exceed 10 characters",
        "string.pattern.base":
          "Unit symbol can only contain letters and numbers",
        "any.required": "Unit symbol is required",
      }),

    excludeId: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string()
          .pattern(/^\d+$/)
          .custom((value) => parseInt(value))
      )
      .optional()
      .messages({
        "alternatives.match": "Exclude ID must be a valid positive number",
      }),
  }),
};

/**
 * Create validation middleware with enhanced error handling - FIXED
 */
const createValidator = (schemaName, source = "body") => {
  return async (req, res, next) => {
    const startTime = Date.now();

    try {
      const schema = schemas[schemaName];

      if (!schema) {
        logger.error("Validation schema not found", {
          schemaName,
          availableSchemas: Object.keys(schemas),
          source,
          requestUrl: req.originalUrl,
          method: req.method,
        });
        return responseHandler.error(res, "Internal validation error", 500);
      }

      let dataToValidate;
      switch (source) {
        case "params":
          dataToValidate = req.params;
          break;
        case "query":
          dataToValidate = req.query;
          break;
        case "body":
        default:
          dataToValidate = req.body;
          break;
      }

      // Log validation attempt for debugging
      if (process.env.NODE_ENV === "development") {
        logger.debug("Validation attempt", {
          schemaName,
          source,
          dataToValidate,
          requestUrl: req.originalUrl,
        });
      }

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        const validationErrors = error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
          value: detail.context?.value,
          type: detail.type,
        }));

        // Log validation failures for monitoring
        logger.warn("Validation failed", {
          schemaName,
          source,
          errors: validationErrors,
          userId: req.user?.id,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          processingTime: Date.now() - startTime,
          requestUrl: req.originalUrl,
        });

        return responseHandler.validationError(
          res,
          validationErrors,
          "Input validation failed"
        );
      }

      // Replace validated data
      switch (source) {
        case "params":
          req.params = value;
          break;
        case "query":
          req.query = value;
          break;
        case "body":
        default:
          req.body = value;
          break;
      }

      // Log successful validation in debug mode
      if (process.env.NODE_ENV === "development") {
        logger.debug("Validation successful", {
          schemaName,
          source,
          validatedData: value,
          processingTime: Date.now() - startTime,
        });
      }

      next();
    } catch (error) {
      logger.error("Validation middleware error", {
        schemaName,
        source,
        error: error.message,
        stack: error.stack,
        requestUrl: req.originalUrl,
        method: req.method,
        userId: req.user?.id,
      });

      return responseHandler.error(res, "Validation processing error", 500);
    }
  };
};

/**
 * Business rules validation middleware - FIXED
 */
const validateBusinessRules = async (req, res, next) => {
  try {
    const { unitSymbol, unitNameAr, unitNameEn } = req.body;
    const unitId = req.params.id ? parseInt(req.params.id) : null;

    // Skip validation if no relevant fields
    if (!unitSymbol && !unitNameAr && !unitNameEn) {
      return next();
    }

    // Check for duplicate symbols/names in database
    const db = getDatabaseClient();
    const whereConditions = [];

    if (unitSymbol) whereConditions.push({ unitSymbol });
    if (unitNameAr) whereConditions.push({ unitNameAr });
    if (unitNameEn) whereConditions.push({ unitNameEn });

    const existingUnit = await db.unit.findFirst({
      where: {
        AND: [
          { OR: whereConditions },
          { deletedAt: null },
          unitId ? { id: { not: unitId } } : {},
        ],
      },
      select: {
        id: true,
        unitSymbol: true,
        unitNameAr: true,
        unitNameEn: true,
      },
    });

    if (existingUnit) {
      const conflicts = [];
      if (unitSymbol && existingUnit.unitSymbol === unitSymbol) {
        conflicts.push({
          field: "unitSymbol",
          message: `Unit symbol '${unitSymbol}' already exists`,
          conflictsWith: existingUnit.id,
        });
      }
      if (unitNameAr && existingUnit.unitNameAr === unitNameAr) {
        conflicts.push({
          field: "unitNameAr",
          message: `Arabic unit name '${unitNameAr}' already exists`,
          conflictsWith: existingUnit.id,
        });
      }
      if (unitNameEn && existingUnit.unitNameEn === unitNameEn) {
        conflicts.push({
          field: "unitNameEn",
          message: `English unit name '${unitNameEn}' already exists`,
          conflictsWith: existingUnit.id,
        });
      }

      return responseHandler.validationError(
        res,
        conflicts,
        "Duplicate unit data"
      );
    }

    next();
  } catch (error) {
    logger.error("Business rules validation error", {
      error: error.message,
      stack: error.stack,
      unitData: req.body,
      userId: req.user?.id,
      requestUrl: req.originalUrl,
    });

    // Continue without business validation if database is unavailable
    next();
  }
};

/**
 * Security validation middleware - SIMPLIFIED
 */
const validateSecurity = (req, res, next) => {
  try {
    // Check for malicious patterns
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /expression\s*\(/i,
    ];

    const checkData = (obj) => {
      for (const [key, value] of Object.entries(obj || {})) {
        if (typeof value === "string") {
          for (const pattern of maliciousPatterns) {
            if (pattern.test(value)) {
              throw new ValidationError(
                `Potentially malicious content detected in ${key}`
              );
            }
          }
        }
      }
    };

    // Check body, query, and params
    checkData(req.body);
    checkData(req.query);
    checkData(req.params);

    next();
  } catch (error) {
    logger.warn("Security validation failed", {
      error: error.message,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id,
      requestUrl: req.originalUrl,
    });

    return responseHandler.error(res, "Security validation failed", 400);
  }
};

/**
 * Exported validation middleware combinations - SIMPLIFIED
 */
export const unitsValidation = {
  // Create unit validation
  createUnit: [
    validateSecurity,
    createValidator("createUnit"),
    validateBusinessRules,
  ],

  // Update unit validation
  updateUnit: [
    validateSecurity,
    createValidator("idParam", "params"),
    createValidator("updateUnit"),
    validateBusinessRules,
  ],

  // Delete unit validation
  deleteUnit: [validateSecurity, createValidator("idParam", "params")],

  // Get operations validation - SIMPLIFIED FOR GET ALL
  getAll: [validateSecurity, createValidator("queryParams", "query")],

  getById: [validateSecurity, createValidator("idParam", "params")],

  search: [validateSecurity, createValidator("queryParams", "query")],

  // Symbol validation
  validateSymbol: [validateSecurity, createValidator("symbolValidation")],
};

/**
 * Utility functions
 */
export const validationUtils = {
  /**
   * Sanitize input data
   */
  sanitizeInput: (data) => {
    if (typeof data === "string") {
      return data
        .trim()
        .replace(/[<>]/g, "") // Remove potential HTML
        .substring(0, 1000); // Limit length
    }
    return data;
  },

  /**
   * Check if unit symbol follows conventions
   */
  validateSymbolConventions: (symbol) => {
    const commonSymbols = {
      // Weight
      kg: "kilogram",
      g: "gram",
      mg: "milligram",
      lb: "pound",
      oz: "ounce",

      // Volume
      l: "liter",
      ml: "milliliter",
      cup: "cup",
      tbsp: "tablespoon",
      tsp: "teaspoon",

      // Count
      pcs: "pieces",
      pair: "pair",
      dz: "dozen",
    };

    return {
      isCommon: symbol.toLowerCase() in commonSymbols,
      suggestion: commonSymbols[symbol.toLowerCase()] || null,
    };
  },
};

export default unitsValidation;
