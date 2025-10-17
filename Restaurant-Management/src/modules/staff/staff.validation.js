import Joi from "joi";
import { responseHandler } from "../../utils/response.js";
import logger from "../../utils/logger.js";

/**
 * Staff Validation Schemas - Fixed Version
 */

// ==================== COMMON REGEX PATTERNS ====================
const phoneRegex = /^(\+966|966|0)?[5][0-9]{8}$/;
const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const nameRegex = /^[a-zA-Z\u0600-\u06FF\s]+$/;
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

// ==================== COMMON FIELD DEFINITIONS ====================
const commonFields = {
  email: Joi.string().email().messages({
    "string.email": "Please provide a valid email address",
  }),

  password: Joi.string().pattern(strongPasswordRegex).messages({
    "string.pattern.base":
      "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
  }),

  firstName: Joi.string().min(2).max(50).pattern(nameRegex).messages({
    "string.min": "First name must be at least 2 characters",
    "string.max": "First name must not exceed 50 characters",
    "string.pattern.base": "First name can only contain letters and spaces",
  }),

  lastName: Joi.string().min(2).max(50).pattern(nameRegex).messages({
    "string.min": "Last name must be at least 2 characters",
    "string.max": "Last name must not exceed 50 characters",
    "string.pattern.base": "Last name can only contain letters and spaces",
  }),

  phone: Joi.string().pattern(phoneRegex).messages({
    "string.pattern.base": "Please provide a valid Saudi phone number",
  }),

  role: Joi.string()
    .valid("ADMIN", "DELIVERY", "CASHIER", "KITCHEN", "HALL_MANAGER")
    .messages({
      "any.only": "Invalid staff role",
    }),

  salary: Joi.number().min(0).max(50000).precision(2).messages({
    "number.min": "Salary cannot be negative",
    "number.max": "Salary cannot exceed 50,000 SAR",
  }),

  shiftType: Joi.string().valid("MORNING", "EVENING", "NIGHT").messages({
    "any.only": "Shift type must be MORNING, EVENING, or NIGHT",
  }),

  hireDate: Joi.date().max("now").messages({
    "date.max": "Hire date cannot be in the future",
  }),

  isOnDuty: Joi.boolean(),

  startTime: Joi.string().pattern(timeRegex).messages({
    "string.pattern.base": "Start time must be in HH:MM format",
  }),

  endTime: Joi.string().pattern(timeRegex).messages({
    "string.pattern.base": "End time must be in HH:MM format",
  }),

  notes: Joi.string().max(500).allow("", null),

  // Pagination fields
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),

  // Date fields
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),

  // Sort fields
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
};

// ==================== CUSTOM VALIDATIONS ====================
const customValidations = {
  /**
   * Validate work hours don't exceed maximum
   */
  validateWorkHours: (value, helpers) => {
    if (value > 16) {
      return helpers.error("custom.workHours", {
        message: "Work hours cannot exceed 16 hours per day",
      });
    }
    return value;
  },

  /**
   * Validate shift times don't overlap
   */
  validateShiftTimes: (value, helpers, { prefs: { context } }) => {
    const { startTime, endTime } = context || {};

    if (startTime && endTime) {
      const start = new Date(`1970-01-01T${startTime}:00`);
      const end = new Date(`1970-01-01T${endTime}:00`);

      if (start >= end) {
        return helpers.error("custom.shiftTimes", {
          message: "End time must be after start time",
        });
      }
    }

    return value;
  },

  /**
   * Validate salary is reasonable for role
   */
  validateSalaryRange: (value, helpers, { prefs: { context } }) => {
    const { role } = context || {};

    const salaryRanges = {
      ADMIN: { min: 8000, max: 25000 },
      HALL_MANAGER: { min: 5000, max: 15000 },
      KITCHEN: { min: 2500, max: 8000 },
      CASHIER: { min: 2500, max: 6000 },
      DELIVERY: { min: 2000, max: 5000 },
    };

    if (role && salaryRanges[role]) {
      const range = salaryRanges[role];
      if (value < range.min || value > range.max) {
        return helpers.error("custom.salaryRange", {
          message: `Salary for ${role} should be between ${range.min} and ${range.max} SAR`,
        });
      }
    }

    return value;
  },

  /**
   * Validate recipients for notifications
   */
  validateRecipients: (value, helpers) => {
    const { staffIds, roles, all } = value;

    if (
      !all &&
      (!staffIds || staffIds.length === 0) &&
      (!roles || roles.length === 0)
    ) {
      return helpers.error("custom.recipients", {
        message: "Must specify recipients (staffIds, roles, or all)",
      });
    }

    return value;
  },
};

// ==================== VALIDATION SCHEMAS ====================
const schemas = {
  // ==================== STAFF MANAGEMENT ====================
  createStaff: Joi.object({
    email: commonFields.email.required().messages({
      "any.required": "Email is required",
    }),
    password: commonFields.password.required().messages({
      "any.required": "Password is required",
    }),
    firstName: commonFields.firstName.required().messages({
      "any.required": "First name is required",
    }),
    lastName: commonFields.lastName.required().messages({
      "any.required": "Last name is required",
    }),
    phone: commonFields.phone.required().messages({
      "any.required": "Phone number is required",
    }),
    role: commonFields.role.required().messages({
      "any.required": "Staff role is required",
    }),
    salary: commonFields.salary.custom(customValidations.validateSalaryRange),
    shiftType: commonFields.shiftType,
    hireDate: commonFields.hireDate,
    isOnDuty: commonFields.isOnDuty,
  }),

  updateStaff: Joi.object({
    firstName: commonFields.firstName,
    lastName: commonFields.lastName,
    phone: commonFields.phone,
    email: commonFields.email,
    role: commonFields.role,
    salary: commonFields.salary.custom(customValidations.validateSalaryRange),
    shiftType: commonFields.shiftType,
    hireDate: commonFields.hireDate,
    isOnDuty: commonFields.isOnDuty,
  }).min(1),

  updateProfile: Joi.object({
    firstName: commonFields.firstName,
    lastName: commonFields.lastName,
    phone: commonFields.phone,
    email: commonFields.email,
    shiftType: commonFields.shiftType,
  }).min(1),

  // ==================== SHIFT MANAGEMENT ====================
  clockIn: Joi.object({
    notes: commonFields.notes,
    location: Joi.string().max(100).allow("", null),
  }),

  clockOut: Joi.object({
    notes: commonFields.notes,
  }),

  updateShift: Joi.object({
    clockInTime: Joi.date(),
    clockOutTime: Joi.date().min(Joi.ref("clockInTime")),
    hoursWorked: Joi.number()
      .min(0)
      .max(24)
      .precision(2)
      .custom(customValidations.validateWorkHours),
    notes: Joi.string().max(1000).allow("", null),
    location: Joi.string().max(100).allow("", null),
  }).min(1),

  // ==================== SALARY MANAGEMENT ====================
  updateSalary: Joi.object({
    salary: commonFields.salary
      .required()
      .custom(customValidations.validateSalaryRange)
      .messages({
        "any.required": "Salary amount is required",
      }),
    effectiveDate: Joi.date().default(() => new Date()),
    reason: Joi.string().min(10).max(500).required().messages({
      "string.min": "Reason must be at least 10 characters",
      "string.max": "Reason cannot exceed 500 characters",
      "any.required": "Reason for salary change is required",
    }),
  }),

  processPayroll: Joi.object({
    month: Joi.number().integer().min(1).max(12).required().messages({
      "number.min": "Month must be between 1 and 12",
      "number.max": "Month must be between 1 and 12",
      "any.required": "Month is required",
    }),
    year: Joi.number()
      .integer()
      .min(2020)
      .max(new Date().getFullYear())
      .required()
      .messages({
        "number.min": "Year cannot be before 2020",
        "number.max": "Year cannot be in the future",
        "any.required": "Year is required",
      }),
    staffIds: Joi.array()
      .items(Joi.number().integer().positive())
      .min(1)
      .optional()
      .messages({
        "array.min": "At least one staff member must be selected",
      }),
    bonuses: Joi.array()
      .items(
        Joi.object({
          staffId: Joi.number().integer().positive().required(),
          amount: Joi.number().min(0).max(10000).precision(2).required(),
          reason: Joi.string().min(5).max(200).required(),
        })
      )
      .optional(),
    deductions: Joi.array()
      .items(
        Joi.object({
          staffId: Joi.number().integer().positive().required(),
          amount: Joi.number().min(0).max(10000).precision(2).required(),
          reason: Joi.string().min(5).max(200).required(),
        })
      )
      .optional(),
  }),

  // ==================== PERFORMANCE MANAGEMENT ====================
  createReview: Joi.object({
    reviewType: Joi.string()
      .valid("MONTHLY", "QUARTERLY", "ANNUAL", "PROBATION", "SPECIAL")
      .required()
      .messages({
        "any.only": "Invalid review type",
        "any.required": "Review type is required",
      }),
    reviewPeriod: Joi.object({
      startDate: Joi.date().required(),
      endDate: Joi.date().min(Joi.ref("startDate")).required(),
    }).required(),
    overallRating: Joi.number().min(1).max(5).required().messages({
      "number.min": "Rating must be between 1 and 5",
      "number.max": "Rating must be between 1 and 5",
      "any.required": "Overall rating is required",
    }),
    criteria: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required(),
          rating: Joi.number().min(1).max(5).required(),
          comments: Joi.string().max(500).allow("", null),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one criteria must be provided",
        "any.required": "Performance criteria are required",
      }),
    strengths: Joi.string().max(1000).required().messages({
      "string.max": "Strengths cannot exceed 1000 characters",
      "any.required": "Strengths are required",
    }),
    areasForImprovement: Joi.string().max(1000).required().messages({
      "string.max": "Areas for improvement cannot exceed 1000 characters",
      "any.required": "Areas for improvement are required",
    }),
    goals: Joi.array()
      .items(
        Joi.object({
          description: Joi.string().required(),
          targetDate: Joi.date().min("now").required(),
          priority: Joi.string()
            .valid("HIGH", "MEDIUM", "LOW")
            .default("MEDIUM"),
        })
      )
      .optional(),
    additionalComments: Joi.string().max(2000).allow("", null),
  }),

  // ==================== SCHEDULING ====================
  createSchedule: Joi.object({
    schedules: Joi.array()
      .items(
        Joi.object({
          staffId: Joi.number().integer().positive().required(),
          date: Joi.date().min("now").required(),
          shiftType: commonFields.shiftType.required(),
          startTime: commonFields.startTime
            .required()
            .custom(customValidations.validateShiftTimes),
          endTime: commonFields.endTime
            .required()
            .custom(customValidations.validateShiftTimes),
          notes: Joi.string().max(200).allow("", null),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one schedule must be provided",
        "any.required": "Schedules are required",
      }),
  }),

  updateSchedule: Joi.object({
    date: Joi.date().min("now"),
    shiftType: commonFields.shiftType,
    startTime: commonFields.startTime,
    endTime: commonFields.endTime,
    notes: Joi.string().max(200).allow("", null),
  }).min(1),

  // ==================== NOTIFICATIONS ====================
  sendNotification: Joi.object({
    title: Joi.string().min(5).max(100).required().messages({
      "string.min": "Title must be at least 5 characters",
      "string.max": "Title cannot exceed 100 characters",
      "any.required": "Title is required",
    }),
    message: Joi.string().min(10).max(500).required().messages({
      "string.min": "Message must be at least 10 characters",
      "string.max": "Message cannot exceed 500 characters",
      "any.required": "Message is required",
    }),
    type: Joi.string()
      .valid("INFO", "WARNING", "URGENT", "ANNOUNCEMENT")
      .default("INFO"),
    recipients: Joi.object({
      staffIds: Joi.array().items(Joi.number().integer().positive()).optional(),
      roles: Joi.array().items(commonFields.role).optional(),
      all: Joi.boolean().default(false),
    }).custom(customValidations.validateRecipients),
    priority: Joi.string().valid("LOW", "MEDIUM", "HIGH").default("MEDIUM"),
    scheduledFor: Joi.date().min("now").optional(),
  }),

  // ==================== QUERY SCHEMAS ====================
  staffQuery: Joi.object({
    page: commonFields.page,
    limit: commonFields.limit,
    search: Joi.string().max(100),
    role: commonFields.role,
    shiftType: commonFields.shiftType,
    isOnDuty: Joi.string().valid("true", "false"),
    isActive: Joi.string().valid("true", "false"),
    sortBy: Joi.string()
      .valid("createdAt", "firstName", "lastName", "hireDate", "salary")
      .default("createdAt"),
    sortOrder: commonFields.sortOrder,
  }),

  shiftHistoryQuery: Joi.object({
    page: commonFields.page,
    limit: Joi.number().integer().min(1).max(100).default(20),
    dateFrom: commonFields.dateFrom,
    dateTo: commonFields.dateTo.min(Joi.ref("dateFrom")),
    shiftType: commonFields.shiftType,
  }),

  attendanceQuery: Joi.object({
    page: commonFields.page,
    limit: Joi.number().integer().min(1).max(100).default(20),
    staffId: Joi.number().integer().positive(),
    dateFrom: commonFields.dateFrom,
    dateTo: commonFields.dateTo.min(Joi.ref("dateFrom")),
    shiftType: commonFields.shiftType,
    sortBy: Joi.string()
      .valid("date", "hoursWorked", "staffName")
      .default("date"),
    sortOrder: commonFields.sortOrder,
  }),

  performanceQuery: Joi.object({
    dateFrom: commonFields.dateFrom,
    dateTo: commonFields.dateTo.min(Joi.ref("dateFrom")),
    includeComparisons: Joi.string().valid("true", "false").default("false"),
  }),

  reviewsQuery: Joi.object({
    page: commonFields.page,
    limit: Joi.number().integer().min(1).max(50).default(10),
    reviewType: Joi.string().valid(
      "MONTHLY",
      "QUARTERLY",
      "ANNUAL",
      "PROBATION",
      "SPECIAL"
    ),
    dateFrom: commonFields.dateFrom,
    dateTo: commonFields.dateTo.min(Joi.ref("dateFrom")),
  }),

  statsQuery: Joi.object({
    dateFrom: commonFields.dateFrom,
    dateTo: commonFields.dateTo.min(Joi.ref("dateFrom")),
    role: commonFields.role,
    shiftType: commonFields.shiftType,
  }),

  scheduleQuery: Joi.object({
    dateFrom: commonFields.dateFrom.default(
      () => new Date().toISOString().split("T")[0]
    ),
    dateTo: commonFields.dateTo,
    staffId: Joi.number().integer().positive(),
    shiftType: commonFields.shiftType,
  }),

  reportQuery: Joi.object({
    dateFrom: commonFields.dateFrom,
    dateTo: commonFields.dateTo.min(Joi.ref("dateFrom")),
    staffId: Joi.number().integer().positive(),
    format: Joi.string().valid("json", "pdf", "excel").default("json"),
    includeDetails: Joi.string().valid("true", "false").default("false"),
  }),

  overtimeQuery: Joi.object({
    dateFrom: commonFields.dateFrom,
    dateTo: commonFields.dateTo.min(Joi.ref("dateFrom")),
    staffId: Joi.number().integer().positive(),
    threshold: Joi.number().integer().min(1).max(24).default(8),
  }),

  salaryCalculationQuery: Joi.object({
    month: Joi.number().integer().min(1).max(12).required(),
    year: Joi.number()
      .integer()
      .min(2020)
      .max(new Date().getFullYear())
      .required(),
  }),

  notificationsQuery: Joi.object({
    page: commonFields.page,
    limit: Joi.number().integer().min(1).max(100).default(20),
    unreadOnly: Joi.string().valid("true", "false").default("false"),
    type: Joi.string().valid("INFO", "WARNING", "URGENT", "ANNOUNCEMENT"),
  }),
};

// ==================== MIDDLEWARE FUNCTIONS ====================

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
      staffId: req.user?.staff?.id,
      role: req.body?.role,
      startTime: req.body?.startTime,
      endTime: req.body?.endTime,
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
    const schema = schemas[schemaName];

    if (!schema) {
      logger.error("Query validation schema not found", { schemaName });
      return responseHandler.error(res, "Internal validation error", 500);
    }

    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type,
      }));

      logger.debug("Query validation failed", {
        schema: schemaName,
        errors: validationErrors,
        path: req.originalUrl,
      });

      return responseHandler.validationError(res, validationErrors);
    }

    req.query = value;
    next();
  };
};

/**
 * Get validation schema by name
 */
export const getSchema = (schemaName) => {
  return schemas[schemaName];
};

/**
 * Validate data directly without middleware
 */
export const validateData = (schemaName, data) => {
  const schema = schemas[schemaName];
  if (!schema) {
    throw new Error(`Validation schema '${schemaName}' not found`);
  }

  return schema.validate(data, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });
};

export default schemas;
