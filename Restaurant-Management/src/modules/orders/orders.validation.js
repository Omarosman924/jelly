import Joi from "joi";
import { responseHandler } from "../../utils/response.js";

const schemas = {
  createOrder: Joi.object({
    customerId: Joi.number().integer().positive(),
    companyId: Joi.number().integer().positive(),
    tableId: Joi.number().integer().positive(),
    orderType: Joi.string()
      .valid("DINE_IN", "TAKEAWAY", "DELIVERY", "PARTY", "OPEN_BUFFET")
      .required(),
    customerType: Joi.string()
      .valid("INDIVIDUAL", "COMPANY")
      .default("INDIVIDUAL"),
    items: Joi.array()
      .items(
        Joi.object({
          itemType: Joi.string().valid("item", "recipe", "meal").required(),
          itemReferenceId: Joi.number().integer().positive().required(),
          quantity: Joi.number().positive().required(),
          cookingMethodId: Joi.number().integer().positive(),
          specialInstructions: Joi.string().max(200),
        })
      )
      .min(1)
      .required(),
    specialInstructions: Joi.string().max(500),
    deliveryAreaId: Joi.number().integer().positive(),
  }),

  updateStatus: Joi.object({
    status: Joi.string()
      .valid(
        "PENDING",
        "CONFIRMED",
        "PREPARING",
        "READY",
        "SERVED",
        "DELIVERED",
        "CANCELLED"
      )
      .required(),
    notes: Joi.string().max(200),
  }),
};

export const validateRequest = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      return responseHandler.validationError(res, validationErrors);
    }

    req.body = value;
    next();
  };
};
