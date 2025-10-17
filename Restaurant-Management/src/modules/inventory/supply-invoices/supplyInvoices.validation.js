import Joi from "joi";
import { responseHandler } from "../../../utils/response.js";
import logger from "../../../utils/logger.js";

const schemas = {
  createSupplyInvoice: Joi.object({
    invoiceNumber: Joi.string().alphanum().min(3).max(50).required().messages({
      "string.alphanum": "Invoice number must contain only letters and numbers",
      "string.min": "Invoice number must be at least 3 characters",
      "string.max": "Invoice number must not exceed 50 characters",
      "any.required": "Invoice number is required",
    }),

    supplierId: Joi.number().integer().positive().required().messages({
      "number.positive": "Supplier ID must be positive",
      "any.required": "Supplier is required",
    }),

    invoiceDate: Joi.date().max("now").required().messages({
      "date.max": "Invoice date cannot be in the future",
      "any.required": "Invoice date is required",
    }),

    items: Joi.array()
      .items(
        Joi.object({
          itemId: Joi.number().integer().positive().required(),
          quantity: Joi.number().positive().precision(3).required().messages({
            "number.positive": "Quantity must be positive",
            "any.required": "Quantity is required",
          }),
          unitCost: Joi.number().positive().precision(2).required().messages({
            "number.positive": "Unit cost must be positive",
            "any.required": "Unit cost is required",
          }),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one item is required",
        "any.required": "Items are required",
      }),

    invoiceImageUrl: Joi.string().uri().allow("", null),
  }),

  updateSupplyInvoice: Joi.object({
    invoiceNumber: Joi.string().alphanum().min(3).max(50),
    invoiceDate: Joi.date().max("now"),
    invoiceImageUrl: Joi.string().uri().allow("", null),
    items: Joi.array()
      .items(
        Joi.object({
          itemId: Joi.number().integer().positive().required(),
          quantity: Joi.number().positive().precision(3).required(),
          unitCost: Joi.number().positive().precision(2).required(),
        })
      )
      .min(1),
  }).min(1),

  approveInvoice: Joi.object({
    notes: Joi.string().max(500).allow("", null),
  }),

  rejectInvoice: Joi.object({
    reason: Joi.string().min(10).max(500).required().messages({
      "string.min": "Rejection reason must be at least 10 characters",
      "string.max": "Rejection reason must not exceed 500 characters",
      "any.required": "Rejection reason is required",
    }),
  }),

  bulkApprove: Joi.object({
    invoiceIds: Joi.array()
      .items(Joi.number().integer().positive())
      .min(1)
      .max(50)
      .required()
      .messages({
        "array.min": "At least one invoice ID is required",
        "array.max": "Maximum 50 invoices can be approved at once",
        "any.required": "Invoice IDs are required",
      }),
    notes: Joi.string().max(500).allow("", null),
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
