import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

/**
 * Customers Validation Schemas
 */

const phoneRegex = /^(\+966|966|0)?[5][0-9]{8}$/;
const saudiTaxNumberRegex = /^[0-9]{15}$/;
const commercialRegisterRegex = /^[0-9]{10}$/;

const schemas = {
  // ==================== CUSTOMER PROFILE VALIDATION ====================

  updateProfile: Joi.object({
    firstName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/)
      .messages({
        "string.min": "First name must be at least 2 characters",
        "string.max": "First name must not exceed 50 characters",
        "string.pattern.base": "First name can only contain letters and spaces",
      }),

    lastName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/)
      .messages({
        "string.min": "Last name must be at least 2 characters",
        "string.max": "Last name must not exceed 50 characters",
        "string.pattern.base": "Last name can only contain letters and spaces",
      }),

    phone: Joi.string().pattern(phoneRegex).messages({
      "string.pattern.base": "Please provide a valid Saudi phone number",
    }),

    email: Joi.string().email().messages({
      "string.email": "Please provide a valid email address",
    }),

    address: Joi.string().max(200).allow("", null),

    city: Joi.string().max(50).allow("", null),

    district: Joi.string().max(50).allow("", null),

    deliveryAreaId: Joi.number().integer().positive(),
  }).min(1),

  updateCustomer: Joi.object({
    firstName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/),

    lastName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/),

    phone: Joi.string().pattern(phoneRegex),

    email: Joi.string().email(),

    address: Joi.string().max(200).allow("", null),

    city: Joi.string().max(50).allow("", null),

    district: Joi.string().max(50).allow("", null),

    deliveryAreaId: Joi.number().integer().positive(),

    loyaltyPoints: Joi.number().integer().min(0),
  }).min(1),

  // ==================== LOYALTY POINTS VALIDATION ====================

  addLoyaltyPoints: Joi.object({
    points: Joi.number().integer().min(1).max(10000).required().messages({
      "number.min": "Points must be at least 1",
      "number.max": "Points cannot exceed 10,000 at once",
      "any.required": "Points amount is required",
    }),

    reason: Joi.string().min(5).max(200).required().messages({
      "string.min": "Reason must be at least 5 characters",
      "string.max": "Reason cannot exceed 200 characters",
      "any.required": "Reason for adding points is required",
    }),
  }),

  redeemLoyaltyPoints: Joi.object({
    points: Joi.number().integer().min(1).max(10000).required().messages({
      "number.min": "Points must be at least 1",
      "number.max": "Points cannot exceed 10,000 at once",
      "any.required": "Points amount is required",
    }),

    reason: Joi.string().min(5).max(200).required().messages({
      "string.min": "Reason must be at least 5 characters",
      "string.max": "Reason cannot exceed 200 characters",
      "any.required": "Reason for redeeming points is required",
    }),
  }),

  // ==================== ADDRESS VALIDATION ====================

  addAddress: Joi.object({
    label: Joi.string().min(2).max(50).required().messages({
      "string.min": "Address label must be at least 2 characters",
      "string.max": "Address label must not exceed 50 characters",
      "any.required": "Address label is required",
    }),

    address: Joi.string().min(10).max(200).required().messages({
      "string.min": "Address must be at least 10 characters",
      "string.max": "Address must not exceed 200 characters",
      "any.required": "Address is required",
    }),

    city: Joi.string().min(2).max(50).required().messages({
      "string.min": "City must be at least 2 characters",
      "string.max": "City must not exceed 50 characters",
      "any.required": "City is required",
    }),

    district: Joi.string().min(2).max(50).required().messages({
      "string.min": "District must be at least 2 characters",
      "string.max": "District must not exceed 50 characters",
      "any.required": "District is required",
    }),

    deliveryAreaId: Joi.number().integer().positive().required().messages({
      "number.positive": "Delivery area ID must be positive",
      "any.required": "Delivery area is required",
    }),

    buildingNumber: Joi.string().max(10).allow("", null),

    floor: Joi.string().max(10).allow("", null),

    apartment: Joi.string().max(10).allow("", null),

    landmark: Joi.string().max(100).allow("", null),

    specialInstructions: Joi.string().max(500).allow("", null),

    latitude: Joi.number().min(-90).max(90),

    longitude: Joi.number().min(-180).max(180),

    isDefault: Joi.boolean().default(false),
  }),

  updateAddress: Joi.object({
    label: Joi.string().min(2).max(50),

    address: Joi.string().min(10).max(200),

    city: Joi.string().min(2).max(50),

    district: Joi.string().min(2).max(50),

    deliveryAreaId: Joi.number().integer().positive(),

    buildingNumber: Joi.string().max(10).allow("", null),

    floor: Joi.string().max(10).allow("", null),

    apartment: Joi.string().max(10).allow("", null),

    landmark: Joi.string().max(100).allow("", null),

    specialInstructions: Joi.string().max(500).allow("", null),

    latitude: Joi.number().min(-90).max(90),

    longitude: Joi.number().min(-180).max(180),

    isDefault: Joi.boolean(),
  }).min(1),

  // ==================== COMPANY CUSTOMER VALIDATION ====================

  createCompanyCustomer: Joi.object({
    customerId: Joi.number().integer().positive().required().messages({
      "number.positive": "Customer ID must be positive",
      "any.required": "Customer ID is required",
    }),

    companyName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Company name must be at least 2 characters",
      "string.max": "Company name must not exceed 100 characters",
      "any.required": "Company name is required",
    }),

    taxNumber: Joi.string().pattern(saudiTaxNumberRegex).required().messages({
      "string.pattern.base": "Tax number must be 15 digits",
      "any.required": "Tax number is required",
    }),

    commercialRegister: Joi.string().pattern(commercialRegisterRegex).messages({
      "string.pattern.base": "Commercial register must be 10 digits",
    }),

    nationalAddress: Joi.string().max(200),

    contactPerson: Joi.string().min(2).max(100).required().messages({
      "string.min": "Contact person name must be at least 2 characters",
      "string.max": "Contact person name must not exceed 100 characters",
      "any.required": "Contact person is required",
    }),

    contactPhone: Joi.string().pattern(phoneRegex).required().messages({
      "string.pattern.base": "Please provide a valid Saudi phone number",
      "any.required": "Contact phone is required",
    }),
  }),

  updateCompanyCustomer: Joi.object({
    companyName: Joi.string().min(2).max(100),

    taxNumber: Joi.string().pattern(saudiTaxNumberRegex).messages({
      "string.pattern.base": "Tax number must be 15 digits",
    }),

    commercialRegister: Joi.string().pattern(commercialRegisterRegex).messages({
      "string.pattern.base": "Commercial register must be 10 digits",
    }),

    nationalAddress: Joi.string().max(200).allow("", null),

    contactPerson: Joi.string().min(2).max(100),

    contactPhone: Joi.string().pattern(phoneRegex).messages({
      "string.pattern.base": "Please provide a valid Saudi phone number",
    }),

    isActive: Joi.boolean(),
  }).min(1),

  // ==================== QUERY VALIDATION ====================

  customersQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(100),
    city: Joi.string().max(50),
    district: Joi.string().max(50),
    deliveryAreaId: Joi.number().integer().positive(),
    loyaltyPointsMin: Joi.number().integer().min(0),
    loyaltyPointsMax: Joi.number().integer().min(0),
    hasOrders: Joi.string().valid("true", "false"),
    sortBy: Joi.string()
      .valid(
        "createdAt",
        "loyaltyPoints",
        "lastOrderDate",
        "firstName",
        "lastName"
      )
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),

  loyaltyHistoryQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid("earned", "redeemed"),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref("dateFrom")).messages({
      "date.min": "End date must be after start date",
    }),
  }),

  customerOrdersQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    status: Joi.string().valid(
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "SERVED",
      "DELIVERED",
      "CANCELLED"
    ),
    orderType: Joi.string().valid(
      "DINE_IN",
      "TAKEAWAY",
      "DELIVERY",
      "PARTY",
      "OPEN_BUFFET"
    ),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref("dateFrom")),
    sortBy: Joi.string()
      .valid("createdAt", "orderDateTime", "totalAmount", "orderStatus")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),

  analyticsQuery: Joi.object({
    period: Joi.string().valid("day", "week", "month", "year").default("month"),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref("dateFrom")),
    city: Joi.string().max(50),
    district: Joi.string().max(50),
  }),

  topCustomersQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10),
    period: Joi.string()
      .valid("month", "quarter", "year", "all")
      .default("all"),
    orderType: Joi.string().valid(
      "DINE_IN",
      "TAKEAWAY",
      "DELIVERY",
      "PARTY",
      "OPEN_BUFFET"
    ),
  }),

  exportQuery: Joi.object({
    format: Joi.string().valid("json", "excel", "csv", "pdf").default("excel"),
    includeOrders: Joi.string().valid("true", "false").default("false"),
    includeLoyalty: Joi.string().valid("true", "false").default("false"),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref("dateFrom")),
    city: Joi.string().max(50),
    district: Joi.string().max(50),
  }),

  companyCustomersQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(100),
    isActive: Joi.string().valid("true", "false"),
    sortBy: Joi.string()
      .valid("createdAt", "companyName", "taxNumber")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),
};

/**
 * Custom validation for business rules
 */
const customValidations = {
  /**
   * Validate Saudi tax number checksum (simplified)
   */
  validateSaudiTaxNumber: (value, helpers) => {
    if (!value) return value;

    // Basic format validation (15 digits)
    if (!/^[0-9]{15}$/.test(value)) {
      return helpers.error("custom.taxNumber", {
        message: "Tax number must be exactly 15 digits",
      });
    }

    // Saudi tax numbers should start with 3
    if (!value.startsWith("3")) {
      return helpers.error("custom.taxNumber", {
        message: "Saudi tax numbers should start with 3",
      });
    }

    return value;
  },

  /**
   * Validate coordinate pairs
   */
  validateCoordinates: (value, helpers, { prefs: { context } }) => {
    const { latitude, longitude } = context || {};

    if ((latitude && !longitude) || (!latitude && longitude)) {
      return helpers.error("custom.coordinates", {
        message: "Both latitude and longitude must be provided together",
      });
    }

    return value;
  },

  /**
   * Validate loyalty points don't exceed maximum allowed
   */
  validateLoyaltyPointsLimit: (value, helpers) => {
    const maxLoyaltyPoints = 100000; // Maximum loyalty points allowed

    if (value > maxLoyaltyPoints) {
      return helpers.error("custom.loyaltyPoints", {
        message: `Loyalty points cannot exceed ${maxLoyaltyPoints}`,
      });
    }

    return value;
  },
};

// Apply custom validations
schemas.createCompanyCustomer = schemas.createCompanyCustomer.keys({
  taxNumber: schemas.createCompanyCustomer
    .extract("taxNumber")
    .custom(customValidations.validateSaudiTaxNumber),
});

schemas.updateCompanyCustomer = schemas.updateCompanyCustomer.keys({
  taxNumber: Joi.string()
    .pattern(saudiTaxNumberRegex)
    .custom(customValidations.validateSaudiTaxNumber),
});

schemas.addAddress = schemas.addAddress.keys({
  latitude: schemas.addAddress
    .extract("latitude")
    .custom(customValidations.validateCoordinates),
  longitude: schemas.addAddress
    .extract("longitude")
    .custom(customValidations.validateCoordinates),
});

schemas.updateAddress = schemas.updateAddress.keys({
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .custom(customValidations.validateCoordinates),
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .custom(customValidations.validateCoordinates),
});

schemas.updateCustomer = schemas.updateCustomer.keys({
  loyaltyPoints: schemas.updateCustomer
    .extract("loyaltyPoints")
    .custom(customValidations.validateLoyaltyPointsLimit),
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

    // Add context for conditional validation
    const context = {
      userRole: req.user?.role,
      userId: req.user?.id,
      customerId: req.user?.customer?.id,
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
    };

    const { error, value } = schema.validate(req.body, {
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

    req.body = value;
    next();
  };
};

/**
 * Query parameter validation middleware
 */
export const validateQuery = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName]; // ✅ غيّر من querySchemas إلى schemas

    if (!schema) {
      logger.error("Query validation schema not found", { schemaName });
      return responseHandler.error(res, "Internal validation error", 500);
    }

    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }));

      logger.debug("Query validation failed", {
        schema: schemaName,
        errors: validationErrors,
        path: req.originalUrl,
      });

      return responseHandler.validationError(res, validationErrors);
    }

    req.validatedQuery = value;

    next();
  };
};

export default schemas;
