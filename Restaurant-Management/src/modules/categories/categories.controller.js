import categoriesService from "./categories.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import logger from "../../utils/logger.js";

/**
 * Categories Controller - Production Ready
 * Handles all category HTTP requests with comprehensive functionality
 */
class CategoriesController {
  getAllCategories = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 50, 100),
      search: req.query.search?.trim(),
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      sortBy: req.query.sortBy || "displayOrder",
      sortOrder: req.query.sortOrder || "asc",
      includeItems: req.query.includeItems === "true",
    };

    const result = await categoriesService.getAllCategories(options);
    return responseHandler.paginated(
      res,
      result.categories,
      result.pagination,
      "Categories retrieved successfully"
    );
  });

  getCategoryById = asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return responseHandler.error(res, "Invalid category ID", 400);
    }

    const options = {
      includeItems: req.query.includeItems === "true",
      includeRecipes: req.query.includeRecipes === "true",
      includeMeals: req.query.includeMeals === "true",
    };

    const category = await categoriesService.getCategoryById(
      categoryId,
      options
    );
    return responseHandler.success(
      res,
      { category },
      "Category retrieved successfully"
    );
  });

  createCategory = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const category = await categoriesService.createCategory(
      req.body,
      req.user.id
    );

    logger.info("Category created", {
      categoryId: category.id,
      categoryNameEn: category.categoryNameEn,
      createdBy: req.user.id,
      ip: req.ip,
    });

    return responseHandler.withPerformance(
      res,
      { category },
      "Category created successfully",
      startTime
    );
  });

  updateCategory = asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return responseHandler.error(res, "Invalid category ID", 400);
    }

    const category = await categoriesService.updateCategory(
      categoryId,
      req.body,
      req.user.id
    );

    logger.info("Category updated", {
      categoryId,
      updatedFields: Object.keys(req.body),
      updatedBy: req.user.id,
      ip: req.ip,
    });

    return responseHandler.success(
      res,
      { category },
      "Category updated successfully"
    );
  });

  deleteCategory = asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return responseHandler.error(res, "Invalid category ID", 400);
    }

    await categoriesService.deleteCategory(categoryId, req.user.id);

    logger.warn("Category deleted", {
      categoryId,
      deletedBy: req.user.id,
      ip: req.ip,
    });

    return responseHandler.success(res, null, "Category deleted successfully");
  });

  restoreCategory = asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return responseHandler.error(res, "Invalid category ID", 400);
    }

    const category = await categoriesService.restoreCategory(
      categoryId,
      req.user.id
    );

    logger.info("Category restored", {
      categoryId,
      restoredBy: req.user.id,
      ip: req.ip,
    });

    return responseHandler.success(
      res,
      { category },
      "Category restored successfully"
    );
  });

  updateCategoryStatus = asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return responseHandler.error(res, "Invalid category ID", 400);
    }

    const { isActive } = req.body;
    const category = await categoriesService.updateCategoryStatus(
      categoryId,
      isActive,
      req.user.id
    );

    logger.info("Category status updated", {
      categoryId,
      newStatus: isActive,
      updatedBy: req.user.id,
      ip: req.ip,
    });

    return responseHandler.success(
      res,
      { category },
      `Category ${isActive ? "activated" : "deactivated"} successfully`
    );
  });

  reorderCategories = asyncHandler(async (req, res) => {
    const { categoryOrders } = req.body;

    if (!Array.isArray(categoryOrders) || categoryOrders.length === 0) {
      return responseHandler.validationError(
        res,
        [
          {
            field: "categoryOrders",
            message: "Category orders array is required",
          },
        ],
        "Invalid request data"
      );
    }

    const result = await categoriesService.reorderCategories(
      categoryOrders,
      req.user.id
    );

    logger.info("Categories reordered", {
      categoriesCount: categoryOrders.length,
      updatedBy: req.user.id,
      ip: req.ip,
    });

    return responseHandler.success(
      res,
      { updatedCategories: result },
      "Categories reordered successfully"
    );
  });

  getCategoryStats = asyncHandler(async (req, res) => {
    const stats = await categoriesService.getCategoryStats();
    return responseHandler.success(
      res,
      { stats },
      "Category statistics retrieved successfully"
    );
  });

  getPublicCategories = asyncHandler(async (req, res) => {
    const { includeItems = "true" } = req.query;

    const categories = await categoriesService.getPublicCategories({
      includeItems: includeItems === "true",
    });

    // Set cache headers for public endpoint
    res.set({
      "Cache-Control": "public, max-age=300", // 5 minutes cache
      ETag: responseHandler.generateETag
        ? responseHandler.generateETag(categories)
        : undefined,
    });

    return responseHandler.success(
      res,
      { categories },
      "Public categories retrieved successfully"
    );
  });

  searchCategories = asyncHandler(async (req, res) => {
    const { query, limit = "10", includeItems = "false" } = req.query;

    if (!query || query.trim().length < 2) {
      return responseHandler.validationError(
        res,
        [
          {
            field: "query",
            message: "Search query must be at least 2 characters",
          },
        ],
        "Invalid search query"
      );
    }

    const results = await categoriesService.searchCategories(query.trim(), {
      limit: parseInt(limit),
      includeItems: includeItems === "true",
    });

    return responseHandler.success(
      res,
      { results },
      "Search completed successfully"
    );
  });

  getCategoryItemsCount = asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return responseHandler.error(res, "Invalid category ID", 400);
    }

    const counts = await categoriesService.getCategoryItemsCount(categoryId);
    return responseHandler.success(
      res,
      { counts },
      "Category items count retrieved successfully"
    );
  });

  bulkUpdateCategories = asyncHandler(async (req, res) => {
    const { categories, operation } = req.body;

    if (!Array.isArray(categories) || !operation) {
      return responseHandler.validationError(
        res,
        [
          { field: "categories", message: "Categories array is required" },
          { field: "operation", message: "Operation is required" },
        ],
        "Invalid request data"
      );
    }

    const result = await categoriesService.bulkUpdateCategories(
      categories,
      operation,
      req.user.id
    );

    logger.info("Bulk categories update", {
      operation,
      categoriesCount: categories.length,
      updatedBy: req.user.id,
      ip: req.ip,
    });

    return responseHandler.success(
      res,
      { result },
      `Categories ${operation} completed successfully`
    );
  });

  exportCategories = asyncHandler(async (req, res) => {
    const { format = "json", includeItems = false } = req.body;
    const exportedBy = req.user.id;

    const exportData = await categoriesService.exportCategories({
      format,
      includeItems,
      exportedBy,
    });

    logger.info("Categories exported", {
      format,
      includeItems,
      exportedBy,
      ip: req.ip,
    });

    if (format === "file" && exportData.filePath) {
      return responseHandler.download
        ? responseHandler.download(
            res,
            exportData.filePath,
            exportData.fileName,
            "application/json"
          )
        : responseHandler.success(res, exportData, "Export file prepared");
    }

    return responseHandler.success(
      res,
      { data: exportData },
      "Categories exported successfully"
    );
  });

  getCategoryAnalytics = asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return responseHandler.error(res, "Invalid category ID", 400);
    }

    const {
      dateFrom,
      dateTo,
      includeOrders = "true",
      includeSales = "true",
    } = req.query;

    const analytics = await categoriesService.getCategoryAnalytics(categoryId, {
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      includeOrders: includeOrders === "true",
      includeSales: includeSales === "true",
    });

    return responseHandler.success(
      res,
      { analytics },
      "Category analytics retrieved successfully"
    );
  });
}

const categoriesController = new CategoriesController();
export default categoriesController;
