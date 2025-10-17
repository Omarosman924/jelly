import customersService from "./customers.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

/**
 * Customers Controller V2
 * Handles customer management, profiles, loyalty points, and addresses
 */
class CustomersController {
  // ==================== CUSTOMER MANAGEMENT ====================
  /**
   * Get all customers with pagination and filtering
   */
  getAllCustomers = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100),
      search: req.query.search,
      city: req.query.city,
      district: req.query.district,
      deliveryAreaId: req.query.deliveryAreaId
        ? parseInt(req.query.deliveryAreaId)
        : undefined,
      loyaltyPointsMin: req.query.loyaltyPointsMin
        ? parseInt(req.query.loyaltyPointsMin)
        : undefined,
      loyaltyPointsMax: req.query.loyaltyPointsMax
        ? parseInt(req.query.loyaltyPointsMax)
        : undefined,
      hasOrders:
        req.query.hasOrders === "true"
          ? true
          : req.query.hasOrders === "false"
          ? false
          : undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await customersService.getAllCustomers(options);
    return responseHandler.paginated(
      res,
      result.customers,
      result.pagination,
      "Customers retrieved successfully"
    );
  });

  /**
   * Get customer by ID
   */
  getCustomerById = asyncHandler(async (req, res) => {
    const customerId = parseInt(req.params.id);
    if (isNaN(customerId)) {
      return responseHandler.error(res, "Invalid customer ID", 400);
    }

    const customer = await customersService.getCustomerById(
      customerId,
      req.user
    );
    return responseHandler.success(
      res,
      customer,
      "Customer retrieved successfully"
    );
  });

  /**
   * Get current user's customer profile
   */
  getMyProfile = asyncHandler(async (req, res) => {
    // استخدم service method مباشرة
    const user = await customersService.getUserWithCustomerProfile(req.user.id);

    if (!user || !user.customer) {
      return responseHandler.error(res, "Customer profile not found", 404);
    }

    const customer = await customersService.getCustomerById(
      user.customer.id,
      req.user
    );
    return responseHandler.success(
      res,
      customer,
      "Customer profile retrieved successfully"
    );
  });

  /**
   * Update customer profile
   */
  updateCustomer = asyncHandler(async (req, res) => {
    const customerId = parseInt(req.params.id);
    if (isNaN(customerId)) {
      return responseHandler.error(res, "Invalid customer ID", 400);
    }

    const customer = await customersService.updateCustomer(
      customerId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      customer,
      "Customer updated successfully"
    );
  });

  /**
   * Update current user's customer profile
   */
  updateMyProfile = asyncHandler(async (req, res) => {
    if (!req.user.customer) {
      return responseHandler.error(res, "Customer profile not found", 404);
    }

    const customer = await customersService.updateCustomer(
      req.user.customer.id,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      customer,
      "Profile updated successfully"
    );
  });

  /**
   * Delete customer (admin only)
   */
  deleteCustomer = asyncHandler(async (req, res) => {
    const customerId = parseInt(req.params.id);
    if (isNaN(customerId)) {
      return responseHandler.error(res, "Invalid customer ID", 400);
    }

    await customersService.deleteCustomer(customerId, req.user);
    return responseHandler.success(res, null, "Customer deleted successfully");
  });

  // ==================== LOYALTY POINTS ====================

  /**
   * Get customer loyalty points
   */
  getLoyaltyPoints = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;

    if (!customerId) {
      return responseHandler.error(res, "Customer ID required", 400);
    }

    const loyaltyData = await customersService.getLoyaltyPoints(
      customerId,
      req.user
    );
    return responseHandler.success(
      res,
      loyaltyData,
      "Loyalty points retrieved successfully"
    );
  });

  /**
   * Add loyalty points (staff only)
   */
  addLoyaltyPoints = asyncHandler(async (req, res) => {
    const customerId = parseInt(req.params.id);
    if (isNaN(customerId)) {
      return responseHandler.error(res, "Invalid customer ID", 400);
    }

    const { points, reason } = req.body;
    const result = await customersService.addLoyaltyPoints(
      customerId,
      points,
      reason,
      req.user
    );

    return responseHandler.success(
      res,
      result,
      "Loyalty points added successfully"
    );
  });

  /**
   * Redeem loyalty points
   */
  redeemLoyaltyPoints = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;

    if (!customerId) {
      return responseHandler.error(res, "Customer ID required", 400);
    }

    const { points, reason } = req.body;
    const result = await customersService.redeemLoyaltyPoints(
      customerId,
      points,
      reason,
      req.user
    );

    return responseHandler.success(
      res,
      result,
      "Loyalty points redeemed successfully"
    );
  });

  /**
   * Get loyalty points history
   */
  getLoyaltyPointsHistory = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;

    if (!customerId) {
      return responseHandler.error(res, "Customer ID required", 400);
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      type: req.query.type, // 'earned' or 'redeemed'
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    };

    const result = await customersService.getLoyaltyPointsHistory(
      customerId,
      options,
      req.user
    );
    return responseHandler.paginated(
      res,
      result.history,
      result.pagination,
      "Loyalty points history retrieved successfully"
    );
  });

  // ==================== CUSTOMER ADDRESSES ====================

  /**
   * Get customer addresses
   */
  getCustomerAddresses = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;

    if (!customerId) {
      return responseHandler.error(res, "Customer ID required", 400);
    }

    const addresses = await customersService.getCustomerAddresses(
      customerId,
      req.user
    );
    return responseHandler.success(
      res,
      addresses,
      "Customer addresses retrieved successfully"
    );
  });

  /**
   * Add customer address
   */
  addCustomerAddress = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;

    if (!customerId) {
      return responseHandler.error(res, "Customer ID required", 400);
    }

    const address = await customersService.addCustomerAddress(
      customerId,
      req.body,
      req.user
    );
    return responseHandler.created(res, address, "Address added successfully");
  });

  /**
   * Update customer address
   */
  updateCustomerAddress = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;
    const addressId = parseInt(req.params.addressId);

    if (!customerId || isNaN(addressId)) {
      return responseHandler.error(
        res,
        "Customer ID and Address ID required",
        400
      );
    }

    const address = await customersService.updateCustomerAddress(
      customerId,
      addressId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      address,
      "Address updated successfully"
    );
  });

  /**
   * Delete customer address
   */
  deleteCustomerAddress = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;
    const addressId = parseInt(req.params.addressId);

    if (!customerId || isNaN(addressId)) {
      return responseHandler.error(
        res,
        "Customer ID and Address ID required",
        400
      );
    }

    await customersService.deleteCustomerAddress(
      customerId,
      addressId,
      req.user
    );
    return responseHandler.success(res, null, "Address deleted successfully");
  });

  /**
   * Set default address
   */
  setDefaultAddress = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;
    const addressId = parseInt(req.params.addressId);

    if (!customerId || isNaN(addressId)) {
      return responseHandler.error(
        res,
        "Customer ID and Address ID required",
        400
      );
    }

    const result = await customersService.setDefaultAddress(
      customerId,
      addressId,
      req.user
    );
    return responseHandler.success(
      res,
      result,
      "Default address set successfully"
    );
  });

  // ==================== CUSTOMER ORDERS ====================

  /**
   * Get customer orders
   */
  getCustomerOrders = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;

    if (!customerId) {
      return responseHandler.error(res, "Customer ID required", 400);
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 50),
      status: req.query.status,
      orderType: req.query.orderType,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await customersService.getCustomerOrders(
      customerId,
      options,
      req.user
    );
    return responseHandler.paginated(
      res,
      result.orders,
      result.pagination,
      "Customer orders retrieved successfully"
    );
  });

  /**
   * Get customer order statistics
   */
  getCustomerOrderStats = asyncHandler(async (req, res) => {
    const customerId = req.params.id
      ? parseInt(req.params.id)
      : req.user.customer?.id;

    if (!customerId) {
      return responseHandler.error(res, "Customer ID required", 400);
    }

    const stats = await customersService.getCustomerOrderStats(
      customerId,
      req.user
    );
    return responseHandler.success(
      res,
      stats,
      "Customer order statistics retrieved successfully"
    );
  });

  // ==================== CUSTOMER ANALYTICS ====================

  /**
   * Get customer analytics (admin/manager only)
   */
  getCustomerAnalytics = asyncHandler(async (req, res) => {
    const options = {
      period: req.query.period || "month", // day, week, month, year
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      city: req.query.city,
      district: req.query.district,
    };

    const analytics = await customersService.getCustomerAnalytics(options);
    return responseHandler.success(
      res,
      analytics,
      "Customer analytics retrieved successfully"
    );
  });

  /**
   * Get top customers by spending
   */
  getTopCustomers = asyncHandler(async (req, res) => {
    const options = {
      limit: Math.min(parseInt(req.query.limit) || 10, 50),
      period: req.query.period || "all", // month, quarter, year, all
      orderType: req.query.orderType,
    };

    const topCustomers = await customersService.getTopCustomers(options);
    return responseHandler.success(
      res,
      topCustomers,
      "Top customers retrieved successfully"
    );
  });

  /**
   * Export customers data (admin only)
   */
  exportCustomersData = asyncHandler(async (req, res) => {
    const options = {
      format: req.query.format || "excel", // excel, csv, pdf
      includeOrders: req.query.includeOrders === "true",
      includeLoyalty: req.query.includeLoyalty === "true",
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      city: req.query.city,
      district: req.query.district,
    };

    const exportResult = await customersService.exportCustomersData(
      options,
      req.user
    );

    if (options.format === "json") {
      return responseHandler.success(
        res,
        exportResult,
        "Customers data exported successfully"
      );
    }

    return responseHandler.download(
      res,
      exportResult.filePath,
      exportResult.fileName,
      exportResult.contentType
    );
  });

  // ==================== COMPANY CUSTOMERS ====================

  /**
   * Get company customers
   */
  getCompanyCustomers = asyncHandler(async (req, res) => {
    const query = req.validatedQuery || req.query; // ✅ استخدم validatedQuery

    const options = {
      page: parseInt(query.page) || 1,
      limit: Math.min(parseInt(query.limit) || 10, 100),
      search: query.search,
      isActive:
        query.isActive === "true"
          ? true
          : query.isActive === "false"
          ? false
          : undefined,
      sortBy: query.sortBy || "createdAt",
      sortOrder: query.sortOrder || "desc",
    };

    const result = await customersService.getCompanyCustomers(options);
    return responseHandler.paginated(
      res,
      result.companies,
      result.pagination,
      "Company customers retrieved successfully"
    );
  });

  /**
   * Create company customer
   */
  createCompanyCustomer = asyncHandler(async (req, res) => {
    const company = await customersService.createCompanyCustomer(
      req.body,
      req.user
    );
    return responseHandler.created(
      res,
      company,
      "Company customer created successfully"
    );
  });

  /**
   * Update company customer
   */
  updateCompanyCustomer = asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) {
      return responseHandler.error(res, "Invalid company ID", 400);
    }

    const company = await customersService.updateCompanyCustomer(
      companyId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      company,
      "Company customer updated successfully"
    );
  });

  /**
   * Get company customer by ID
   */
  getCompanyCustomerById = asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) {
      return responseHandler.error(res, "Invalid company ID", 400);
    }

    const company = await customersService.getCompanyCustomerById(
      companyId,
      req.user
    );
    return responseHandler.success(
      res,
      company,
      "Company customer retrieved successfully"
    );
  });

  /**
   * Delete company customer
   */
  deleteCompanyCustomer = asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) {
      return responseHandler.error(res, "Invalid company ID", 400);
    }

    await customersService.deleteCompanyCustomer(companyId, req.user);
    return responseHandler.success(
      res,
      null,
      "Company customer deleted successfully"
    );
  });
}

const customersController = new CustomersController();
export default customersController;
