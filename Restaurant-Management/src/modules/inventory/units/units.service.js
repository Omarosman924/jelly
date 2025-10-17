import { getDatabaseClient } from "../../../utils/database.js";
import logger from "../../../utils/logger.js";
import redisClient from "../../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../../middleware/errorHandler.js";

class UnitsService {
  constructor() {
    this.db = null;
    this.cache = redisClient.cache(3600); // 1 hour cache
  }

  /**
   * Get database client with lazy initialization
   */
  getDb() {
    if (!this.db) {
      this.db = getDatabaseClient();
    }
    return this.db;
  }

  /**
   * Get all units with pagination and filtering
   */
  async getAllUnits(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        isActive,
        sortBy = "unitNameEn",
        sortOrder = "asc",
      } = options;

      // Validate pagination
      if (page < 1 || limit < 1 || limit > 100) {
        throw new ValidationError("Invalid pagination parameters");
      }

      const skip = (page - 1) * limit;
      const where = { deletedAt: null };

      if (search) {
        where.OR = [
          { unitNameAr: { contains: search, mode: "insensitive" } },
          { unitNameEn: { contains: search, mode: "insensitive" } },
          { unitSymbol: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      if (typeof isActive === "boolean") {
        where.isActive = isActive;
      }

      const validSortFields = [
        "unitNameAr",
        "unitNameEn",
        "unitSymbol",
        "createdAt",
      ];
      if (!validSortFields.includes(sortBy)) {
        throw new ValidationError("Invalid sort field");
      }

      const [total, units] = await Promise.all([
        this.getDb().unit.count({ where }),
        this.getDb().unit.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            unitNameAr: true,
            unitNameEn: true,
            unitSymbol: true,
            description: true,
            isActive: true,
            version: true,
            _count: { select: { items: true } },
          },
        }),
      ]);

      return {
        units,
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
      logger.error("Get all units failed", {
        error: error.message,
        options,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get unit by ID
   */
  async getUnitById(unitId) {
    try {
      if (!Number.isInteger(unitId) || unitId <= 0) {
        throw new ValidationError("Invalid unit ID");
      }

      const unit = await this.getDb().unit.findFirst({
        where: {
          id: unitId,
          deletedAt: null,
        },
        select: {
          id: true,
          unitNameAr: true,
          unitNameEn: true,
          unitSymbol: true,
          description: true,
          isActive: true,
          version: true,
          _count: {
            select: {
              items: {
                where: { deletedAt: null },
              },
            },
          },
        },
      });

      if (!unit) {
        throw new NotFoundError("Unit not found");
      }

      return unit;
    } catch (error) {
      logger.error("Get unit by ID failed", {
        unitId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new unit with validation and audit
   */
  async createUnit(unitData, createdBy = null) {
    try {
      const {
        unitNameAr,
        unitNameEn,
        unitSymbol,
        description,
        isActive = true,
      } = unitData;

      // Validate business rules
      await this.validateUnitData(unitData);

      // Check for existing units
      const existing = await this.getDb().unit.findFirst({
        where: {
          OR: [
            { unitSymbol: unitSymbol },
            { unitNameEn: unitNameEn },
            { unitNameAr: unitNameAr },
          ],
          deletedAt: null,
        },
      });

      if (existing) {
        if (existing.unitSymbol === unitSymbol) {
          throw new ConflictError("Unit symbol already exists");
        }
        if (existing.unitNameEn === unitNameEn) {
          throw new ConflictError("English unit name already exists");
        }
        if (existing.unitNameAr === unitNameAr) {
          throw new ConflictError("Arabic unit name already exists");
        }
      }

      // Create unit in transaction
      const unit = await this.getDb().$transaction(async (tx) => {
        const newUnit = await tx.unit.create({
          data: {
            unitNameAr,
            unitNameEn,
            unitSymbol,
            description,
            isActive,
          },
          select: {
            id: true,
            unitNameAr: true,
            unitNameEn: true,
            unitSymbol: true,
            description: true,
            isActive: true,
            version: true,
          },
        });

        // Create audit log
        if (createdBy) {
          await this.createAuditLog(tx, {
            userId: createdBy,
            action: "UNIT_CREATED",
            tableName: "units",
            recordId: newUnit.id,
            newValues: JSON.stringify(unitData),
          });
        }

        return newUnit;
      });

      // Clear cache
      await this.clearCache();

      logger.info("Unit created successfully", {
        unitId: unit.id,
        unitSymbol: unit.unitSymbol,
        createdBy,
      });

      return unit;
    } catch (error) {
      if (error.code === "P2002") {
        const target = error.meta?.target;
        if (target?.includes("unitSymbol")) {
          throw new ConflictError("Unit symbol already exists");
        }
        throw new ConflictError("Unit data conflicts with existing record");
      }

      logger.error("Create unit failed", {
        unitData,
        error: error.message,
        createdBy,
      });
      throw error;
    }
  }

  /**
   * Update unit with validation
   */
  async updateUnit(unitId, updateData, updatedBy = null) {
    try {
      if (!Number.isInteger(unitId) || unitId <= 0) {
        throw new ValidationError("Invalid unit ID");
      }

      // Check if unit exists
      const existingUnit = await this.getUnitById(unitId);

      // Validate update data
      const allowedFields = [
        "unitNameAr",
        "unitNameEn",
        "unitSymbol",
        "description",
        "isActive",
      ];
      const filteredData = Object.keys(updateData)
        .filter((key) => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});

      if (Object.keys(filteredData).length === 0) {
        throw new ValidationError("No valid fields provided for update");
      }

      await this.validateUnitData(filteredData, unitId);

      // Check for conflicts
      if (
        filteredData.unitSymbol ||
        filteredData.unitNameEn ||
        filteredData.unitNameAr
      ) {
        const conflicts = [];
        const whereConditions = [];

        if (filteredData.unitSymbol)
          whereConditions.push({ unitSymbol: filteredData.unitSymbol });
        if (filteredData.unitNameEn)
          whereConditions.push({ unitNameEn: filteredData.unitNameEn });
        if (filteredData.unitNameAr)
          whereConditions.push({ unitNameAr: filteredData.unitNameAr });

        const conflictingUnit = await this.getDb().unit.findFirst({
          where: {
            AND: [
              { id: { not: unitId } },
              { deletedAt: null },
              { OR: whereConditions },
            ],
          },
        });

        if (conflictingUnit) {
          throw new ConflictError("Unit data conflicts with existing record");
        }
      }

      // Update unit
      const unit = await this.getDb().$transaction(async (tx) => {
        const updated = await tx.unit.update({
          where: { id: unitId },
          data: {
            ...filteredData,
            version: { increment: 1 },
          },
          select: {
            id: true,
            unitNameAr: true,
            unitNameEn: true,
            unitSymbol: true,
            description: true,
            isActive: true,
            version: true,
          },
        });

        // Create audit log
        if (updatedBy) {
          await this.createAuditLog(tx, {
            userId: updatedBy,
            action: "UNIT_UPDATED",
            tableName: "units",
            recordId: unitId,
            oldValues: JSON.stringify(existingUnit),
            newValues: JSON.stringify(filteredData),
          });
        }

        return updated;
      });

      // Clear cache
      await this.clearCache();

      logger.info("Unit updated successfully", {
        unitId,
        updatedFields: Object.keys(filteredData),
        updatedBy,
      });

      return unit;
    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundError("Unit not found");
      }
      if (error.code === "P2002") {
        throw new ConflictError("Unit data conflicts with existing record");
      }

      logger.error("Update unit failed", {
        unitId,
        updateData,
        error: error.message,
        updatedBy,
      });
      throw error;
    }
  }

  /**
   * Delete unit with safety checks
   */
  async deleteUnit(unitId, deletedBy = null) {
    try {
      if (!Number.isInteger(unitId) || unitId <= 0) {
        throw new ValidationError("Invalid unit ID");
      }

      // Check if unit exists
      const unit = await this.getUnitById(unitId);

      // Check for dependencies
      const itemCount = await this.getDb().item.count({
        where: {
          unitId: unitId,
          deletedAt: null,
        },
      });

      if (itemCount > 0) {
        throw new ValidationError(
          `Cannot delete unit. It has ${itemCount} associated items. Please move or delete associated items first.`
        );
      }

      // Soft delete
      await this.getDb().$transaction(async (tx) => {
        await tx.unit.update({
          where: { id: unitId },
          data: {
            deletedAt: new Date(),
            isActive: false,
            version: { increment: 1 },
          },
        });

        // Create audit log
        if (deletedBy) {
          await this.createAuditLog(tx, {
            userId: deletedBy,
            action: "UNIT_DELETED",
            tableName: "units",
            recordId: unitId,
            oldValues: JSON.stringify(unit),
          });
        }
      });

      // Clear cache
      await this.clearCache();

      logger.warn("Unit deleted", {
        unitId,
        unitSymbol: unit.unitSymbol,
        deletedBy,
      });
    } catch (error) {
      logger.error("Delete unit failed", {
        unitId,
        error: error.message,
        deletedBy,
      });
      throw error;
    }
  }

  /**
   * Get active units with caching
   */
  async getActiveUnits() {
    try {
      const cacheKey = "active_units";
      let units = await this.cache.get(cacheKey);

      if (!units) {
        units = await this.getDb().unit.findMany({
          where: {
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
            unitNameAr: true,
            unitNameEn: true,
            unitSymbol: true,
          },
          orderBy: { unitNameEn: "asc" },
        });

        await this.cache.set(cacheKey, units, 1800); // 30 minutes
      }

      return units;
    } catch (error) {
      logger.error("Get active units failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get unit statistics
   */
  async getUnitStats() {
    try {
      const cacheKey = "unit_stats";
      let stats = await this.cache.get(cacheKey);

      if (!stats) {
        const [total, active, withItems, unused] = await Promise.all([
          this.getDb().unit.count({ where: { deletedAt: null } }),
          this.getDb().unit.count({
            where: { isActive: true, deletedAt: null },
          }),
          this.getDb().unit.count({
            where: {
              deletedAt: null,
              items: { some: { deletedAt: null } },
            },
          }),
          this.getDb().unit.count({
            where: {
              deletedAt: null,
              items: { none: {} },
            },
          }),
        ]);

        stats = {
          total,
          active,
          inactive: total - active,
          withItems,
          unused,
          usagePercentage:
            total > 0 ? Math.round((withItems / total) * 100) : 0,
          lastUpdated: new Date().toISOString(),
        };

        await this.cache.set(cacheKey, stats, 600); // 10 minutes
      }

      return stats;
    } catch (error) {
      logger.error("Get unit stats failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Validate unit data
   */
  async validateUnitData(data, excludeId = null) {
    const { unitSymbol, unitNameAr, unitNameEn } = data;

    // Check reserved symbols
    if (unitSymbol) {
      const reserved = [
        "null",
        "undefined",
        "nan",
        "true",
        "false",
        "infinity",
      ];
      if (reserved.includes(unitSymbol.toLowerCase())) {
        throw new ValidationError(
          `Unit symbol '${unitSymbol}' is reserved and cannot be used`
        );
      }

      // Check symbol length and format
      if (!/^[a-zA-Z0-9]+$/.test(unitSymbol)) {
        throw new ValidationError(
          "Unit symbol can only contain letters and numbers"
        );
      }
    }

    // Validate name patterns
    if (unitNameAr && !/^[\u0600-\u06FF\s]+$/.test(unitNameAr)) {
      throw new ValidationError(
        "Arabic unit name can only contain Arabic letters and spaces"
      );
    }

    if (unitNameEn && !/^[a-zA-Z\s]+$/.test(unitNameEn)) {
      throw new ValidationError(
        "English unit name can only contain English letters and spaces"
      );
    }
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(tx, logData) {
    try {
      await tx.systemLog.create({
        data: {
          userId: logData.userId,
          action: logData.action,
          tableName: logData.tableName,
          recordId: logData.recordId,
          oldValues: logData.oldValues || null,
          newValues: logData.newValues || null,
          ipAddress: null, // Will be filled by middleware
          userAgent: null,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Failed to create audit log", {
        logData,
        error: error.message,
      });
      // Don't throw - audit failure shouldn't break the main operation
    }
  }

  /**
   * Clear all related cache
   */
  async clearCache() {
    try {
      const cacheKeys = ["active_units", "unit_stats"];
      await Promise.all(cacheKeys.map((key) => this.cache.del(key)));
    } catch (error) {
      logger.warn("Failed to clear cache", { error: error.message });
      // Don't throw - cache failure shouldn't break the operation
    }
  }
}

// Export singleton instance
const unitsService = new UnitsService();
export default unitsService;
