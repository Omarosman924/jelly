// src/utils/auditLogger.js
import { getDatabaseClient } from "./database.js";
import logger from "./logger.js";
import redisClient from "./redis.js";

/**
 * Audit Logger
 * Comprehensive audit trail and activity tracking system
 */
export class AuditLogger {
  constructor() {
    this.db = null;

    // Define critical actions that require immediate notification
    this.criticalActions = [
      "ROLE_CHANGE",
      "SALARY_CHANGE",
      "USER_DELETE",
      "PERMISSION_CHANGE",
      "PASSWORD_CHANGE",
      "SYSTEM_SETTING_CHANGE",
      "BULK_DELETE",
      "EXPORT_DATA",
      "LOGIN_FAILURE_THRESHOLD",
      "SUSPICIOUS_ACTIVITY",
    ];

    // Define actions that require detailed logging
    this.detailedLoggingActions = [
      "ORDER_CANCEL",
      "PAYMENT_REFUND",
      "INVENTORY_ADJUSTMENT",
      "PRICE_CHANGE",
      "USER_STATUS_CHANGE",
    ];
  }

  getDb() {
    if (!this.db) {
      this.db = getDatabaseClient();
    }
    return this.db;
  }

  /**
   * Log user action
   */
  async logUserAction(action, userId, details = {}) {
    try {
      const db = this.getDb();

      // Prepare audit log entry
      const auditEntry = {
        userId,
        action,
        tableName: details.tableName || null,
        recordId: details.recordId || null,
        oldValues: details.oldValues ? JSON.stringify(details.oldValues) : null,
        newValues: details.newValues ? JSON.stringify(details.newValues) : null,
        ipAddress: details.ipAddress || null,
        userAgent: details.userAgent || null,
        createdAt: new Date(),
      };

      // Create audit log
      await db.systemLog.create({
        data: auditEntry,
      });

      // Log to winston
      logger.info("User action logged", {
        action,
        userId,
        tableName: details.tableName,
        recordId: details.recordId,
      });

      // Check if critical action
      if (this.isCriticalAction(action)) {
        await this.handleCriticalAction(action, userId, details);
      }

      // Store in Redis for quick access (last 100 actions per user)
      await this.cacheUserActivity(userId, {
        action,
        timestamp: new Date(),
        details: {
          tableName: details.tableName,
          recordId: details.recordId,
        },
      });

      return auditEntry;
    } catch (error) {
      logger.error("Failed to log user action", {
        action,
        userId,
        error: error.message,
      });
      // Don't throw - audit logging shouldn't break application flow
    }
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(event, userId, details = {}) {
    try {
      const authActions = {
        LOGIN_SUCCESS: "LOGIN_SUCCESS",
        LOGIN_FAILURE: "LOGIN_FAILURE",
        LOGOUT: "LOGOUT",
        TOKEN_REFRESH: "TOKEN_REFRESH",
        PASSWORD_CHANGE: "PASSWORD_CHANGE",
        PASSWORD_RESET: "PASSWORD_RESET",
        MFA_ENABLED: "MFA_ENABLED",
        MFA_DISABLED: "MFA_DISABLED",
      };

      await this.logUserAction(authActions[event] || event, userId, {
        ...details,
        tableName: "auth_events",
      });

      // Track failed login attempts
      if (event === "LOGIN_FAILURE") {
        await this.trackFailedLogin(
          details.email || details.username,
          details.ipAddress
        );
      }

      // Clear failed attempts on success
      if (event === "LOGIN_SUCCESS") {
        await this.clearFailedLoginAttempts(details.email, details.ipAddress);
      }
    } catch (error) {
      logger.error("Failed to log auth event", {
        event,
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Log data access
   */
  async logDataAccess(userId, resource, recordId, action = "READ") {
    try {
      await this.logUserAction(`DATA_ACCESS_${action}`, userId, {
        tableName: resource,
        recordId,
        action: `Accessed ${resource}`,
      });

      // Track sensitive data access
      if (this.isSensitiveResource(resource)) {
        await this.trackSensitiveAccess(userId, resource, recordId);
      }
    } catch (error) {
      logger.error("Failed to log data access", { error: error.message });
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventType, userId, details = {}) {
    try {
      await this.logUserAction(`SECURITY_${eventType}`, userId, {
        ...details,
        severity: details.severity || "MEDIUM",
      });

      // Alert on high severity events
      if (details.severity === "HIGH" || details.severity === "CRITICAL") {
        await this.sendSecurityAlert(eventType, userId, details);
      }
    } catch (error) {
      logger.error("Failed to log security event", { error: error.message });
    }
  }

  /**
   * Track failed login attempts
   */
  async trackFailedLogin(identifier, ipAddress) {
    try {
      const key = `failed_login:${identifier}:${ipAddress}`;
      const count = await redisClient.incr(key);
      await redisClient.expire(key, 3600); // 1 hour

      // Alert on threshold
      const threshold = parseInt(process.env.LOGIN_FAILURE_THRESHOLD) || 5;
      if (count >= threshold) {
        await this.logSecurityEvent("LOGIN_FAILURE_THRESHOLD", null, {
          identifier,
          ipAddress,
          attemptCount: count,
          severity: "HIGH",
        });
      }
    } catch (error) {
      logger.error("Failed to track login attempts", { error: error.message });
    }
  }

  /**
   * Clear failed login attempts
   */
  async clearFailedLoginAttempts(identifier, ipAddress) {
    try {
      const key = `failed_login:${identifier}:${ipAddress}`;
      await redisClient.del(key);
    } catch (error) {
      logger.error("Failed to clear login attempts", { error: error.message });
    }
  }

  /**
   * Handle critical actions
   */
  async handleCriticalAction(action, userId, details) {
    try {
      // Log to separate critical actions table
      const db = this.getDb();
      await db.criticalActionLog
        .create({
          data: {
            userId,
            action,
            details: JSON.stringify(details),
            timestamp: new Date(),
            requiresReview: true,
          },
        })
        .catch(() => {
          // Table might not exist yet, just log
          logger.warn("Critical action log table not available");
        });

      // Notify admins
      await this.notifyAdmins(action, userId, details);

      // Create notification for the user
      await this.createAuditNotification(userId, action, details);
    } catch (error) {
      logger.error("Failed to handle critical action", {
        error: error.message,
      });
    }
  }

  /**
   * Notify administrators
   */
  async notifyAdmins(action, userId, details) {
    try {
      const db = this.getDb();

      // Get all admin users
      const admins = await db.user.findMany({
        where: {
          role: "ADMIN",
          isActive: true,
        },
        select: { id: true, email: true, firstName: true },
      });

      // Create notifications
      for (const admin of admins) {
        await db.notification.create({
          data: {
            userId: admin.id,
            title: `Critical Action: ${action}`,
            message: `User ${userId} performed: ${action}. Details: ${JSON.stringify(
              details
            ).substring(0, 200)}`,
            type: "SYSTEM_ALERT",
            isRead: false,
            metadata: {
              action,
              performedBy: userId,
              timestamp: new Date(),
            },
          },
        });
      }

      logger.info("Admins notified of critical action", { action, userId });
    } catch (error) {
      logger.error("Failed to notify admins", { error: error.message });
    }
  }

  /**
   * Create audit notification
   */
  async createAuditNotification(userId, action, details) {
    try {
      const db = this.getDb();

      await db.notification.create({
        data: {
          userId,
          title: "Action Recorded",
          message: `Your action "${action}" has been logged for security purposes.`,
          type: "SYSTEM_ALERT",
          isRead: false,
          metadata: {
            action,
            timestamp: new Date(),
          },
        },
      });
    } catch (error) {
      logger.error("Failed to create audit notification", {
        error: error.message,
      });
    }
  }

  /**
   * Cache user activity
   */
  async cacheUserActivity(userId, activity) {
    try {
      const key = `user_activity:${userId}`;
      const activities = (await redisClient.get(key)) || [];

      // Keep last 100 activities
      activities.unshift(activity);
      if (activities.length > 100) {
        activities.pop();
      }

      await redisClient.set(key, JSON.stringify(activities), 86400); // 24 hours
    } catch (error) {
      logger.error("Failed to cache user activity", { error: error.message });
    }
  }

  /**
   * Get user activity history
   */
  async getUserActivity(userId, limit = 50) {
    try {
      const db = this.getDb();

      const activities = await db.systemLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          action: true,
          tableName: true,
          recordId: true,
          ipAddress: true,
          createdAt: true,
        },
      });

      return activities;
    } catch (error) {
      logger.error("Failed to get user activity", { error: error.message });
      return [];
    }
  }

  /**
   * Track sensitive data access
   */
  async trackSensitiveAccess(userId, resource, recordId) {
    try {
      const key = `sensitive_access:${userId}:${resource}`;
      await redisClient.lpush(
        key,
        JSON.stringify({
          recordId,
          timestamp: new Date(),
        })
      );
      await redisClient.ltrim(key, 0, 99); // Keep last 100
      await redisClient.expire(key, 2592000); // 30 days
    } catch (error) {
      logger.error("Failed to track sensitive access", {
        error: error.message,
      });
    }
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(eventType, userId, details) {
    try {
      logger.warn("Security alert", {
        eventType,
        userId,
        details,
        timestamp: new Date(),
      });

      // Could integrate with external alerting systems (Slack, email, etc.)
      // For now, just log and create notification
      await this.notifyAdmins(`SECURITY_ALERT_${eventType}`, userId, details);
    } catch (error) {
      logger.error("Failed to send security alert", { error: error.message });
    }
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(filters = {}) {
    try {
      const db = this.getDb();

      const where = {};
      if (filters.userId) where.userId = filters.userId;
      if (filters.action) where.action = { contains: filters.action };
      if (filters.tableName) where.tableName = filters.tableName;
      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
      }

      const logs = await db.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters.limit || 1000,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });

      // Generate statistics
      const stats = {
        totalActions: logs.length,
        uniqueUsers: new Set(logs.map((l) => l.userId)).size,
        actionBreakdown: {},
        timeRange: {
          from: logs[logs.length - 1]?.createdAt,
          to: logs[0]?.createdAt,
        },
      };

      logs.forEach((log) => {
        stats.actionBreakdown[log.action] =
          (stats.actionBreakdown[log.action] || 0) + 1;
      });

      return {
        logs,
        stats,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to generate audit report", { error: error.message });
      throw error;
    }
  }

  /**
   * Check if action is critical
   */
  isCriticalAction(action) {
    return this.criticalActions.includes(action);
  }

  /**
   * Check if resource is sensitive
   */
  isSensitiveResource(resource) {
    const sensitiveResources = [
      "users",
      "staff",
      "payments",
      "invoices",
      "salaries",
      "customer_payment_methods",
    ];
    return sensitiveResources.includes(resource);
  }

  /**
   * Compare values for audit trail
   */
  compareValues(oldValue, newValue) {
    const changes = {};

    for (const key in newValue) {
      if (oldValue[key] !== newValue[key]) {
        changes[key] = {
          old: oldValue[key],
          new: newValue[key],
        };
      }
    }

    return changes;
  }

  /**
   * Cleanup old audit logs
   */
  async cleanupOldLogs(daysToKeep = 90) {
    try {
      const db = this.getDb();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deleted = await db.systemLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          action: { notIn: this.criticalActions }, // Keep critical actions longer
        },
      });

      logger.info("Audit logs cleaned up", {
        deleted: deleted.count,
        cutoffDate,
      });

      return deleted.count;
    } catch (error) {
      logger.error("Failed to cleanup audit logs", { error: error.message });
      throw error;
    }
  }
}

export const auditLogger = new AuditLogger();
export default auditLogger;
