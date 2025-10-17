import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../../middleware/errorHandler.js";

/**
 * Suppliers Service V2
 * Advanced supplier management with purchase history tracking
 */
class SuppliersService {
  constructor() {
    this.cache = redisClient.cache(3600); // 1 hour cache
  }

  /**
   * Get all suppliers with pagination and filtering
   */
  async getAllSuppliers(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        isActive,
        sortBy = "supplierName",
        sortOrder = "asc",
      } = options;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {};

      if (search) {
        where.OR = [
          { supplierName: { contains: search, mode: "insensitive" } },
          { representativeName: { contains: search, mode: "insensitive" } },
          { contactEmail: { contains: search, mode: "insensitive" } },
          { representativePhone: { contains: search, mode: "insensitive" } },
        ];
      }

      if (typeof isActive === "boolean") {
        where.isActive = isActive;
      }

      // Build order by
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      // Get total count
      const total = await this.db.supplier.count({ where });

      // Get suppliers with aggregated data
      const suppliers = await this.db.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          supplyInvoices: {
            select: {
              id: true,
              totalAmount: true,
              invoiceDate: true,
              status: true,
            },
            orderBy: {
              invoiceDate: "desc",
            },
            take: 5, // Last 5 invoices for summary
          },
          _count: {
            select: {
              supplyInvoices: true,
            },
          },
        },
      });

      // Add calculated fields
      const suppliersWithStats = suppliers.map((supplier) => {
        const totalSpent = supplier.supplyInvoices.reduce(
          (sum, invoice) => sum + Number(invoice.totalAmount),
          0
        );
        const lastPurchaseDate =
          supplier.supplyInvoices[0]?.invoiceDate || null;
        const pendingInvoices = supplier.supplyInvoices.filter(
          (inv) => inv.status === "PENDING"
        ).length;

        return {
          ...supplier,
          totalSpent,
          lastPurchaseDate,
          pendingInvoices,
          totalInvoices: supplier._count.supplyInvoices,
        };
      });

      logger.info("Suppliers retrieved successfully", {
        total,
        returned: suppliers.length,
        filters: { search, isActive },
      });

      return {
        suppliers: suppliersWithStats,
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
      logger.error("Get all suppliers failed", {
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Get supplier by ID with detailed information
   */
  async getSupplierById(supplierId) {
    try {
      const cacheKey = `supplier:${supplierId}`;
      let supplier = await this.cache.get(cacheKey);

      if (!supplier) {
        supplier = await this.db.supplier.findUnique({
          where: { id: supplierId },
          include: {
            supplyInvoices: {
              include: {
                supplyInvoiceItems: {
                  include: {
                    item: {
                      select: {
                        itemNameAr: true,
                        itemNameEn: true,
                        itemCode: true,
                      },
                    },
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
              },
              orderBy: {
                invoiceDate: "desc",
              },
              take: 10, // Last 10 invoices
            },
            _count: {
              select: {
                supplyInvoices: true,
              },
            },
          },
        });

        if (!supplier) {
          throw new NotFoundError("Supplier");
        }

        // Calculate additional statistics
        const totalSpent = supplier.supplyInvoices.reduce(
          (sum, invoice) => sum + Number(invoice.totalAmount),
          0
        );

        const invoicesByStatus = supplier.supplyInvoices.reduce(
          (acc, invoice) => {
            acc[invoice.status] = (acc[invoice.status] || 0) + 1;
            return acc;
          },
          {}
        );

        const avgInvoiceAmount = supplier.supplyInvoices.length
          ? totalSpent / supplier.supplyInvoices.length
          : 0;

        supplier.stats = {
          totalSpent,
          avgInvoiceAmount,
          totalInvoices: supplier._count.supplyInvoices,
          invoicesByStatus,
        };

        await this.cache.set(cacheKey, supplier);
      }

      return supplier;
    } catch (error) {
      logger.error("Get supplier by ID failed", {
        supplierId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new supplier
   */
  async createSupplier(supplierData, createdBy) {
    try {
      const {
        supplierName,
        taxNumber,
        commercialRegister,
        nationalAddress,
        representativeName,
        representativePhone,
        contactEmail,
      } = supplierData;

      // Check if supplier with same tax number exists
      if (taxNumber) {
        const existingSupplier = await this.db.supplier.findFirst({
          where: { taxNumber },
        });

        if (existingSupplier) {
          throw new ConflictError(
            "Supplier with this tax number already exists"
          );
        }
      }

      // Check if supplier with same commercial register exists
      if (commercialRegister) {
        const existingSupplier = await this.db.supplier.findFirst({
          where: { commercialRegister },
        });

        if (existingSupplier) {
          throw new ConflictError(
            "Supplier with this commercial register already exists"
          );
        }
      }

      // Create supplier
      const supplier = await this.db.supplier.create({
        data: {
          supplierName,
          taxNumber,
          commercialRegister,
          nationalAddress,
          representativeName,
          representativePhone,
          contactEmail,
          isActive: true,
        },
      });

      // Clear cache
      await this.invalidateSupplierCaches();

      logger.info("Supplier created successfully", {
        supplierId: supplier.id,
        supplierName: supplier.supplierName,
        createdBy: createdBy.id,
      });

      return await this.getSupplierById(supplier.id);
    } catch (error) {
      logger.error("Create supplier failed", {
        supplierName: supplierData.supplierName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(supplierId, updateData, updatedBy) {
    try {
      const existingSupplier = await this.db.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!existingSupplier) {
        throw new NotFoundError("Supplier");
      }

      // Check tax number uniqueness if being updated
      if (
        updateData.taxNumber &&
        updateData.taxNumber !== existingSupplier.taxNumber
      ) {
        const taxExists = await this.db.supplier.findFirst({
          where: {
            taxNumber: updateData.taxNumber,
            NOT: { id: supplierId },
          },
        });

        if (taxExists) {
          throw new ConflictError("Tax number already exists");
        }
      }

      // Check commercial register uniqueness if being updated
      if (
        updateData.commercialRegister &&
        updateData.commercialRegister !== existingSupplier.commercialRegister
      ) {
        const registerExists = await this.db.supplier.findFirst({
          where: {
            commercialRegister: updateData.commercialRegister,
            NOT: { id: supplierId },
          },
        });

        if (registerExists) {
          throw new ConflictError("Commercial register already exists");
        }
      }

      // Update supplier
      const updatedSupplier = await this.db.supplier.update({
        where: { id: supplierId },
        data: updateData,
      });

      // Clear cache
      await this.cache.del(`supplier:${supplierId}`);
      await this.invalidateSupplierCaches();

      logger.info("Supplier updated successfully", {
        supplierId,
        updatedBy: updatedBy.id,
        fields: Object.keys(updateData),
      });

      return await this.getSupplierById(supplierId);
    } catch (error) {
      logger.error("Update supplier failed", {
        supplierId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete supplier (soft delete)
   */
  async deleteSupplier(supplierId, deletedBy) {
    try {
      const supplier = await this.db.supplier.findUnique({
        where: { id: supplierId },
        include: {
          supplyInvoices: {
            where: {
              status: { in: ["PENDING", "APPROVED"] },
            },
          },
        },
      });

      if (!supplier) {
        throw new NotFoundError("Supplier");
      }

      // Check if supplier has pending or approved invoices
      if (supplier.supplyInvoices.length > 0) {
        throw new AppError(
          "Cannot delete supplier with pending or approved invoices",
          400
        );
      }

      // Soft delete
      await this.db.supplier.update({
        where: { id: supplierId },
        data: {
          isActive: false,
        },
      });

      // Clear cache
      await this.cache.del(`supplier:${supplierId}`);
      await this.invalidateSupplierCaches();

      logger.info("Supplier deleted successfully", {
        supplierId,
        supplierName: supplier.supplierName,
        deletedBy: deletedBy.id,
      });
    } catch (error) {
      logger.error("Delete supplier failed", {
        supplierId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active suppliers (for dropdowns)
   */
  async getActiveSuppliers() {
    try {
      const cacheKey = "active_suppliers";
      let suppliers = await this.cache.get(cacheKey);

      if (!suppliers) {
        suppliers = await this.db.supplier.findMany({
          where: { isActive: true },
          select: {
            id: true,
            supplierName: true,
            representativeName: true,
            representativePhone: true,
            contactEmail: true,
          },
          orderBy: { supplierName: "asc" },
        });

        await this.cache.set(cacheKey, suppliers);
      }

      return suppliers;
    } catch (error) {
      logger.error("Get active suppliers failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get supplier statistics
   */
  async getSupplierStats() {
    try {
      const cacheKey = "supplier_stats";
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const [
          totalSuppliers,
          activeSuppliers,
          totalPurchaseValue,
          avgSupplierRating,
          suppliersWithPendingInvoices,
        ] = await Promise.all([
          this.db.supplier.count(),
          this.db.supplier.count({ where: { isActive: true } }),
          this.db.supplyInvoice.aggregate({
            _sum: { totalAmount: true },
            where: { status: "APPROVED" },
          }),
          // Mock rating - would be calculated from actual rating system
          Promise.resolve(4.2),
          this.db.supplier.count({
            where: {
              supplyInvoices: {
                some: {
                  status: "PENDING",
                },
              },
            },
          }),
        ]);

        stats = {
          totalSuppliers,
          activeSuppliers,
          inactiveSuppliers: totalSuppliers - activeSuppliers,
          totalPurchaseValue: totalPurchaseValue._sum.totalAmount || 0,
          avgSupplierRating,
          suppliersWithPendingInvoices,
          timestamp: new Date().toISOString(),
        };

        // Cache for 30 minutes
        await this.cache.set(cacheKey, stats, 1800);
      }

      return stats;
    } catch (error) {
      logger.error("Get supplier stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get supplier purchase history
   */
  async getSupplierPurchaseHistory(supplierId, options = {}) {
    try {
      const { page = 1, limit = 10, fromDate, toDate, status } = options;

      const skip = (page - 1) * limit;
      const where = { supplierId };

      // Date filtering
      if (fromDate || toDate) {
        where.invoiceDate = {};
        if (fromDate) where.invoiceDate.gte = new Date(fromDate);
        if (toDate) where.invoiceDate.lte = new Date(toDate);
      }

      // Status filtering
      if (status) {
        where.status = status;
      }

      const [total, purchases] = await Promise.all([
        this.db.supplyInvoice.count({ where }),
        this.db.supplyInvoice.findMany({
          where,
          skip,
          take: limit,
          include: {
            supplyInvoiceItems: {
              include: {
                item: {
                  select: {
                    itemNameAr: true,
                    itemNameEn: true,
                    itemCode: true,
                  },
                },
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
          },
          orderBy: {
            invoiceDate: "desc",
          },
        }),
      ]);

      return {
        purchases,
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
      logger.error("Get supplier purchase history failed", {
        supplierId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Search suppliers by criteria
   */
  async searchSuppliers(searchQuery, limit = 10) {
    try {
      const suppliers = await this.db.supplier.findMany({
        where: {
          OR: [
            { supplierName: { contains: searchQuery, mode: "insensitive" } },
            {
              representativeName: {
                contains: searchQuery,
                mode: "insensitive",
              },
            },
            { contactEmail: { contains: searchQuery, mode: "insensitive" } },
            { representativePhone: { contains: searchQuery } },
          ],
          isActive: true,
        },
        take: limit,
        select: {
          id: true,
          supplierName: true,
          representativeName: true,
          representativePhone: true,
          contactEmail: true,
        },
        orderBy: {
          supplierName: "asc",
        },
      });

      return suppliers;
    } catch (error) {
      logger.error("Search suppliers failed", {
        searchQuery,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get supplier performance metrics
   */
  async getSupplierPerformance(supplierId, period = "month") {
    try {
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

      const [invoices, totalValue, avgDeliveryTime] = await Promise.all([
        this.db.supplyInvoice.findMany({
          where: {
            supplierId,
            invoiceDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            totalAmount: true,
            status: true,
            invoiceDate: true,
            createdAt: true,
          },
        }),
        this.db.supplyInvoice.aggregate({
          _sum: { totalAmount: true },
          where: {
            supplierId,
            invoiceDate: {
              gte: startDate,
              lte: endDate,
            },
            status: "APPROVED",
          },
        }),
        // Mock calculation - would be based on actual delivery tracking
        Promise.resolve(3.5),
      ]);

      const performance = {
        period,
        totalInvoices: invoices.length,
        totalValue: totalValue._sum.totalAmount || 0,
        avgInvoiceValue: invoices.length
          ? (totalValue._sum.totalAmount || 0) / invoices.length
          : 0,
        statusBreakdown: invoices.reduce((acc, inv) => {
          acc[inv.status] = (acc[inv.status] || 0) + 1;
          return acc;
        }, {}),
        avgDeliveryTime,
        onTimeDeliveryRate: 85, // Mock data
        qualityRating: 4.2, // Mock data
      };

      return performance;
    } catch (error) {
      logger.error("Get supplier performance failed", {
        supplierId,
        period,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Invalidate supplier-related caches
   */
  async invalidateSupplierCaches() {
    const cacheKeys = ["supplier_stats", "active_suppliers"];
    await Promise.all(cacheKeys.map((key) => this.cache.del(key)));
  }
}
const suppliersService = new SuppliersService();
export default suppliersService;
