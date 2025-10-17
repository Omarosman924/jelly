import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

/**
 * User Management Validation Schemas
 */

const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .messages({
    "string.min": "Password must be at least 8 characters long",
    "string.max": "Password must not exceed 128 characters",
    "string.pattern.base":
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  });

const emailSchema = Joi.string().email().required().messages({
  "string.email": "Please provide a valid email address",
  "any.required": "Email is required",
});

const phoneSchema = Joi.string()
  .pattern(/^(\+966|966|0)?[5][0-9]{8}$/)
  .messages({
    "string.pattern.base": "Please provide a valid Saudi phone number",
  });

const nameSchema = Joi.string()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/)
  .messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name must not exceed 50 characters",
    "string.pattern.base":
      "Name can only contain letters (Arabic/English) and spaces",
  });

const schemas = {
  createUser: Joi.object({
    email: emailSchema,
    password: passwordSchema.required(),
    firstName: nameSchema.required(),
    lastName: nameSchema.required(),
    phone: phoneSchema,
    role: Joi.string()
      .valid(
        "ADMIN",
        "END_USER",
        "DELIVERY",
        "CASHIER",
        "KITCHEN",
        "HALL_MANAGER"
      )
      .default("END_USER")
      .messages({
        "any.only": "Invalid user role",
      }),
    customerData: Joi.object({
      address: Joi.string().max(200),
      city: Joi.string().max(100),
      district: Joi.string().max(100),
      deliveryAreaId: Joi.number().integer().positive(),
    }).optional(),
    staffData: Joi.object({
      salary: Joi.number().positive().precision(2),
      shiftType: Joi.string().valid("MORNING", "EVENING", "NIGHT"),
    }).optional(),
  }),

  updateUser: Joi.object({
    email: Joi.string().email(),
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    phone: phoneSchema,
    isActive: Joi.boolean(),
  }).min(1),

  updateProfile: Joi.object({
    firstName: nameSchema,
    lastName: nameSchema,
    phone: phoneSchema,
  }).min(1),

  changeRole: Joi.object({
    role: Joi.string()
      .valid(
        "ADMIN",
        "END_USER",
        "DELIVERY",
        "CASHIER",
        "KITCHEN",
        "HALL_MANAGER"
      )
      .required()
      .messages({
        "any.only": "Invalid user role",
        "any.required": "Role is required",
      }),
  }),

  toggleStatus: Joi.object({
    isActive: Joi.boolean().required().messages({
      "any.required": "Status (isActive) is required",
    }),
  }),

  updateCustomer: Joi.object({
    address: Joi.string().max(200),
    city: Joi.string().max(100),
    district: Joi.string().max(100),
    deliveryAreaId: Joi.number().integer().positive().allow(null),
    loyaltyPoints: Joi.number().integer().min(0),
  }).min(1),

  updateStaff: Joi.object({
    salary: Joi.number().positive().precision(2),
    shiftType: Joi.string().valid("MORNING", "EVENING", "NIGHT"),
    isOnDuty: Joi.boolean(),
  }).min(1),

  resetPassword: Joi.object({
    newPassword: passwordSchema.required(),
  }),
};

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

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

export default schemas;
