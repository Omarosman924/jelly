import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

/**
 * Parties Validation Schemas
 */

const schemas = {
  // ==================== PARTY TYPES VALIDATION ====================

  createPartyType: Joi.object({
    typeName: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[\u0600-\u06FFa-zA-Z\s]+$/)
      .required()
      .messages({
        "string.min": "Party type name must be at least 2 characters",
        "string.max": "Party type name must not exceed 100 characters",
        "string.pattern.base":
          "Party type name can only contain Arabic/English letters and spaces",
        "any.required": "Party type name is required",
      }),

    description: Joi.string().max(500).allow("", null),

    imageUrl: Joi.string().uri().allow("", null).messages({
      "string.uri": "Image URL must be a valid URL",
    }),

    pricePerPerson: Joi.number()
      .positive()
      .precision(2)
      .max(10000)
      .required()
      .messages({
        "number.positive": "Price per person must be positive",
        "number.max": "Price per person cannot exceed 10,000 SAR",
        "any.required": "Price per person is required",
      }),
  }),

  updatePartyType: Joi.object({
    typeName: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[\u0600-\u06FFa-zA-Z\s]+$/),

    description: Joi.string().max(500).allow("", null),

    imageUrl: Joi.string().uri().allow("", null),

    pricePerPerson: Joi.number().positive().precision(2).max(10000),

    isActive: Joi.boolean(),
  }).min(1),

  // ==================== PARTY ORDERS VALIDATION ====================

  createPartyOrder: Joi.object({
    partyTypeId: Joi.number().integer().positive().required().messages({
      "number.positive": "Party type ID must be positive",
      "any.required": "Party type ID is required",
    }),

    customerId: Joi.number().integer().positive().when("$userRole", {
      is: "END_USER",
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),

    numberOfPeople: Joi.number()
      .integer()
      .min(10)
      .max(1000)
      .required()
      .messages({
        "number.min": "Minimum number of people is 10",
        "number.max": "Maximum number of people is 1000",
        "any.required": "Number of people is required",
      }),

    eventDateTime: Joi.date().min("now").iso().required().messages({
      "date.min": "Event date must be in the future",
      "any.required": "Event date and time is required",
    }),

    locationType: Joi.string()
      .valid("RESTAURANT", "EXTERNAL")
      .default("RESTAURANT")
      .messages({
        "any.only": "Location type must be either RESTAURANT or EXTERNAL",
      }),

    serviceType: Joi.string()
      .valid("COOKING_ONLY", "FULL_SERVICE")
      .default("FULL_SERVICE")
      .messages({
        "any.only": "Service type must be either COOKING_ONLY or FULL_SERVICE",
      }),

    specialRequests: Joi.string().max(1000).allow("", null).messages({
      "string.max": "Special requests cannot exceed 1000 characters",
    }),
  }),

  updatePartyOrder: Joi.object({
    partyTypeId: Joi.number().integer().positive(),

    numberOfPeople: Joi.number().integer().min(10).max(1000),

    eventDateTime: Joi.date().min("now").iso(),

    locationType: Joi.string().valid("RESTAURANT", "EXTERNAL"),

    serviceType: Joi.string().valid("COOKING_ONLY", "FULL_SERVICE"),

    specialRequests: Joi.string().max(1000).allow("", null),
  }).min(1),

  updatePartyOrderStatus: Joi.object({
    status: Joi.string()
      .valid("PENDING", "CONFIRMED", "PREPARING", "COMPLETED", "CANCELLED")
      .required()
      .messages({
        "any.only":
          "Status must be one of: PENDING, CONFIRMED, PREPARING, COMPLETED, CANCELLED",
        "any.required": "Status is required",
      }),

    notes: Joi.string().max(500).allow("", null),
  }),

  cancelPartyOrder: Joi.object({
    cancellationReason: Joi.string().min(10).max(500).required().messages({
      "string.min": "Cancellation reason must be at least 10 characters",
      "string.max": "Cancellation reason cannot exceed 500 characters",
      "any.required": "Cancellation reason is required",
    }),
  }),

  // ==================== UTILITY VALIDATION ====================

  calculateCost: Joi.object({
    partyTypeId: Joi.number().integer().positive().required(),

    numberOfPeople: Joi.number().integer().min(10).max(1000).required(),

    locationType: Joi.string()
      .valid("RESTAURANT", "EXTERNAL")
      .default("RESTAURANT"),

    serviceType: Joi.string()
      .valid("COOKING_ONLY", "FULL_SERVICE")
      .default("FULL_SERVICE"),
  }),

  // ==================== QUERY PARAMETER VALIDATION ====================

  getPartyOrdersQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    customerId: Joi.number().integer().positive(),
    status: Joi.string().valid(
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "COMPLETED",
      "CANCELLED"
    ),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref("dateFrom")),
    sortBy: Joi.string()
      .valid("createdAt", "eventDateTime", "totalAmount", "status")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),

  getPartyTypesQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(100),
    isActive: Joi.string().valid("true", "false"),
    sortBy: Joi.string()
      .valid("createdAt", "typeName", "pricePerPerson")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),

  getPartyStatsQuery: Joi.object({
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref("dateFrom")),
    partyTypeId: Joi.number().integer().positive(),
  }),

  getUpcomingOrdersQuery: Joi.object({
    days: Joi.number().integer().min(1).max(30).default(7),
  }),

  generateReportQuery: Joi.object({
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref("dateFrom")),
    format: Joi.string().valid("json", "pdf", "excel").default("json"),
  }),
};

/**
 * Custom validation for business rules
 */
const customValidations = {
  /**
   * Validate event date is at least 24 hours in advance
   */
  validateEventDateTime: (value, helpers) => {
    const eventDate = new Date(value);
    const now = new Date();
    const minAdvanceHours = 24;

    const hoursDifference = (eventDate - now) / (1000 * 60 * 60);

    if (hoursDifference < minAdvanceHours) {
      return helpers.error("custom.eventDateTime", {
        message: `Event must be scheduled at least ${minAdvanceHours} hours in advance`,
      });
    }

    return value;
  },

  /**
   * Validate working hours (9 AM to 11 PM)
   */
  validateWorkingHours: (value, helpers) => {
    const eventDate = new Date(value);
    const hour = eventDate.getHours();

    if (hour < 9 || hour > 23) {
      return helpers.error("custom.workingHours", {
        message: "Events can only be scheduled between 9 AM and 11 PM",
      });
    }

    return value;
  },
};

// Apply custom validations to event date time
schemas.createPartyOrder = schemas.createPartyOrder.keys({
  eventDateTime: schemas.createPartyOrder
    .extract("eventDateTime")
    .custom(customValidations.validateEventDateTime)
    .custom(customValidations.validateWorkingHours),
});

schemas.updatePartyOrder = schemas.updatePartyOrder.keys({
  eventDateTime: Joi.date()
    .min("now")
    .iso()
    .custom(customValidations.validateEventDateTime)
    .custom(customValidations.validateWorkingHours),
});

/**
 * Validation middleware factory
 */
export const validateRequest = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      logger.error("Validation schema not found", { schemaName });
      return responseHandler.error(res, "Internal validation error", 500);
    }

    // For query parameter validation
    const dataToValidate = schemaName.includes("Query") ? req.query : req.body;

    // Add context for conditional validation
    const context = {
      userRole: req.user?.role,
      userId: req.user?.id,
      customerId: req.user?.customer?.id,
    };

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
      context,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type,
      }));

      logger.debug("Validation failed", {
        schema: schemaName,
        errors: validationErrors,
        path: req.originalUrl,
      });

      return responseHandler.validationError(res, validationErrors);
    }

    // Replace request data with validated and sanitized data
    if (schemaName.includes("Query")) {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
};

/**
 * Validate query parameters middleware
 */
export const validateQuery = (schemaName) => {
  return validateRequest(schemaName);
};

export default schemas;
