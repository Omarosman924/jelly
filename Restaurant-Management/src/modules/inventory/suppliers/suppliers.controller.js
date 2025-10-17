import suppliersService from "./suppliers.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";

/**
 * Suppliers Controller V2
 * Handles supplier management operations
 */
class SuppliersController {
  /**
   * Get all suppliers with pagination and filtering
   */
  getAllSuppliers = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100),
      search: req.query.search,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      sortBy: req.query.sortBy || "supplierName",
      sortOrder: req.query.sortOrder || "asc",
    };

    const result = await suppliersService.getAllSuppliers(options);
    return responseHandler.paginated(
      res,
      result.suppliers,
      result.pagination,
      "Suppliers retrieved successfully"
    );
  });

  /**
   * Get supplier by ID
   */
  getSupplierById = asyncHandler(async (req, res) => {
    const supplierId = parseInt(req.params.id);
    if (isNaN(supplierId)) {
      return responseHandler.error(res, "Invalid supplier ID", 400);
    }

    const supplier = await suppliersService.getSupplierById(supplierId);
    return responseHandler.success(
      res,
      supplier,
      "Supplier retrieved successfully"
    );
  });

  /**
   * Create new supplier
   */
  createSupplier = asyncHandler(async (req, res) => {
    const supplier = await suppliersService.createSupplier(req.body, req.user);
    return responseHandler.created(
      res,
      supplier,
      "Supplier created successfully"
    );
  });

  /**
   * Update supplier
   */
  updateSupplier = asyncHandler(async (req, res) => {
    const supplierId = parseInt(req.params.id);
    if (isNaN(supplierId)) {
      return responseHandler.error(res, "Invalid supplier ID", 400);
    }

    const supplier = await suppliersService.updateSupplier(
      supplierId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      supplier,
      "Supplier updated successfully"
    );
  });

  /**
   * Delete supplier
   */
  deleteSupplier = asyncHandler(async (req, res) => {
    const supplierId = parseInt(req.params.id);
    if (isNaN(supplierId)) {
      return responseHandler.error(res, "Invalid supplier ID", 400);
    }

    await suppliersService.deleteSupplier(supplierId, req.user);
    return responseHandler.success(res, null, "Supplier deleted successfully");
  });

  /**
   * Get supplier statistics
   */
  getSupplierStats = asyncHandler(async (req, res) => {
    const stats = await suppliersService.getSupplierStats();
    return responseHandler.success(
      res,
      stats,
      "Supplier statistics retrieved successfully"
    );
  });

  /**
   * Get active suppliers (for dropdowns)
   */
  getActiveSuppliers = asyncHandler(async (req, res) => {
    const suppliers = await suppliersService.getActiveSuppliers();
    return responseHandler.success(
      res,
      suppliers,
      "Active suppliers retrieved successfully"
    );
  });

  /**
   * Get supplier purchase history
   */
  getSupplierPurchaseHistory = asyncHandler(async (req, res) => {
    const supplierId = parseInt(req.params.id);
    if (isNaN(supplierId)) {
      return responseHandler.error(res, "Invalid supplier ID", 400);
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 50),
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      status: req.query.status,
    };

    const result = await suppliersService.getSupplierPurchaseHistory(
      supplierId,
      options
    );
    return responseHandler.paginated(
      res,
      result.purchases,
      result.pagination,
      "Purchase history retrieved successfully"
    );
  });
}

const suppliersController = new SuppliersController();
export default suppliersController;
