// src/modules/auth/emailAuth.validation.js
import Joi from "joi";
import { ValidationError } from "../../middleware/errorHandler.js";

/**
 * Email Authentication Validation Schemas
 */
const schemas = {
  requestRegistrationOtp: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  }),

  registerWithOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
      "string.length": "OTP must be 6 digits",
      "string.pattern.base": "OTP must contain only numbers",
      "any.required": "OTP is required",
    }),
    firstName: Joi.string().min(2).max(50).required().messages({
      "string.min": "First name must be at least 2 characters",
      "string.max": "First name cannot exceed 50 characters",
      "any.required": "First name is required",
    }),
    lastName: Joi.string().min(2).max(50).required().messages({
      "string.min": "Last name must be at least 2 characters",
      "string.max": "Last name cannot exceed 50 characters",
      "any.required": "Last name is required",
    }),
    phone: Joi.string()
      .pattern(/^((\+966)|966|0)?5[0-9]{8}$/)
      .optional()
      .allow(null, "")
      .messages({
        "string.pattern.base": "Invalid Saudi phone number format",
      }),
    role: Joi.string()
      .valid("END_USER", "DELIVERY", "CASHIER", "KITCHEN", "HALL_MANAGER")
      .default("END_USER"),
  }),

  requestLoginOtp: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  }),

  loginWithOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
      "string.length": "OTP must be 6 digits",
      "string.pattern.base": "OTP must contain only numbers",
      "any.required": "OTP is required",
    }),
    deviceName: Joi.string().optional(),
    platform: Joi.string().optional(),
    deviceInfo: Joi.object().optional(),
  }),

  registerWithPassword: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters",
        "string.max": "Password cannot exceed 128 characters",
        "string.pattern.base":
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
        "any.required": "Password is required",
      }),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string()
      .pattern(/^((\+966)|966|0)?5[0-9]{8}$/)
      .optional()
      .allow(null, ""),
    role: Joi.string()
      .valid("END_USER", "DELIVERY", "CASHIER", "KITCHEN", "HALL_MANAGER")
      .default("END_USER"),
  }),

  loginWithPassword: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
      "any.required": "Password is required",
    }),
    deviceName: Joi.string().optional(),
    platform: Joi.string().optional(),
    deviceInfo: Joi.object().optional(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required().messages({
      "any.required": "Refresh token is required",
    }),
  }),
};

/**
 * Validation middleware
 */
export const validateEmailRequest = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      return next(new Error(`Validation schema '${schemaName}' not found`));
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return next(
        new ValidationError("Validation failed", {
          errors,
        })
      );
    }

    req.body = value;
    next();
  };
};

export default schemas;
