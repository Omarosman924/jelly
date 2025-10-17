import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../../middleware/errorHandler.js";

/**
 * Supply Invoices Service V2
 * Advanced supply invoice management with approval workflow and stock updates
 */
class SupplyInvoicesService {
  constructor() {
    this.db = getDatabaseClient();
    this.cache = redisClient.cache(1800); // 30 minutes cache
    this.alertCache = redisClient.cache(300); // 5 minutes for alerts
  }

  /**
   * Get all supply invoices with filtering and pagination
   */
  async getAllSupplyInvoices(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        supplierId,
        status,
        fromDate,
        toDate,
        sortBy = "invoiceDate",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {};

      if (supplierId) {
        where.supplierId = supplierId;
      }

      if (status) {
        where.status = status;
      }

      if (fromDate || toDate) {
        where.invoiceDate = {};
        if (fromDate) where.invoiceDate.gte = new Date(fromDate);
        if (toDate) where.invoiceDate.lte = new Date(toDate);
      }

      // Build order by
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      // Get total count
      const total = await this.db.supplyInvoice.count({ where });

      // Get invoices with related data
      const invoices = await this.db.supplyInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          supplier: {
            select: {
              supplierName: true,
              representativeName: true,
              representativePhone: true,
            },
          },
          approvedByStaff: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          supplyInvoiceItems: {
            include: {
              item: {
                select: {
                  itemNameAr: true,
                  itemNameEn: true,
                  itemCode: true,
                  unit: {
                    select: {
                      unitSymbol: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              supplyInvoiceItems: true,
            },
          },
        },
      });

      // Add calculated fields
      const invoicesWithStats = invoices.map((invoice) => ({
        ...invoice,
        itemCount: invoice._count.supplyInvoiceItems,
        vatAmount: Number(invoice.totalAmount) - Number(invoice.subtotal),
        isOverdue: this.isInvoiceOverdue(invoice),
        processingDays: this.calculateProcessingDays(invoice),
      }));

      logger.info("Supply invoices retrieved successfully", {
        total,
        returned: invoices.length,
        filters: { supplierId, status, fromDate, toDate },
      });

      return {
        invoices: invoicesWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Get all supply invoices failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get supply invoice by ID with complete details
   */
  async getSupplyInvoiceById(invoiceId) {
    try {
      const cacheKey = `supply_invoice:${invoiceId}`;
      let invoice = await this.cache.get(cacheKey);

      if (!invoice) {
        invoice = await this.db.supplyInvoice.findUnique({
          where: { id: invoiceId },
          include: {
            supplier: true,
            approvedByStaff: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            supplyInvoiceItems: {
              include: {
                item: {
                  include: {
                    unit: {
                      select: {
                        unitNameAr: true,
                        unitNameEn: true,
                        unitSymbol: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                totalCost: "desc",
              },
            },
          },
        });

        if (!invoice) {
          throw new NotFoundError("Supply invoice");
        }

        // Add calculated fields
        invoice.itemCount = invoice.supplyInvoiceItems.length;
        invoice.vatAmount =
          Number(invoice.totalAmount) - Number(invoice.subtotal);
        invoice.isOverdue = this.isInvoiceOverdue(invoice);
        invoice.processingDays = this.calculateProcessingDays(invoice);
        invoice.costBreakdown = this.getCostBreakdown(invoice);

        await this.cache.set(cacheKey, invoice);
      }

      return invoice;
    } catch (error) {
      logger.error("Get supply invoice by ID failed", {
        invoiceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new supply invoice
   */
  async createSupplyInvoice(invoiceData, createdBy) {
    try {
      const {
        invoiceNumber,
        supplierId,
        invoiceDate,
        items = [],
        invoiceImageUrl,
      } = invoiceData;

      // Validate invoice items
      if (items.length === 0) {
        throw new AppError("Invoice must contain at least one item", 400);
      }

      // Check if invoice number already exists for this supplier
      const existingInvoice = await this.db.supplyInvoice.findFirst({
        where: {
          invoiceNumber,
          supplierId,
        },
      });

      if (existingInvoice) {
        throw new ConflictError(
          "Invoice number already exists for this supplier"
        );
      }

      // Verify supplier exists
      const supplier = await this.db.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier || !supplier.isActive) {
        throw new NotFoundError("Active supplier");
      }

      // Validate and calculate totals
      const { subtotal, taxAmount, totalAmount } =
        await this.calculateInvoiceTotals(items);

      // Create invoice in transaction
      const invoice = await this.db.$transaction(async (prisma) => {
        // Create main invoice
        const newInvoice = await prisma.supplyInvoice.create({
          data: {
            invoiceNumber,
            supplierId,
            invoiceDate: new Date(invoiceDate),
            subtotal,
            taxAmount,
            totalAmount,
            invoiceImageUrl,
            status: "PENDING",
          },
        });

        // Create invoice items
        const invoiceItems = await Promise.all(
          items.map(async (item) => {
            const itemData = await this.validateInvoiceItem(item, prisma);
            return prisma.supplyInvoiceItem.create({
              data: {
                supplyInvoiceId: newInvoice.id,
                itemId: item.itemId,
                quantity: item.quantity,
                unitCost: itemData.unitCost,
                totalCost: itemData.totalCost,
              },
            });
          })
        );

        return { ...newInvoice, supplyInvoiceItems: invoiceItems };
      });

      // Publish notification for approval queue
      await redisClient.publish("supply_invoice_events", {
        type: "INVOICE_CREATED",
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierName: supplier.supplierName,
        totalAmount: invoice.totalAmount,
        timestamp: new Date().toISOString(),
      });

      logger.info("Supply invoice created successfully", {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierId,
        totalAmount: invoice.totalAmount,
        itemCount: items.length,
        createdBy: createdBy.id,
      });

      return await this.getSupplyInvoiceById(invoice.id);
    } catch (error) {
      logger.error("Create supply invoice failed", {
        invoiceNumber: invoiceData.invoiceNumber,
        supplierId: invoiceData.supplierId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Approve supply invoice and update stock
   */
  async approveSupplyInvoice(invoiceId, approvedBy, notes = null) {
    try {
      const invoice = await this.db.supplyInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          supplyInvoiceItems: {
            include: {
              item: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundError("Supply invoice");
      }

      if (invoice.status !== "PENDING") {
        throw new AppError("Only pending invoices can be approved", 400);
      }

      // Approve invoice and update stock in transaction
      await this.db.$transaction(async (prisma) => {
        // Update invoice status
        await prisma.supplyInvoice.update({
          where: { id: invoiceId },
          data: {
            status: "APPROVED",
            approvedByStaffId: approvedBy.id,
            approvedAt: new Date(),
          },
        });

        // Update item stock levels and create stock movements
        for (const invoiceItem of invoice.supplyInvoiceItems) {
          const item = invoiceItem.item;
          const newStock =
            Number(item.currentStock) + Number(invoiceItem.quantity);

          // Update item stock
          await prisma.item.update({
            where: { id: item.id },
            data: { currentStock: newStock },
          });

          // Create stock movement record
          await prisma.stockMovement.create({
            data: {
              itemId: item.id,
              movementType: "SUPPLY",
              quantityChange: invoiceItem.quantity,
              quantityBefore: item.currentStock,
              quantityAfter: newStock,
              referenceId: invoiceId,
              referenceType: "supply_invoice",
              createdByStaffId: approvedBy.id,
            },
          });
        }
      });

      // Clear caches
      await this.cache.del(`supply_invoice:${invoiceId}`);
      await this.invalidateInvoiceCaches();

      // Publish approval notification
      await redisClient.publish("supply_invoice_events", {
        type: "INVOICE_APPROVED",
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        approvedBy: approvedBy.id,
        notes,
        timestamp: new Date().toISOString(),
      });

      logger.info("Supply invoice approved successfully", {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        approvedBy: approvedBy.id,
        itemsUpdated: invoice.supplyInvoiceItems.length,
      });

      return await this.getSupplyInvoiceById(invoiceId);
    } catch (error) {
      logger.error("Approve supply invoice failed", {
        invoiceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Reject supply invoice
   */
  async rejectSupplyInvoice(invoiceId, rejectedBy, reason) {
    try {
      const invoice = await this.db.supplyInvoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new NotFoundError("Supply invoice");
      }

      if (invoice.status !== "PENDING") {
        throw new AppError("Only pending invoices can be rejected", 400);
      }

      // Update invoice status
      const rejectedInvoice = await this.db.supplyInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "REJECTED",
          approvedByStaffId: rejectedBy.id,
          approvedAt: new Date(),
        },
      });

      // Clear cache
      await this.cache.del(`supply_invoice:${invoiceId}`);
      await this.invalidateInvoiceCaches();

      // Publish rejection notification
      await redisClient.publish("supply_invoice_events", {
        type: "INVOICE_REJECTED",
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        rejectedBy: rejectedBy.id,
        reason,
        timestamp: new Date().toISOString(),
      });

      logger.info("Supply invoice rejected", {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        rejectedBy: rejectedBy.id,
        reason,
      });

      return await this.getSupplyInvoiceById(invoiceId);
    } catch (error) {
      logger.error("Reject supply invoice failed", {
        invoiceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get pending invoices for approval queue
   */
  async getPendingInvoices(options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const [total, invoices] = await Promise.all([
        this.db.supplyInvoice.count({ where: { status: "PENDING" } }),
        this.db.supplyInvoice.findMany({
          where: { status: "PENDING" },
          skip,
          take: limit,
          include: {
            supplier: {
              select: {
                supplierName: true,
                representativeName: true,
              },
            },
            _count: {
              select: {
                supplyInvoiceItems: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc", // Oldest first for FIFO processing
          },
        }),
      ]);

      // Add urgency indicators
      const invoicesWithUrgency = invoices.map((invoice) => ({
        ...invoice,
        itemCount: invoice._count.supplyInvoiceItems,
        daysPending: this.calculateProcessingDays(invoice),
        isUrgent: this.calculateProcessingDays(invoice) > 3,
        priority: this.calculateInvoicePriority(invoice),
      }));

      return {
        invoices: invoicesWithUrgency,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get pending invoices failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get supply invoice statistics
   */
  async getSupplyInvoiceStats(period = "month") {
    try {
      const cacheKey = `supply_invoice_stats:${period}`;
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
          case "quarter":
            const quarter = Math.floor(endDate.getMonth() / 3);
            startDate = new Date(endDate.getFullYear(), quarter * 3, 1);
            break;
          case "year":
            startDate = new Date(endDate.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        }

        const [
          totalInvoices,
          pendingInvoices,
          approvedInvoices,
          rejectedInvoices,
          totalValue,
          avgProcessingTime,
        ] = await Promise.all([
          this.db.supplyInvoice.count({
            where: {
              createdAt: { gte: startDate, lte: endDate },
            },
          }),
          this.db.supplyInvoice.count({
            where: {
              status: "PENDING",
              createdAt: { gte: startDate, lte: endDate },
            },
          }),
          this.db.supplyInvoice.count({
            where: {
              status: "APPROVED",
              createdAt: { gte: startDate, lte: endDate },
            },
          }),
          this.db.supplyInvoice.count({
            where: {
              status: "REJECTED",
              createdAt: { gte: startDate, lte: endDate },
            },
          }),
          this.db.supplyInvoice.aggregate({
            _sum: { totalAmount: true },
            where: {
              status: "APPROVED",
              createdAt: { gte: startDate, lte: endDate },
            },
          }),
          // Mock calculation - would be based on actual approval times
          Promise.resolve(2.5),
        ]);

        stats = {
          period,
          totalInvoices,
          pendingInvoices,
          approvedInvoices,
          rejectedInvoices,
          totalValue: totalValue._sum.totalAmount || 0,
          avgInvoiceValue: totalInvoices
            ? (totalValue._sum.totalAmount || 0) / totalInvoices
            : 0,
          approvalRate: totalInvoices
            ? (approvedInvoices / totalInvoices) * 100
            : 0,
          avgProcessingTime,
          timestamp: new Date().toISOString(),
        };

        // Cache for 15 minutes
        await this.cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error("Get supply invoice stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate invoice item
   */
  async validateInvoiceItem(item, prisma) {
    const { itemId, quantity, unitCost } = item;

    const itemData = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!itemData) {
      throw new AppError(`Item with ID ${itemId} not found`, 400);
    }

    if (!itemData.isAvailable) {
      throw new AppError(`Item ${itemData.itemCode} is not available`, 400);
    }

    const totalCost = Number(quantity) * Number(unitCost);

    return {
      unitCost: Number(unitCost),
      totalCost,
    };
  }

  /**
   * Calculate invoice totals
   */
  async calculateInvoiceTotals(items) {
    let subtotal = 0;

    for (const item of items) {
      subtotal += Number(item.quantity) * Number(item.unitCost);
    }

    // VAT 15% in Saudi Arabia
    const vatRate = 0.15;
    const taxAmount = subtotal * vatRate;
    const totalAmount = subtotal + taxAmount;

    return {
      subtotal,
      taxAmount,
      totalAmount,
    };
  }

  /**
   * Check if invoice is overdue
   */
  isInvoiceOverdue(invoice) {
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(invoice.createdAt).getTime()) /
        (24 * 60 * 60 * 1000)
    );
    return invoice.status === "PENDING" && daysSinceCreation > 7;
  }

  /**
   * Calculate processing days
   */
  calculateProcessingDays(invoice) {
    const endDate = invoice.approvedAt
      ? new Date(invoice.approvedAt)
      : new Date();
    const startDate = new Date(invoice.createdAt);
    return Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000));
  }

  /**
   * Get cost breakdown
   */
  getCostBreakdown(invoice) {
    return invoice.supplyInvoiceItems.map((item) => ({
      itemName: item.item.itemNameEn || item.item.itemNameAr,
      itemCode: item.item.itemCode,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      percentage: ((item.totalCost / invoice.subtotal) * 100).toFixed(2),
    }));
  }

  /**
   * Calculate invoice priority for processing
   */
  calculateInvoicePriority(invoice) {
    let priority = 0;
    const daysPending = this.calculateProcessingDays(invoice);

    // Age factor
    priority += Math.min(daysPending * 10, 50);

    // Amount factor
    if (invoice.totalAmount > 10000) priority += 20;
    else if (invoice.totalAmount > 5000) priority += 10;

    // Supplier relationship factor (mock)
    priority += 5;

    return Math.min(priority, 100);
  }

  /**
   * Invalidate invoice-related caches
   */
  async invalidateInvoiceCaches() {
    const cacheKeys = [
      "supply_invoice_stats:week",
      "supply_invoice_stats:month",
      "supply_invoice_stats:quarter",
      "supply_invoice_stats:year",
    ];
    await Promise.all(cacheKeys.map((key) => this.cache.del(key)));
  }
}

export default SupplyInvoicesService;
