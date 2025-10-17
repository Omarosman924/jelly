// src/modules/auth/auth.validation.js - Phone Authentication
import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

/**
 * Phone Authentication Validation Schemas
 */

// Saudi phone number regex
const saudiPhoneRegex = /^((\+966)|966|0)?5[0-9]{8}$/;

// OTP regex (6 digits)
const otpRegex = /^[0-9]{6}$/;

// Password schema (optional - for password authentication)
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

const schemas = {
  // ==================== OTP REGISTRATION ====================

  requestRegistrationOtp: Joi.object({
    phone: Joi.string().pattern(saudiPhoneRegex).required().messages({
      "string.pattern.base":
        "Please provide a valid Saudi phone number (05XXXXXXXX)",
      "any.required": "Phone number is required",
    }),
  }),

  registerWithOtp: Joi.object({
    phone: Joi.string().pattern(saudiPhoneRegex).required().messages({
      "string.pattern.base": "Please provide a valid Saudi phone number",
      "any.required": "Phone number is required",
    }),
    otp: Joi.string().pattern(otpRegex).required().messages({
      "string.pattern.base": "OTP must be 6 digits",
      "any.required": "OTP is required",
    }),
    firstName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/)
      .required()
      .messages({
        "string.min": "First name must be at least 2 characters",
        "string.max": "First name must not exceed 50 characters",
        "string.pattern.base": "First name can only contain letters and spaces",
        "any.required": "First name is required",
      }),
    lastName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/)
      .required()
      .messages({
        "string.min": "Last name must be at least 2 characters",
        "string.max": "Last name must not exceed 50 characters",
        "string.pattern.base": "Last name can only contain letters and spaces",
        "any.required": "Last name is required",
      }),
    email: Joi.string().email().optional().messages({
      "string.email": "Please provide a valid email address",
    }),
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
  }),

  // ==================== OTP LOGIN ====================

  requestLoginOtp: Joi.object({
    phone: Joi.string().pattern(saudiPhoneRegex).required().messages({
      "string.pattern.base": "Please provide a valid Saudi phone number",
      "any.required": "Phone number is required",
    }),
  }),

  loginWithOtp: Joi.object({
    phone: Joi.string().pattern(saudiPhoneRegex).required().messages({
      "string.pattern.base": "Please provide a valid Saudi phone number",
      "any.required": "Phone number is required",
    }),
    otp: Joi.string().pattern(otpRegex).required().messages({
      "string.pattern.base": "OTP must be 6 digits",
      "any.required": "OTP is required",
    }),
    deviceName: Joi.string().max(100).optional(),
    platform: Joi.string().valid("web", "ios", "android", "desktop").optional(),
    deviceInfo: Joi.object({
      osVersion: Joi.string().max(50).optional(),
      appVersion: Joi.string().max(50).optional(),
      screenResolution: Joi.string().max(50).optional(),
      language: Joi.string().max(10).optional(),
    }).optional(),
  }),

  // ==================== PASSWORD AUTHENTICATION (OPTIONAL) ====================

  registerWithPassword: Joi.object({
    phone: Joi.string().pattern(saudiPhoneRegex).required().messages({
      "string.pattern.base": "Please provide a valid Saudi phone number",
      "any.required": "Phone number is required",
    }),
    password: passwordSchema.required().messages({
      "any.required": "Password is required",
    }),
    firstName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/)
      .required()
      .messages({
        "string.min": "First name must be at least 2 characters",
        "string.max": "First name must not exceed 50 characters",
        "string.pattern.base": "First name can only contain letters and spaces",
        "any.required": "First name is required",
      }),
    lastName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\u0600-\u06FF\s]+$/)
      .required()
      .messages({
        "string.min": "Last name must be at least 2 characters",
        "string.max": "Last name must not exceed 50 characters",
        "string.pattern.base": "Last name can only contain letters and spaces",
        "any.required": "Last name is required",
      }),
    email: Joi.string().email().optional().messages({
      "string.email": "Please provide a valid email address",
    }),
    role: Joi.string()
      .valid(
        "ADMIN",
        "END_USER",
        "DELIVERY",
        "CASHIER",
        "KITCHEN",
        "HALL_MANAGER"
      )
      .default("END_USER"),
  }),

  loginWithPassword: Joi.object({
    phone: Joi.string().pattern(saudiPhoneRegex).required().messages({
      "string.pattern.base": "Please provide a valid Saudi phone number",
      "any.required": "Phone number is required",
    }),
    password: Joi.string().required().messages({
      "any.required": "Password is required",
    }),
    deviceName: Joi.string().max(100).optional(),
    platform: Joi.string().valid("web", "ios", "android", "desktop").optional(),
    deviceInfo: Joi.object({
      osVersion: Joi.string().max(50).optional(),
      appVersion: Joi.string().max(50).optional(),
      screenResolution: Joi.string().max(50).optional(),
      language: Joi.string().max(10).optional(),
    }).optional(),
  }),

  // ==================== PHONE VERIFICATION ====================

  verifyPhone: Joi.object({
    otp: Joi.string().pattern(otpRegex).required().messages({
      "string.pattern.base": "OTP must be 6 digits",
      "any.required": "OTP is required",
    }),
  }),

  // ==================== TOKEN MANAGEMENT ====================

  refreshToken: Joi.object({
    refreshToken: Joi.string().required().messages({
      "any.required": "Refresh token is required",
    }),
  }),

  // ==================== ADMIN OPERATIONS ====================

  updateUserRole: Joi.object({
    newRole: Joi.string()
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
        "any.required": "New role is required",
      }),
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

    req.body = value;
    next();
  };
};

export default schemas;
