import supplyInvoicesService from "./supplyInvoices.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";

/**
 * Supply Invoices Controller V2
 * Handles supply invoice operations for inventory management
 */
class SupplyInvoicesController {
  /**
   * Get all supply invoices with filtering and pagination
   */
  getAllSupplyInvoices = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100),
      supplierId: req.query.supplierId
        ? parseInt(req.query.supplierId)
        : undefined,
      status: req.query.status,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      sortBy: req.query.sortBy || "invoiceDate",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await supplyInvoicesService.getAllSupplyInvoices(options);
    return responseHandler.paginated(
      res,
      result.invoices,
      result.pagination,
      "Supply invoices retrieved successfully"
    );
  });

  /**
   * Get supply invoice by ID
   */
  getSupplyInvoiceById = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const invoice = await supplyInvoicesService.getSupplyInvoiceById(invoiceId);
    return responseHandler.success(
      res,
      invoice,
      "Supply invoice retrieved successfully"
    );
  });

  /**
   * Create new supply invoice
   */
  createSupplyInvoice = asyncHandler(async (req, res) => {
    const invoice = await supplyInvoicesService.createSupplyInvoice(
      req.body,
      req.user
    );
    return responseHandler.created(
      res,
      invoice,
      "Supply invoice created successfully"
    );
  });

  /**
   * Update supply invoice
   */
  updateSupplyInvoice = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const invoice = await supplyInvoicesService.updateSupplyInvoice(
      invoiceId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      invoice,
      "Supply invoice updated successfully"
    );
  });

  /**
   * Approve supply invoice
   */
  approveSupplyInvoice = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const { notes } = req.body;
    const invoice = await supplyInvoicesService.approveSupplyInvoice(
      invoiceId,
      req.user,
      notes
    );
    return responseHandler.success(
      res,
      invoice,
      "Supply invoice approved successfully"
    );
  });

  /**
   * Reject supply invoice
   */
  rejectSupplyInvoice = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const { reason } = req.body;
    const invoice = await supplyInvoicesService.rejectSupplyInvoice(
      invoiceId,
      req.user,
      reason
    );
    return responseHandler.success(
      res,
      invoice,
      "Supply invoice rejected successfully"
    );
  });

  /**
   * Delete supply invoice
   */
  deleteSupplyInvoice = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    await supplyInvoicesService.deleteSupplyInvoice(invoiceId, req.user);
    return responseHandler.success(
      res,
      null,
      "Supply invoice deleted successfully"
    );
  });

  /**
   * Get pending supply invoices (for approval queue)
   */
  getPendingInvoices = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
    };

    const result = await supplyInvoicesService.getPendingInvoices(options);
    return responseHandler.paginated(
      res,
      result.invoices,
      result.pagination,
      "Pending invoices retrieved successfully"
    );
  });

  /**
   * Get supply invoice statistics
   */
  getSupplyInvoiceStats = asyncHandler(async (req, res) => {
    const { period = "month" } = req.query;
    const stats = await supplyInvoicesService.getSupplyInvoiceStats(period);
    return responseHandler.success(
      res,
      stats,
      "Supply invoice statistics retrieved successfully"
    );
  });

  /**
   * Bulk approve invoices
   */
  bulkApproveInvoices = asyncHandler(async (req, res) => {
    const { invoiceIds, notes } = req.body;
    const result = await supplyInvoicesService.bulkApproveInvoices(
      invoiceIds,
      req.user,
      notes
    );
    return responseHandler.success(
      res,
      result,
      "Invoices bulk approved successfully"
    );
  });

  /**
   * Generate supply report
   */
  generateSupplyReport = asyncHandler(async (req, res) => {
    const options = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      supplierId: req.query.supplierId
        ? parseInt(req.query.supplierId)
        : undefined,
      format: req.query.format || "summary",
    };

    const report = await supplyInvoicesService.generateSupplyReport(
      options,
      req.user
    );
    return responseHandler.success(
      res,
      report,
      "Supply report generated successfully"
    );
  });
}

const supplyInvoicesController = new SupplyInvoicesController();
export default supplyInvoicesController;
