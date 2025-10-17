import express from "express";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";

// Import all inventory sub-routes
import itemsRoutes from "./items/items.routes.js";
import unitsRoutes from "./units/units.routes.js";
import suppliersRoutes from "./suppliers/suppliers.routes.js";
import supplyInvoicesRoutes from "./supply-invoices/supplyInvoices.routes.js";
import stockMovementsRoutes from "./stock-movements/stockMovements.routes.js";
import wasteRequestsRoutes from "./waste-requests/wasteRequests.routes.js";

// Import services for dashboard
import itemsService from "./items/items.service.js";
import suppliersService from "./suppliers/suppliers.service.js";
import supplyInvoicesService from "./supply-invoices/supplyInvoices.service.js";
import wasteRequestsService from "./waste-requests/wasteRequests.service.js";

const router = express.Router();

/**
 * Main Inventory Module Routes V2
 * Combines all inventory-related functionality
 */

// Apply authentication to all inventory routes
router.use(authMiddleware);

// Mount sub-routes
router.use("/items", itemsRoutes);
router.use("/units", unitsRoutes);
router.use("/suppliers", suppliersRoutes);
router.use("/supply-invoices", supplyInvoicesRoutes);
router.use("/stock-movements", stockMovementsRoutes);
router.use("/waste-requests", wasteRequestsRoutes);

// Main inventory dashboard endpoint
router.get(
  "/dashboard",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN"),
  async (req, res) => {
    try {
      // Aggregate data from all inventory services
      const [
        itemStats,
        supplierStats,
        supplyInvoiceStats,
        wasteRequestStats,
        lowStockItems,
        pendingInvoices,
        pendingWasteRequests,
      ] = await Promise.all([
        itemsService.getInventoryStats(),
        suppliersService.getSupplierStats(),
        supplyInvoicesService.getSupplyInvoiceStats("month"),
        wasteRequestsService.getWasteRequestStats("month"),
        itemsService.getLowStockItems(),
        supplyInvoicesService.getPendingInvoices({ limit: 5 }),
        wasteRequestsService.getPendingWasteRequests({ limit: 5 }),
      ]);

      const dashboardData = {
        summary: {
          totalItems: itemStats.totalItems,
          availableItems: itemStats.availableItems,
          lowStockItems: itemStats.lowStockCount,
          outOfStockItems: itemStats.outOfStockCount,
          totalSuppliers: supplierStats.activeSuppliers,
          pendingSupplyInvoices: supplyInvoiceStats.pendingInvoices,
          pendingWasteRequests: wasteRequestStats.pendingRequests,
          monthlyPurchaseValue: supplyInvoiceStats.totalValue,
          monthlyWasteValue: wasteRequestStats.totalWasteValue,
        },
        alerts: [
          ...(lowStockItems.length > 0
            ? [
                {
                  type: "LOW_STOCK",
                  message: `${lowStockItems.length} items are running low on stock`,
                  count: lowStockItems.length,
                  priority: "high",
                },
              ]
            : []),
          ...(pendingInvoices.invoices.length > 0
            ? [
                {
                  type: "PENDING_INVOICES",
                  message: `${pendingInvoices.invoices.length} supply invoices awaiting approval`,
                  count: pendingInvoices.invoices.length,
                  priority: "medium",
                },
              ]
            : []),
          ...(pendingWasteRequests.requests.length > 0
            ? [
                {
                  type: "PENDING_WASTE",
                  message: `${pendingWasteRequests.requests.length} waste requests awaiting approval`,
                  count: pendingWasteRequests.requests.length,
                  priority: "medium",
                },
              ]
            : []),
        ],
        recentActivity: [
          ...pendingInvoices.invoices.slice(0, 3).map((invoice) => ({
            type: "SUPPLY_INVOICE",
            message: `New supply invoice ${invoice.invoiceNumber} from ${invoice.supplier.supplierName}`,
            timestamp: invoice.createdAt,
            amount: invoice.totalAmount,
          })),
          ...pendingWasteRequests.requests.slice(0, 3).map((request) => ({
            type: "WASTE_REQUEST",
            message: `Waste request for ${request.itemName} - ${request.wasteQuantity} units`,
            timestamp: request.requestedAt,
            value: request.wasteValue,
            requestedBy: request.requestedByName,
          })),
        ],
        quickStats: {
          inventoryValue: itemStats.totalStockUnits * 50, // Rough estimate
          topWasteItem:
            wasteRequestStats.topWasteItems?.[0]?.itemName || "None",
          topSupplier:
            supplierStats.totalSuppliers > 0 ? "Available in stats" : "None",
          avgProcessingTime: `${
            supplyInvoiceStats.avgProcessingTime || 0
          } days`,
        },
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: dashboardData,
        message: "Inventory dashboard data retrieved successfully",
      });
    } catch (error) {
      logger.error("Inventory dashboard failed", {
        error: error.message,
        userId: req.user.id,
      });

      res.status(500).json({
        success: false,
        message: "Failed to retrieve dashboard data",
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : error.message,
      });
    }
  }
);

// Health check for inventory module
router.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      module: "inventory",
      status: "healthy",
      subModules: {
        items: "active",
        units: "active",
        suppliers: "active",
        supplyInvoices: "active",
        stockMovements: "active",
        wasteRequests: "active",
      },
      timestamp: new Date().toISOString(),
    },
    message: "Inventory module is healthy",
  });
});

export default router;
