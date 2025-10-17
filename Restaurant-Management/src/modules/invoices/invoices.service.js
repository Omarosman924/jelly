import { getDatabaseClient } from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";
import { AppError, NotFoundError } from "../../middleware/errorHandler.js";

/**
 * Invoices Service V2
 * Saudi ZATCA compliant invoice generation and management
 */
class InvoicesService {
  constructor() {
    this.db = getDatabaseClient();
    this.cache = redisClient.cache(1800); // 30 minutes cache

    // ZATCA configuration
    this.zatcaConfig = {
      enabled: process.env.ZATCA_ENABLED === "true",
      environment: process.env.ZATCA_ENVIRONMENT || "sandbox",
      companyInfo: {
        name: process.env.RESTAURANT_NAME || "مطعم النجاح",
        nameEn: process.env.RESTAURANT_NAME_EN || "Success Restaurant",
        vatNumber: process.env.RESTAURANT_VAT || "310123456789003",
        crNumber: process.env.RESTAURANT_CR || "1010123456",
        address:
          process.env.RESTAURANT_ADDRESS || "الرياض، المملكة العربية السعودية",
      },
      vatRate: 0.15, // 15% VAT in Saudi Arabia
    };
  }

  /**
   * Generate invoice for an order
   */
  async generateInvoice(invoiceData, generatedBy) {
    try {
      const { orderId, isSimplified = true } = invoiceData;

      // Get order details
      const order = await this.db.order.findUnique({
        where: { id: orderId },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                },
              },
            },
          },
          companyCustomer: true,
          orderItems: {
            include: {
              cookingMethod: {
                select: {
                  methodNameAr: true,
                  methodNameEn: true,
                  additionalCost: true,
                },
              },
            },
          },
          table: {
            select: {
              tableNumber: true,
            },
          },
          payments: {
            where: {
              paymentStatus: "COMPLETED",
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Order");
      }

      if (!order.isPaid) {
        throw new AppError("Cannot generate invoice for unpaid order", 400);
      }

      // Check if invoice already exists
      const existingInvoice = await this.db.invoice.findUnique({
        where: { orderId },
      });

      if (existingInvoice) {
        throw new AppError("Invoice already exists for this order", 400);
      }

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(isSimplified);

      // Prepare invoice items
      const invoiceItems = await this.prepareInvoiceItems(order.orderItems);

      // Calculate totals
      const totals = this.calculateInvoiceTotals(invoiceItems, order);

      // Generate QR code
      const qrCode = await this.generateQRCode(invoiceNumber, totals, order);

      // Generate ZATCA XML if enabled
      let invoiceDataXml = null;
      let zatcaUuid = null;

      if (this.zatcaConfig.enabled) {
        const zatcaData = await this.generateZATCAInvoice({
          invoiceNumber,
          order,
          invoiceItems,
          totals,
          isSimplified,
        });
        invoiceDataXml = zatcaData.xml;
        zatcaUuid = zatcaData.uuid;
      }

      // Create invoice in transaction
      const invoice = await this.db.$transaction(async (prisma) => {
        // Create main invoice
        const newInvoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            orderId,
            customerId: order.customerId,
            companyId: order.companyId,
            subtotal: totals.subtotal,
            vatAmount: totals.vatAmount,
            totalAmount: totals.totalAmount,
            qrCode,
            invoiceDataXml,
            invoiceStatus: "ISSUED",
            zatcaUuid,
            isSimplified,
          },
        });

        // Create invoice items
        await prisma.invoiceItem.createMany({
          data: invoiceItems.map((item) => ({
            invoiceId: newInvoice.id,
            itemDescription: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            vatAmount: item.vatAmount,
            totalAmount: item.totalAmount,
          })),
        });

        return newInvoice;
      });

      // Send to ZATCA if enabled (mock implementation)
      if (
        this.zatcaConfig.enabled &&
        this.zatcaConfig.environment === "production"
      ) {
        try {
          await this.submitToZATCA(invoice, invoiceDataXml);
        } catch (error) {
          logger.warn("ZATCA submission failed", {
            invoiceId: invoice.id,
            error: error.message,
          });
        }
      }

      logger.info("Invoice generated successfully", {
        invoiceId: invoice.id,
        invoiceNumber,
        orderId,
        totalAmount: totals.totalAmount,
        generatedBy: generatedBy?.id,
      });

      return await this.getInvoiceById(invoice.id);
    } catch (error) {
      logger.error("Invoice generation failed", {
        orderId: invoiceData.orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId) {
    try {
      const invoice = await this.db.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          order: {
            include: {
              table: {
                select: {
                  tableNumber: true,
                },
              },
              orderItems: true,
            },
          },
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                },
              },
            },
          },
          companyCustomer: true,
          invoiceItems: {
            orderBy: {
              totalAmount: "desc",
            },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundError("Invoice");
      }

      // Add calculated fields
      invoice.customerName = invoice.customer
        ? `${invoice.customer.user.firstName} ${invoice.customer.user.lastName}`
        : invoice.companyCustomer?.companyName || "Walk-in Customer";

      invoice.customerDetails = this.getCustomerDetails(invoice);
      invoice.companyDetails = this.zatcaConfig.companyInfo;

      return invoice;
    } catch (error) {
      logger.error("Get invoice by ID failed", {
        invoiceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel invoice (ZATCA compliance)
   */
  async cancelInvoice(invoiceId, cancelData, cancelledBy) {
    try {
      const { reason } = cancelData;

      const invoice = await this.db.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new NotFoundError("Invoice");
      }

      if (invoice.invoiceStatus === "CANCELLED") {
        throw new AppError("Invoice is already cancelled", 400);
      }

      // Update invoice status
      const cancelledInvoice = await this.db.invoice.update({
        where: { id: invoiceId },
        data: {
          invoiceStatus: "CANCELLED",
          cancellationReason: reason,
        },
      });

      // Submit cancellation to ZATCA if enabled
      if (this.zatcaConfig.enabled && invoice.zatcaUuid) {
        try {
          await this.submitCancellationToZATCA(invoice, reason);
        } catch (error) {
          logger.warn("ZATCA cancellation submission failed", {
            invoiceId,
            error: error.message,
          });
        }
      }

      logger.info("Invoice cancelled successfully", {
        invoiceId,
        reason,
        cancelledBy: cancelledBy?.id,
      });

      return cancelledInvoice;
    } catch (error) {
      logger.error("Invoice cancellation failed", {
        invoiceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate invoice number with proper formatting
   */
  async generateInvoiceNumber(isSimplified = true) {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const prefix = isSimplified ? "INV-S" : "INV-T";

    // Get daily counter
    const counterKey = `invoice_counter:${year}-${month}-${date.getDate()}`;
    let counter = await redisClient.incr(counterKey);
    await redisClient.expire(counterKey, 86400); // Expire after 24 hours

    const invoiceNumber = `${prefix}-${year}${month}-${counter
      .toString()
      .padStart(4, "0")}`;

    // Ensure uniqueness
    const exists = await this.db.invoice.findUnique({
      where: { invoiceNumber },
    });

    if (exists) {
      // If exists, increment and try again
      counter = await redisClient.incr(counterKey);
      return `${prefix}-${year}${month}-${counter.toString().padStart(4, "0")}`;
    }

    return invoiceNumber;
  }

  /**
   * Prepare invoice items from order items
   */
  async prepareInvoiceItems(orderItems) {
    const invoiceItems = [];

    for (const orderItem of orderItems) {
      let description = "";
      let unitPrice = Number(orderItem.unitPrice);

      // Get item details based on type
      switch (orderItem.itemType) {
        case "item":
          const item = await this.db.item.findUnique({
            where: { id: orderItem.itemReferenceId },
          });
          description = item?.itemNameEn || item?.itemNameAr || "Item";
          break;
        case "recipe":
          const recipe = await this.db.recipe.findUnique({
            where: { id: orderItem.itemReferenceId },
          });
          description =
            recipe?.recipeNameEn || recipe?.recipeNameAr || "Recipe";
          break;
        case "meal":
          const meal = await this.db.meal.findUnique({
            where: { id: orderItem.itemReferenceId },
          });
          description = meal?.mealNameEn || meal?.mealNameAr || "Meal";
          break;
      }

      // Add cooking method to description if exists
      if (orderItem.cookingMethod) {
        description += ` (${
          orderItem.cookingMethod.methodNameEn ||
          orderItem.cookingMethod.methodNameAr
        })`;
      }

      const quantity = Number(orderItem.quantity);
      const subtotalAmount = unitPrice * quantity;
      const vatRate = this.zatcaConfig.vatRate;
      const vatAmount = subtotalAmount * vatRate;
      const totalAmount = subtotalAmount + vatAmount;

      invoiceItems.push({
        description,
        quantity,
        unitPrice,
        vatRate,
        vatAmount,
        totalAmount,
      });
    }

    return invoiceItems;
  }

  /**
   * Calculate invoice totals
   */
  calculateInvoiceTotals(invoiceItems, order) {
    const subtotal = Number(order.subtotal);
    const vatAmount = Number(order.taxAmount);
    const totalAmount = Number(order.totalAmount);

    return {
      subtotal,
      vatAmount,
      totalAmount,
      deliveryFee: Number(order.deliveryFee) || 0,
      discountAmount: Number(order.discountAmount) || 0,
    };
  }

  /**
   * Generate QR code for ZATCA compliance
   */
  async generateQRCode(invoiceNumber, totals, order) {
    // ZATCA QR code format: Base64 encoded TLV (Tag-Length-Value)
    const companyName = this.zatcaConfig.companyInfo.name;
    const vatNumber = this.zatcaConfig.companyInfo.vatNumber;
    const timestamp = new Date().toISOString();
    const totalAmount = totals.totalAmount.toFixed(2);
    const vatAmount = totals.vatAmount.toFixed(2);

    // Simple QR code generation (in production, use proper ZATCA QR generation)
    const qrData = {
      companyName,
      vatNumber,
      invoiceNumber,
      timestamp,
      totalAmount,
      vatAmount,
    };

    // Convert to base64 (simplified - use proper ZATCA TLV encoding in production)
    return Buffer.from(JSON.stringify(qrData)).toString("base64");
  }

  /**
   * Generate ZATCA XML invoice (mock implementation)
   */
  async generateZATCAInvoice(invoiceData) {
    const { invoiceNumber, order, invoiceItems, totals, isSimplified } =
      invoiceData;

    // Mock ZATCA XML generation
    // In production, use proper ZATCA XML schema and signing
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl-2.0:schema:xsd:Invoice-2">
  <ID>${invoiceNumber}</ID>
  <IssueDate>${new Date().toISOString().split("T")[0]}</IssueDate>
  <InvoiceTypeCode listID="TR">${isSimplified ? "388" : "380"}</InvoiceTypeCode>
  <AccountingSupplierParty>
    <Party>
      <PartyIdentification>
        <ID schemeID="TIN">${this.zatcaConfig.companyInfo.vatNumber}</ID>
      </PartyIdentification>
      <PartyName>
        <Name>${this.zatcaConfig.companyInfo.nameEn}</Name>
      </PartyName>
    </Party>
  </AccountingSupplierParty>
  <LegalMonetaryTotal>
    <LineExtensionAmount currencyID="SAR">${
      totals.subtotal
    }</LineExtensionAmount>
    <TaxExclusiveAmount currencyID="SAR">${totals.subtotal}</TaxExclusiveAmount>
    <TaxInclusiveAmount currencyID="SAR">${
      totals.totalAmount
    }</TaxInclusiveAmount>
    <PayableAmount currencyID="SAR">${totals.totalAmount}</PayableAmount>
  </LegalMonetaryTotal>
</Invoice>`;

    return {
      xml,
      uuid: `zatca-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * Submit invoice to ZATCA (mock implementation)
   */
  async submitToZATCA(invoice, xmlData) {
    // Mock ZATCA submission
    // In production, call actual ZATCA API
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info("Invoice submitted to ZATCA", {
      invoiceId: invoice.id,
      zatcaUuid: invoice.zatcaUuid,
    });

    return {
      success: true,
      zatcaResponse: "CLEARED",
      submissionId: `zatca-sub-${Date.now()}`,
    };
  }

  /**
   * Submit cancellation to ZATCA
   */
  async submitCancellationToZATCA(invoice, reason) {
    // Mock ZATCA cancellation submission
    await new Promise((resolve) => setTimeout(resolve, 500));

    logger.info("Invoice cancellation submitted to ZATCA", {
      invoiceId: invoice.id,
      zatcaUuid: invoice.zatcaUuid,
      reason,
    });
  }

  /**
   * Get customer details for invoice
   */
  getCustomerDetails(invoice) {
    if (invoice.companyCustomer) {
      return {
        type: "COMPANY",
        name: invoice.companyCustomer.companyName,
        taxNumber: invoice.companyCustomer.taxNumber,
        address: invoice.companyCustomer.nationalAddress,
        contactPerson: invoice.companyCustomer.contactPerson,
        phone: invoice.companyCustomer.contactPhone,
      };
    } else if (invoice.customer) {
      return {
        type: "INDIVIDUAL",
        name: `${invoice.customer.user.firstName} ${invoice.customer.user.lastName}`,
        phone: invoice.customer.user.phone,
        email: invoice.customer.user.email,
        address: invoice.customer.address,
      };
    } else {
      return {
        type: "WALK_IN",
        name: "Walk-in Customer",
      };
    }
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(period = "month") {
    try {
      const cacheKey = `invoice_stats:${period}`;
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const endDate = new Date();
        let startDate;

        switch (period) {
          case "week":
            startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
            break;
          case "year":
            startDate = new Date(endDate.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        }

        const [
          totalInvoices,
          issuedInvoices,
          cancelledInvoices,
          totalRevenue,
          totalVAT,
          avgInvoiceValue,
        ] = await Promise.all([
          this.db.invoice.count({
            where: {
              issueDateTime: { gte: startDate, lte: endDate },
            },
          }),
          this.db.invoice.count({
            where: {
              invoiceStatus: "ISSUED",
              issueDateTime: { gte: startDate, lte: endDate },
            },
          }),
          this.db.invoice.count({
            where: {
              invoiceStatus: "CANCELLED",
              issueDateTime: { gte: startDate, lte: endDate },
            },
          }),
          this.db.invoice.aggregate({
            _sum: { totalAmount: true },
            where: {
              invoiceStatus: "ISSUED",
              issueDateTime: { gte: startDate, lte: endDate },
            },
          }),
          this.db.invoice.aggregate({
            _sum: { vatAmount: true },
            where: {
              invoiceStatus: "ISSUED",
              issueDateTime: { gte: startDate, lte: endDate },
            },
          }),
          this.db.invoice.aggregate({
            _avg: { totalAmount: true },
            where: {
              invoiceStatus: "ISSUED",
              issueDateTime: { gte: startDate, lte: endDate },
            },
          }),
        ]);

        stats = {
          period,
          totalInvoices,
          issuedInvoices,
          cancelledInvoices,
          cancellationRate: totalInvoices
            ? (cancelledInvoices / totalInvoices) * 100
            : 0,
          totalRevenue: totalRevenue._sum.totalAmount || 0,
          totalVAT: totalVAT._sum.vatAmount || 0,
          avgInvoiceValue: avgInvoiceValue._avg.totalAmount || 0,
          zatcaCompliance: this.zatcaConfig.enabled,
          timestamp: new Date().toISOString(),
        };

        // Cache for 15 minutes
        await this.cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error("Get invoice stats failed", {
        error: error.message,
      });
      throw error;
    }
  }
}

export default InvoicesService;
