import express from "express";
import customersController from "./customers.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateRequest, validateQuery } from "./customers.validation.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// ==================== CUSTOMER PROFILE ROUTES ====================

router.get("/me", customersController.getMyProfile);

router.put(
  "/me",
  validateRequest("updateProfile"),
  customersController.updateMyProfile
);

router.get("/me/loyalty", customersController.getLoyaltyPoints);

router.get(
  "/me/loyalty/history",
  validateQuery("loyaltyHistoryQuery"),
  customersController.getLoyaltyPointsHistory
);

router.post(
  "/me/loyalty/redeem",
  validateRequest("redeemLoyaltyPoints"),
  customersController.redeemLoyaltyPoints
);

router.get("/me/addresses", customersController.getCustomerAddresses);

router.post(
  "/me/addresses",
  validateRequest("addAddress"),
  customersController.addCustomerAddress
);

router.put(
  "/me/addresses/:addressId",
  validateRequest("updateAddress"),
  customersController.updateCustomerAddress
);

router.delete(
  "/me/addresses/:addressId",
  customersController.deleteCustomerAddress
);

router.patch(
  "/me/addresses/:addressId/default",
  customersController.setDefaultAddress
);

router.get(
  "/me/orders",
  validateQuery("customerOrdersQuery"),
  customersController.getCustomerOrders
);

router.get("/me/orders/stats", customersController.getCustomerOrderStats);

// ==================== COMPANY CUSTOMERS ROUTES ====================
// ✅ ضع هذه قبل الـ routes التي تستخدم /:id

router.get(
  "/companies", // ✅ غيّر من /companies/list إلى /companies
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  validateQuery("companyCustomersQuery"),
  customersController.getCompanyCustomers
);

router.post(
  "/companies",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("createCompanyCustomer"),
  customersController.createCompanyCustomer
);

router.get(
  "/companies/:id",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  customersController.getCompanyCustomerById
);

router.put(
  "/companies/:id",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateCompanyCustomer"),
  customersController.updateCompanyCustomer
);

router.delete(
  "/companies/:id",
  requireRole("ADMIN"),
  customersController.deleteCompanyCustomer
);

// ==================== CUSTOMER MANAGEMENT ROUTES (STAFF ONLY) ====================

router.get(
  "/analytics",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("analyticsQuery"),
  customersController.getCustomerAnalytics
);

router.get(
  "/top",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("topCustomersQuery"),
  customersController.getTopCustomers
);

router.get(
  "/export",
  requireRole("ADMIN"),
  validateQuery("exportQuery"),
  customersController.exportCustomersData
);

// ✅ ضع routes مع /:id في النهاية
router.get(
  "/",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  validateQuery("customersQuery"),
  customersController.getAllCustomers
);

router.get(
  "/:id",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  customersController.getCustomerById
);

router.put(
  "/:id",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateCustomer"),
  customersController.updateCustomer
);

router.delete("/:id", requireRole("ADMIN"), customersController.deleteCustomer);

// ==================== LOYALTY POINTS MANAGEMENT (STAFF) ====================

router.get(
  "/:id/loyalty",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  customersController.getLoyaltyPoints
);

router.post(
  "/:id/loyalty/add",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  validateRequest("addLoyaltyPoints"),
  customersController.addLoyaltyPoints
);

router.post(
  "/:id/loyalty/redeem",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  validateRequest("redeemLoyaltyPoints"),
  customersController.redeemLoyaltyPoints
);

router.get(
  "/:id/loyalty/history",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  validateQuery("loyaltyHistoryQuery"),
  customersController.getLoyaltyPointsHistory
);

// ==================== CUSTOMER ADDRESSES MANAGEMENT (STAFF) ====================

router.get(
  "/:id/addresses",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  customersController.getCustomerAddresses
);

router.post(
  "/:id/addresses",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("addAddress"),
  customersController.addCustomerAddress
);

router.put(
  "/:id/addresses/:addressId",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateAddress"),
  customersController.updateCustomerAddress
);

router.delete(
  "/:id/addresses/:addressId",
  requireRole("ADMIN", "HALL_MANAGER"),
  customersController.deleteCustomerAddress
);

router.patch(
  "/:id/addresses/:addressId/default",
  requireRole("ADMIN", "HALL_MANAGER"),
  customersController.setDefaultAddress
);

// ==================== CUSTOMER ORDERS (STAFF VIEW) ====================

router.get(
  "/:id/orders",
  requireRole("ADMIN", "HALL_MANAGER", "CASHIER"),
  validateQuery("customerOrdersQuery"),
  customersController.getCustomerOrders
);

router.get(
  "/:id/orders/stats",
  requireRole("ADMIN", "HALL_MANAGER"),
  customersController.getCustomerOrderStats
);

export default router;
