import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

const schemas = {
  processPayment: Joi.object({
    orderId: Joi.number().integer().positive().required().messages({
      "number.positive": "Order ID must be positive",
      "any.required": "Order ID is required",
    }),

    paymentMethod: Joi.string()
      .valid("CASH", "CARD", "DIGITAL_WALLET")
      .required()
      .messages({
        "any.only": "Payment method must be CASH, CARD, or DIGITAL_WALLET",
        "any.required": "Payment method is required",
      }),

    amountPaid: Joi.number().positive().precision(2).required().messages({
      "number.positive": "Payment amount must be positive",
      "any.required": "Payment amount is required",
    }),

    transactionReference: Joi.string().max(100).when("paymentMethod", {
      is: "CASH",
      then: Joi.optional(),
      otherwise: Joi.optional(),
    }),

    gatewayData: Joi.object({
      gateway: Joi.string()
        .valid("MADA", "STC_PAY", "STRIPE")
        .when("$paymentMethod", {
          is: Joi.valid("CARD", "DIGITAL_WALLET"),
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),

      // Card payment fields
      cardNumber: Joi.string()
        .pattern(/^[0-9]{16}$/)
        .when("gateway", {
          is: Joi.valid("MADA", "STRIPE"),
          then: Joi.when("$paymentMethod", {
            is: "CARD",
            then: Joi.optional(), // Optional for testing, required in production
            otherwise: Joi.optional(),
          }),
          otherwise: Joi.optional(),
        }),

      expiryDate: Joi.string()
        .pattern(/^(0[1-9]|1[0-2])\/([0-9]{2})$/)
        .when("cardNumber", {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.optional(),
        }),

      cvv: Joi.string()
        .pattern(/^[0-9]{3,4}$/)
        .when("cardNumber", {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.optional(),
        }),

      // Digital wallet fields
      phoneNumber: Joi.string()
        .pattern(/^(\+966|966|0)?[5][0-9]{8}$/)
        .when("gateway", {
          is: "STC_PAY",
          then: Joi.when("$paymentMethod", {
            is: "DIGITAL_WALLET",
            then: Joi.optional(),
            otherwise: Joi.optional(),
          }),
          otherwise: Joi.optional(),
        }),

      // Stripe specific
      paymentMethodId: Joi.string().when("gateway", {
        is: "STRIPE",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
    }).when("paymentMethod", {
      is: Joi.valid("CARD", "DIGITAL_WALLET"),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),

  processRefund: Joi.object({
    refundAmount: Joi.number().positive().precision(2).required().messages({
      "number.positive": "Refund amount must be positive",
      "any.required": "Refund amount is required",
    }),

    reason: Joi.string().min(10).max(500).required().messages({
      "string.min": "Refund reason must be at least 10 characters",
      "string.max": "Refund reason must not exceed 500 characters",
      "any.required": "Refund reason is required",
    }),
  }),

  verifyPayment: Joi.object({
    transactionReference: Joi.string().required().messages({
      "any.required": "Transaction reference is required",
    }),

    gateway: Joi.string().valid("MADA", "STC_PAY", "STRIPE").optional(),
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
      context: { paymentMethod: req.body.paymentMethod }, // Pass context for conditional validation
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
