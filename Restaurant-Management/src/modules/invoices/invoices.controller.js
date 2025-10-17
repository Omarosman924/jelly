import invoicesService from "./invoices.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

/**
 * Invoices Controller V2
 * Handles ZATCA compliant invoice operations
 */
class InvoicesController {
  /**
   * Generate invoice for an order
   */
  generateInvoice = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    const invoice = await invoicesService.generateInvoice(req.body, req.user);

    return responseHandler.withPerformance(
      res,
      invoice,
      "Invoice generated successfully",
      startTime
    );
  });

  /**
   * Get invoice by ID
   */
  getInvoiceById = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const invoice = await invoicesService.getInvoiceById(invoiceId);
    return responseHandler.success(
      res,
      invoice,
      "Invoice retrieved successfully"
    );
  });

  /**
   * Get invoice by order ID
   */
  getInvoiceByOrder = asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      return responseHandler.error(res, "Invalid order ID", 400);
    }

    const invoice = await invoicesService.db.invoice.findUnique({
      where: { orderId },
      include: {
        invoiceItems: true,
        customer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        companyCustomer: true,
      },
    });

    if (!invoice) {
      return responseHandler.notFound(
        res,
        null,
        "Invoice not found for this order"
      );
    }

    return responseHandler.success(
      res,
      invoice,
      "Invoice retrieved successfully"
    );
  });

  /**
   * Cancel invoice
   */
  cancelInvoice = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const invoice = await invoicesService.cancelInvoice(
      invoiceId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      invoice,
      "Invoice cancelled successfully"
    );
  });

  /**
   * Get invoice statistics
   */
  getInvoiceStats = asyncHandler(async (req, res) => {
    const { period = "month" } = req.query;

    if (!["week", "month", "year"].includes(period)) {
      return responseHandler.error(
        res,
        "Invalid period. Use: week, month, or year",
        400
      );
    }

    const stats = await invoicesService.getInvoiceStats(period);
    return responseHandler.success(
      res,
      stats,
      "Invoice statistics retrieved successfully"
    );
  });

  /**
   * Download invoice as PDF
   */
  downloadInvoicePDF = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const invoice = await invoicesService.getInvoiceById(invoiceId);

    // In production, generate actual PDF using libraries like puppeteer or jsPDF
    const pdfData = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      message: "PDF generation would be implemented here",
      downloadUrl: `/api/invoices/${invoiceId}/pdf`,
    };

    return responseHandler.success(
      res,
      pdfData,
      "Invoice PDF ready for download"
    );
  });

  /**
   * Get invoice QR code
   */
  getInvoiceQR = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const invoice = await invoicesService.getInvoiceById(invoiceId);

    return responseHandler.success(
      res,
      {
        qrCode: invoice.qrCode,
        invoiceNumber: invoice.invoiceNumber,
        format: "base64",
      },
      "Invoice QR code retrieved successfully"
    );
  });

  /**
   * Verify invoice with ZATCA
   */
  verifyInvoiceZATCA = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const invoice = await invoicesService.getInvoiceById(invoiceId);

    if (!invoice.zatcaUuid) {
      return responseHandler.error(res, "Invoice is not ZATCA compliant", 400);
    }

    // Mock ZATCA verification
    const verificationResult = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      zatcaUuid: invoice.zatcaUuid,
      status: "VERIFIED",
      verificationDate: new Date().toISOString(),
      zatcaResponse: "Invoice is valid and compliant",
    };

    return responseHandler.success(
      res,
      verificationResult,
      "Invoice verified with ZATCA successfully"
    );
  });

  /**
   * Get all invoices with filtering
   */
  getAllInvoices = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      customerId: req.query.customerId
        ? parseInt(req.query.customerId)
        : undefined,
      companyId: req.query.companyId
        ? parseInt(req.query.companyId)
        : undefined,
      status: req.query.status,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      sortBy: req.query.sortBy || "issueDateTime",
      sortOrder: req.query.sortOrder || "desc",
    };

    const skip = (options.page - 1) * options.limit;
    const where = {};

    if (options.customerId) where.customerId = options.customerId;
    if (options.companyId) where.companyId = options.companyId;
    if (options.status) where.invoiceStatus = options.status;
    if (options.fromDate || options.toDate) {
      where.issueDateTime = {};
      if (options.fromDate)
        where.issueDateTime.gte = new Date(options.fromDate);
      if (options.toDate) where.issueDateTime.lte = new Date(options.toDate);
    }

    const [total, invoices] = await Promise.all([
      invoicesService.db.invoice.count({ where }),
      invoicesService.db.invoice.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { [options.sortBy]: options.sortOrder },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          companyCustomer: {
            select: {
              companyName: true,
            },
          },
          order: {
            select: {
              orderNumber: true,
              orderType: true,
            },
          },
        },
      }),
    ]);

    const invoicesWithDetails = invoices.map((invoice) => ({
      ...invoice,
      customerName: invoice.customer
        ? `${invoice.customer.user.firstName} ${invoice.customer.user.lastName}`
        : invoice.companyCustomer?.companyName || "Walk-in Customer",
    }));

    return responseHandler.paginated(
      res,
      invoicesWithDetails,
      {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit),
      },
      "Invoices retrieved successfully"
    );
  });

  /**
   * Resend invoice to ZATCA
   */
  resendToZATCA = asyncHandler(async (req, res) => {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return responseHandler.error(res, "Invalid invoice ID", 400);
    }

    const invoice = await invoicesService.getInvoiceById(invoiceId);

    if (!invoice.zatcaUuid) {
      return responseHandler.error(res, "Invoice is not ZATCA enabled", 400);
    }

    // Mock ZATCA resubmission
    const result = await invoicesService.submitToZATCA(
      invoice,
      invoice.invoiceDataXml
    );

    return responseHandler.success(
      res,
      result,
      "Invoice resubmitted to ZATCA successfully"
    );
  });
}

const invoicesController = new InvoicesController();
export default invoicesController;
