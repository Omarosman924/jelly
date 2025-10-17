import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

/**
 * Categories Validation Schemas and Middleware
 */

// Base validation schemas
const schemas = {
  // Create category validation
  createCategory: Joi.object({
    categoryNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\u0621-\u064A\u0660-\u0669 ]+$/)
      .required()
      .messages({
        "string.min": "Arabic category name must be at least 2 characters long",
        "string.max": "Arabic category name cannot exceed 100 characters",
        "string.pattern.base":
          "Arabic category name can only contain Arabic letters and spaces",
        "any.required": "Arabic category name is required",
      }),

    categoryNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z0-9 &-]+$/)
      .required()
      .messages({
        "string.min":
          "English category name must be at least 2 characters long",
        "string.max": "English category name cannot exceed 100 characters",
        "string.pattern.base":
          "English category name can only contain letters, numbers, spaces, & and -",
        "any.required": "English category name is required",
      }),

    description: Joi.string().max(500).optional().allow("").messages({
      "string.max": "Description cannot exceed 500 characters",
    }),

    imageUrl: Joi.string().uri().optional().allow("").messages({
      "string.uri": "Image URL must be a valid URL",
    }),

    displayOrder: Joi.number().integer().min(1).max(9999).optional().messages({
      "number.base": "Display order must be a number",
      "number.integer": "Display order must be a whole number",
      "number.min": "Display order must be at least 1",
      "number.max": "Display order cannot exceed 9999",
    }),

    isActive: Joi.boolean().default(true).messages({
      "boolean.base": "Active status must be true or false",
    }),
  }),

  // Update category validation
  updateCategory: Joi.object({
    categoryNameAr: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\u0621-\u064A\u0660-\u0669 ]+$/)
      .optional()
      .messages({
        "string.min": "Arabic category name must be at least 2 characters long",
        "string.max": "Arabic category name cannot exceed 100 characters",
        "string.pattern.base":
          "Arabic category name can only contain Arabic letters and spaces",
      }),

    categoryNameEn: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z0-9 &-]+$/)
      .optional()
      .messages({
        "string.min":
          "English category name must be at least 2 characters long",
        "string.max": "English category name cannot exceed 100 characters",
        "string.pattern.base":
          "English category name can only contain letters, numbers, spaces, & and -",
      }),

    description: Joi.string().max(500).optional().allow("").messages({
      "string.max": "Description cannot exceed 500 characters",
    }),

    imageUrl: Joi.string().uri().optional().allow("", null).messages({
      "string.uri": "Image URL must be a valid URL",
    }),

    displayOrder: Joi.number().integer().min(1).max(9999).optional().messages({
      "number.base": "Display order must be a number",
      "number.integer": "Display order must be a whole number",
      "number.min": "Display order must be at least 1",
      "number.max": "Display order cannot exceed 9999",
    }),

    isActive: Joi.boolean().optional().messages({
      "boolean.base": "Active status must be true or false",
    }),
  })
    .min(1)
    .messages({
      "object.min": "At least one field is required for update",
    }),

  // Update category status validation
  updateCategoryStatus: Joi.object({
    isActive: Joi.boolean().required().messages({
      "boolean.base": "Status must be true or false",
      "any.required": "Status is required",
    }),
  }),

  // Reorder categories validation
  reorderCategories: Joi.object({
    categoryOrders: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().integer().positive().required().messages({
            "number.base": "Category ID must be a number",
            "number.integer": "Category ID must be a whole number",
            "number.positive": "Category ID must be positive",
            "any.required": "Category ID is required",
          }),

          displayOrder: Joi.number()
            .integer()
            .min(1)
            .max(9999)
            .required()
            .messages({
              "number.base": "Display order must be a number",
              "number.integer": "Display order must be a whole number",
              "number.min": "Display order must be at least 1",
              "number.max": "Display order cannot exceed 9999",
              "any.required": "Display order is required",
            }),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.base": "Category orders must be an array",
        "array.min": "At least one category order is required",
        "any.required": "Category orders are required",
      }),
  }),

  // Bulk update categories validation
  bulkUpdateCategories: Joi.object({
    categories: Joi.array()
      .items(
        Joi.number().integer().positive().messages({
          "number.base": "Category ID must be a number",
          "number.integer": "Category ID must be a whole number",
          "number.positive": "Category ID must be positive",
        })
      )
      .min(1)
      .max(50)
      .required()
      .messages({
        "array.base": "Categories must be an array of IDs",
        "array.min": "At least one category ID is required",
        "array.max": "Cannot process more than 50 categories at once",
        "any.required": "Categories array is required",
      }),

    operation: Joi.string()
      .valid("activate", "deactivate", "delete")
      .required()
      .messages({
        "any.only": "Operation must be one of: activate, deactivate, delete",
        "any.required": "Operation is required",
      }),
  }),

  // Export categories validation
  exportCategories: Joi.object({
    format: Joi.string()
      .valid("json", "csv", "xlsx", "file")
      .default("json")
      .messages({
        "any.only": "Format must be one of: json, csv, xlsx, file",
      }),

    includeItems: Joi.boolean().default(false).messages({
      "boolean.base": "Include items must be true or false",
    }),
  }),

  // Query parameters validation
  getAllCategories: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be a whole number",
      "number.min": "Page must be at least 1",
    }),

    limit: Joi.number().integer().min(1).max(100).default(50).messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be a whole number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),

    search: Joi.string().min(2).max(100).optional().messages({
      "string.min": "Search query must be at least 2 characters",
      "string.max": "Search query cannot exceed 100 characters",
    }),

    isActive: Joi.string().valid("true", "false").optional().messages({
      "any.only": 'isActive must be either "true" or "false"',
    }),

    sortBy: Joi.string()
      .valid(
        "categoryNameAr",
        "categoryNameEn",
        "displayOrder",
        "createdAt",
        "updatedAt"
      )
      .default("displayOrder")
      .messages({
        "any.only":
          "sortBy must be one of: categoryNameAr, categoryNameEn, displayOrder, createdAt, updatedAt",
      }),

    sortOrder: Joi.string().valid("asc", "desc").default("asc").messages({
      "any.only": 'sortOrder must be either "asc" or "desc"',
    }),

    includeItems: Joi.string()
      .valid("true", "false")
      .default("false")
      .messages({
        "any.only": 'includeItems must be either "true" or "false"',
      }),
  }),

  // Get category by ID validation
  getCategoryById: Joi.object({
    includeItems: Joi.string()
      .valid("true", "false")
      .default("false")
      .messages({
        "any.only": 'includeItems must be either "true" or "false"',
      }),

    includeRecipes: Joi.string()
      .valid("true", "false")
      .default("false")
      .messages({
        "any.only": 'includeRecipes must be either "true" or "false"',
      }),

    includeMeals: Joi.string()
      .valid("true", "false")
      .default("false")
      .messages({
        "any.only": 'includeMeals must be either "true" or "false"',
      }),
  }),

  // Public categories validation
  getPublicCategories: Joi.object({
    includeItems: Joi.string().valid("true", "false").default("true").messages({
      "any.only": 'includeItems must be either "true" or "false"',
    }),
  }),

  // Search categories validation
  searchCategories: Joi.object({
    query: Joi.string().min(2).max(100).required().messages({
      "string.min": "Search query must be at least 2 characters",
      "string.max": "Search query cannot exceed 100 characters",
      "any.required": "Search query is required",
    }),

    limit: Joi.number().integer().min(1).max(50).default(10).messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be a whole number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 50",
    }),

    includeItems: Joi.string()
      .valid("true", "false")
      .default("false")
      .messages({
        "any.only": 'includeItems must be either "true" or "false"',
      }),
  }),

  // Category analytics validation
  getCategoryAnalytics: Joi.object({
    dateFrom: Joi.date().iso().optional().messages({
      "date.format": "dateFrom must be a valid ISO date",
      "date.base": "dateFrom must be a valid date",
    }),

    dateTo: Joi.date().iso().optional().min(Joi.ref("dateFrom")).messages({
      "date.format": "dateTo must be a valid ISO date",
      "date.base": "dateTo must be a valid date",
      "date.min": "dateTo must be after dateFrom",
    }),

    includeOrders: Joi.string()
      .valid("true", "false")
      .default("true")
      .messages({
        "any.only": 'includeOrders must be either "true" or "false"',
      }),

    includeSales: Joi.string().valid("true", "false").default("true").messages({
      "any.only": 'includeSales must be either "true" or "false"',
    }),
  }),

  // Category ID param validation
  categoryId: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      "number.base": "Category ID must be a number",
      "number.integer": "Category ID must be a whole number",
      "number.positive": "Category ID must be positive",
      "any.required": "Category ID is required",
    }),
  }),
};

/**
 * Create validation middleware
 */
const createValidator = (schema, source = "body") => {
  return (req, res, next) => {
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

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type,
      }));

      logger.warn("Categories validation failed", {
        source,
        errors,
        path: req.originalUrl,
        method: req.method,
        userId: req.user?.id,
      });

      return responseHandler.validationError(res, errors, "Validation failed");
    }

    // Replace the original data with validated data
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

    next();
  };
};

/**
 * Custom validation for category names uniqueness
 */
const validateCategoryNames = (req, res, next) => {
  const { categoryNameAr, categoryNameEn } = req.body;

  // Check if Arabic and English names are different
  if (categoryNameAr && categoryNameEn) {
    // Simple check - you might want more sophisticated logic
    const arOnlyArabic = /^[\u0621-\u064A\u0660-\u0669 ]+$/.test(
      categoryNameAr
    );
    const enOnlyEnglish = /^[a-zA-Z0-9 &-]+$/.test(categoryNameEn);

    if (!arOnlyArabic || !enOnlyEnglish) {
      return responseHandler.validationError(
        res,
        [
          {
            field: "categoryNames",
            message:
              "Arabic name should contain only Arabic characters and English name should contain only English characters",
            type: "language_mismatch",
          },
        ],
        "Validation failed"
      );
    }
  }

  next();
};

/**
 * Validate display order uniqueness
 */
const validateDisplayOrder = async (req, res, next) => {
  const { displayOrder } = req.body;
  const categoryId = req.params.id;

  if (displayOrder) {
    try {
      const { getDatabaseClient } = await import("../../utils/database.js");
      const db = getDatabaseClient();

      const existingCategory = await db.category.findFirst({
        where: {
          displayOrder: displayOrder,
          deletedAt: null,
          id: categoryId ? { not: parseInt(categoryId) } : undefined,
        },
        select: { id: true, categoryNameEn: true },
      });

      if (existingCategory) {
        return responseHandler.validationError(
          res,
          [
            {
              field: "displayOrder",
              message: `Display order ${displayOrder} is already used by category: ${existingCategory.categoryNameEn}`,
              value: displayOrder,
              type: "unique_violation",
            },
          ],
          "Validation failed"
        );
      }
    } catch (error) {
      logger.error("Display order validation error", {
        error: error.message,
        displayOrder,
        categoryId,
      });
      // Continue without validation if there's a database error
    }
  }

  next();
};

/**
 * Validate image URL format and accessibility
 */
const validateImageUrl = (req, res, next) => {
  const { imageUrl } = req.body;

  if (imageUrl && imageUrl.trim() !== "") {
    // Check for valid image file extensions
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

    try {
      const url = new URL(imageUrl);

      // Check if URL has a valid image extension
      if (!imageExtensions.test(url.pathname)) {
        return responseHandler.validationError(
          res,
          [
            {
              field: "imageUrl",
              message:
                "Image URL must point to a valid image file (jpg, jpeg, png, gif, webp, svg)",
              value: imageUrl,
              type: "invalid_image_format",
            },
          ],
          "Validation failed"
        );
      }

      // Check for allowed domains if specified
      const allowedDomains =
        process.env.ALLOWED_IMAGE_DOMAINS?.split(",") || [];
      if (allowedDomains.length > 0 && !allowedDomains.includes(url.hostname)) {
        return responseHandler.validationError(
          res,
          [
            {
              field: "imageUrl",
              message: `Image must be hosted on one of the allowed domains: ${allowedDomains.join(
                ", "
              )}`,
              value: imageUrl,
              type: "domain_not_allowed",
            },
          ],
          "Validation failed"
        );
      }
    } catch (error) {
      return responseHandler.validationError(
        res,
        [
          {
            field: "imageUrl",
            message: "Invalid URL format",
            value: imageUrl,
            type: "invalid_url",
          },
        ],
        "Validation failed"
      );
    }
  }

  next();
};

/**
 * Validate bulk operations limits
 */
const validateBulkLimits = (req, res, next) => {
  const { categories } = req.body;

  if (categories && Array.isArray(categories)) {
    const maxBulkSize = parseInt(process.env.MAX_BULK_CATEGORIES) || 50;

    if (categories.length > maxBulkSize) {
      return responseHandler.validationError(
        res,
        [
          {
            field: "categories",
            message: `Cannot process more than ${maxBulkSize} categories at once`,
            value: categories.length,
            type: "bulk_limit_exceeded",
          },
        ],
        "Validation failed"
      );
    }
  }

  next();
};

/**
 * Validation middlewares for each route
 */
export const categoriesValidation = {
  createCategory: [
    createValidator(schemas.createCategory),
    validateCategoryNames,
    validateDisplayOrder,
    validateImageUrl,
  ],

  updateCategory: [
    createValidator(schemas.categoryId, "params"),
    createValidator(schemas.updateCategory),
    validateCategoryNames,
    validateDisplayOrder,
    validateImageUrl,
  ],

  updateCategoryStatus: [
    createValidator(schemas.categoryId, "params"),
    createValidator(schemas.updateCategoryStatus),
  ],

  reorderCategories: [createValidator(schemas.reorderCategories)],

  bulkUpdateCategories: [
    createValidator(schemas.bulkUpdateCategories),
    validateBulkLimits,
  ],

  exportCategories: createValidator(schemas.exportCategories),

  getAllCategories: createValidator(schemas.getAllCategories, "query"),

  getCategoryById: [
    createValidator(schemas.categoryId, "params"),
    createValidator(schemas.getCategoryById, "query"),
  ],

  deleteCategory: createValidator(schemas.categoryId, "params"),

  restoreCategory: createValidator(schemas.categoryId, "params"),

  getPublicCategories: createValidator(schemas.getPublicCategories, "query"),

  searchCategories: createValidator(schemas.searchCategories, "query"),

  getCategoryItemsCount: createValidator(schemas.categoryId, "params"),

  getCategoryAnalytics: [
    createValidator(schemas.categoryId, "params"),
    createValidator(schemas.getCategoryAnalytics, "query"),
  ],
};

/**
 * Utility functions for validation
 */

/**
 * Check Arabic text quality
 */
export const validateArabicText = (text) => {
  if (!text) return true;

  // Check for mixed scripts (Arabic with Latin)
  const hasArabic = /[\u0621-\u064A]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);

  if (hasArabic && hasLatin) {
    return {
      isValid: false,
      message: "Arabic text should not contain Latin characters",
    };
  }

  // Check for reasonable Arabic text structure
  const arabicWords = text.match(/[\u0621-\u064A]+/g) || [];
  if (hasArabic && arabicWords.length === 0) {
    return {
      isValid: false,
      message: "Invalid Arabic text structure",
    };
  }

  return { isValid: true };
};

/**
 * Check English text quality
 */
export const validateEnglishText = (text) => {
  if (!text) return true;

  // Check for mixed scripts (English with Arabic)
  const hasArabic = /[\u0621-\u064A]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);

  if (hasArabic && hasLatin) {
    return {
      isValid: false,
      message: "English text should not contain Arabic characters",
    };
  }

  // Check for common English words structure
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  if (hasLatin && englishWords.length === 0) {
    return {
      isValid: false,
      message: "Invalid English text structure",
    };
  }

  return { isValid: true };
};

/**
 * Validate category hierarchy depth
 */
export const validateCategoryDepth = async (parentId, maxDepth = 3) => {
  if (!parentId) return { isValid: true };

  try {
    const { getDatabaseClient } = await import("../../utils/database.js");
    const db = getDatabaseClient();

    let currentDepth = 0;
    let currentId = parentId;

    while (currentId && currentDepth < maxDepth) {
      const category = await db.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

      if (!category) break;

      currentDepth++;
      currentId = category.parentId;
    }

    if (currentDepth >= maxDepth) {
      return {
        isValid: false,
        message: `Category hierarchy cannot exceed ${maxDepth} levels`,
      };
    }

    return { isValid: true };
  } catch (error) {
    logger.error("Category depth validation error", { error: error.message });
    return { isValid: true }; // Fail open
  }
};

/**
 * Sanitize category data
 */
export const sanitizeCategoryData = (data) => {
  const sanitized = { ...data };

  // Trim whitespace
  if (sanitized.categoryNameAr) {
    sanitized.categoryNameAr = sanitized.categoryNameAr.trim();
  }
  if (sanitized.categoryNameEn) {
    sanitized.categoryNameEn = sanitized.categoryNameEn.trim();
  }
  if (sanitized.description) {
    sanitized.description = sanitized.description.trim();
  }

  // Remove potentially harmful content
  const dangerousPatterns = /<script|javascript:|data:/gi;
  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === "string") {
      if (dangerousPatterns.test(sanitized[key])) {
        delete sanitized[key];
      }
    }
  });

  return sanitized;
};

export default categoriesValidation;
