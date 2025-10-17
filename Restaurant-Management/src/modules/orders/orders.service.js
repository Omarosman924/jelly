import { getDatabaseClient } from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";
import {
  AppError,
  NotFoundError,
  ConflictError,
} from "../../middleware/errorHandler.js";

class OrdersService {
  constructor() {
    this.cache = redisClient.cache(600);
    this.orderQueue = redisClient.cache(300);
    this.statusFlow = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY", "CANCELLED"],
      READY: ["SERVED", "DELIVERED"],
      SERVED: [],
      DELIVERED: [],
      CANCELLED: [],
    };
  }

  getDb() {
    try {
      return getDatabaseClient();
    } catch (error) {
      logger.error("Failed to get database client", {
        error: error.message,
        service: "OrdersService",
      });
      throw new AppError("Database connection failed", 503);
    }
  }

  /**
   * Create new order with idempotency support
   */
  async createOrder(orderData, createdBy, idempotencyKey = null) {
    const startTime = Date.now();

    try {
      // Check idempotency
      if (idempotencyKey) {
        const existing = await redisClient.get(
          `idempotency:order:${idempotencyKey}`
        );
        if (existing) {
          logger.info("Returning cached order from idempotency key", {
            idempotencyKey,
          });
          return JSON.parse(existing);
        }
      }

      const db = this.getDb();

      const {
        customerId,
        companyId,
        tableId,
        orderType,
        customerType = "INDIVIDUAL",
        items = [],
        specialInstructions,
        deliveryAreaId,
      } = orderData;

      // Validation
      await this.validateOrderData({
        customerId,
        companyId,
        tableId,
        orderType,
        customerType,
        items,
        deliveryAreaId,
      });

      // Generate order number with better uniqueness
      const orderNumber = await this.generateOrderNumber();

      // Pre-validate all items before transaction
      const validatedItems = await this.validateAllOrderItems(items, db);

      // Calculate totals
      const orderTotals = this.calculateOrderTotalsFromValidated(
        validatedItems,
        deliveryAreaId
          ? await db.deliveryArea.findUnique({ where: { id: deliveryAreaId } })
          : null
      );

      // Create order in transaction
      const order = await db.$transaction(
        async (prisma) => {
          // Create main order
          const newOrder = await prisma.order.create({
            data: {
              orderNumber,
              customerId,
              companyId,
              tableId,
              cashierId: createdBy.staff?.id,
              orderType,
              customerType,
              orderStatus: "PENDING",
              subtotal: orderTotals.subtotal,
              taxAmount: orderTotals.taxAmount,
              deliveryFee: orderTotals.deliveryFee,
              totalAmount: orderTotals.totalAmount,
              specialInstructions,
              estimatedReadyTime: new Date(
                Date.now() + orderTotals.estimatedTime * 60000
              ),
              isPaid: false,
            },
          });

          // Create order items with corrected field mapping
          const orderItems = await Promise.all(
            validatedItems.map(async (item) => {
              const orderItemData = {
                orderId: newOrder.id,
                itemType: item.itemType.toUpperCase(), // Convert to enum
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                specialInstructions: item.specialInstructions,
                status: "PENDING",
              };

              // Map itemReferenceId to correct field based on type
              switch (item.itemType.toLowerCase()) {
                case "item":
                  orderItemData.itemId = item.itemReferenceId;
                  break;
                case "recipe":
                  orderItemData.recipeId = item.itemReferenceId;
                  break;
                case "meal":
                  orderItemData.mealId = item.itemReferenceId;
                  break;
              }

              // Add cooking method if exists
              if (item.cookingMethodId) {
                orderItemData.cookingMethodId = item.cookingMethodId;
              }

              return prisma.orderItem.create({ data: orderItemData });
            })
          );

          // Reserve table if needed
          if (tableId) {
            await prisma.table.update({
              where: { id: tableId },
              data: { tableStatus: "OCCUPIED" },
            });
          }

          // Create initial status history (oldStatus is NULL for first entry)
          await prisma.orderStatusHistory.create({
            data: {
              orderId: newOrder.id,
              oldStatus: null, // First entry has no old status
              newStatus: "PENDING",
              changedByStaffId: createdBy.id,
              notes: "Order created",
            },
          });

          return { ...newOrder, orderItems };
        },
        {
          timeout: 10000, // 10 second timeout
          maxWait: 5000, // 5 second max wait for transaction
        }
      );

      // Cache active order
      await this.cacheOrder(order);

      // Publish event (non-blocking)
      this.publishOrderEvent({
        type: "ORDER_CREATED",
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        totalAmount: order.totalAmount,
      });

      // Store idempotency result
      if (idempotencyKey) {
        await redisClient.setex(
          `idempotency:order:${idempotencyKey}`,
          3600, // 1 hour
          JSON.stringify(order)
        );
      }

      logger.info("Order created successfully", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        itemCount: items.length,
        createdBy: createdBy.id,
        duration: Date.now() - startTime,
      });

      return order;
    } catch (error) {
      logger.error("Create order failed", {
        error: error.message,
        stack: error.stack,
        orderData: {
          ...orderData,
          items: `${orderData.items?.length || 0} items`,
        },
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Comprehensive validation before transaction
   */
  async validateOrderData(data) {
    const {
      customerId,
      companyId,
      tableId,
      orderType,
      customerType,
      items,
      deliveryAreaId,
    } = data;

    // Validate items array
    if (!items || items.length === 0) {
      throw new AppError("Order must contain at least one item", 400);
    }

    // Validate customer type logic
    if (customerType === "COMPANY" && !companyId) {
      throw new AppError("Company ID required for company orders", 400);
    }

    if (customerType === "INDIVIDUAL" && companyId) {
      throw new AppError("Cannot specify company for individual orders", 400);
    }

    // Validate customer/company existence
    const db = this.getDb();

    if (customerId) {
      const customer = await db.customer.findUnique({
        where: { id: customerId },
        include: { user: { select: { isActive: true } } },
      });

      if (!customer) {
        throw new NotFoundError("Customer");
      }

      if (!customer.user.isActive) {
        throw new AppError("Customer account is inactive", 400);
      }
    }

    if (companyId) {
      const company = await db.companyCustomer.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundError("Company");
      }

      if (!company.isActive) {
        throw new AppError("Company account is inactive", 400);
      }
    }

    // Validate table for dine-in
    if (orderType === "DINE_IN") {
      if (!tableId) {
        throw new AppError("Table is required for dine-in orders", 400);
      }

      const table = await db.table.findUnique({ where: { id: tableId } });

      if (!table) {
        throw new NotFoundError("Table");
      }

      if (table.tableStatus !== "AVAILABLE") {
        throw new AppError(`Table is ${table.tableStatus.toLowerCase()}`, 400);
      }
    }

    // Validate delivery area for delivery orders
    if (orderType === "DELIVERY") {
      if (!deliveryAreaId) {
        throw new AppError(
          "Delivery area is required for delivery orders",
          400
        );
      }

      const deliveryArea = await db.deliveryArea.findUnique({
        where: { id: deliveryAreaId },
      });

      if (!deliveryArea) {
        throw new NotFoundError("Delivery area");
      }

      if (!deliveryArea.isActive) {
        throw new AppError("Delivery area is not active", 400);
      }
    }
  }

  /**
   * Validate all items before transaction starts
   */
  async validateAllOrderItems(items, db) {
    const validatedItems = [];

    for (const item of items) {
      const validated = await this.validateAndPrepareOrderItem(item, db);
      validatedItems.push({
        ...item,
        ...validated,
      });
    }

    return validatedItems;
  }

  /**
   * Validate and prepare single order item
   */
  async validateAndPrepareOrderItem(item, prisma) {
    const { itemType, itemReferenceId, quantity, cookingMethodId } = item;

    if (!["item", "recipe", "meal"].includes(itemType.toLowerCase())) {
      throw new AppError(`Invalid item type: ${itemType}`, 400);
    }

    let basePrice = 0;
    let additionalCost = 0;
    let itemData = null;
    let estimatedTime = 0;

    // Get item data based on type
    switch (itemType.toLowerCase()) {
      case "item":
        itemData = await prisma.item.findUnique({
          where: { id: itemReferenceId },
          select: {
            id: true,
            itemNameEn: true,
            itemNameAr: true,
            sellingPrice: true,
            isAvailable: true,
            currentStock: true,
            deletedAt: true,
          },
        });

        if (!itemData || itemData.deletedAt) {
          throw new NotFoundError(`Item with ID ${itemReferenceId}`);
        }

        if (!itemData.isAvailable) {
          throw new AppError(
            `Item "${itemData.itemNameEn}" is not available`,
            400
          );
        }

        // Check stock for CONSUMABLE items
        if (
          itemData.currentStock !== null &&
          Number(itemData.currentStock) < Number(quantity)
        ) {
          throw new AppError(
            `Insufficient stock for "${itemData.itemNameEn}". Available: ${itemData.currentStock}`,
            400
          );
        }

        basePrice = itemData.sellingPrice;
        estimatedTime = 5; // Basic items take 5 minutes
        break;

      case "recipe":
        itemData = await prisma.recipe.findUnique({
          where: { id: itemReferenceId },
          select: {
            id: true,
            recipeNameEn: true,
            recipeNameAr: true,
            sellingPrice: true,
            isAvailable: true,
            preparationTime: true,
            deletedAt: true,
          },
        });

        if (!itemData || itemData.deletedAt) {
          throw new NotFoundError(`Recipe with ID ${itemReferenceId}`);
        }

        if (!itemData.isAvailable) {
          throw new AppError(
            `Recipe "${itemData.recipeNameEn}" is not available`,
            400
          );
        }

        basePrice = itemData.sellingPrice;
        estimatedTime = itemData.preparationTime || 15;
        break;

      case "meal":
        itemData = await prisma.meal.findUnique({
          where: { id: itemReferenceId },
          select: {
            id: true,
            mealNameEn: true,
            mealNameAr: true,
            sellingPrice: true,
            isAvailable: true,
            preparationTime: true,
            deletedAt: true,
          },
        });

        if (!itemData || itemData.deletedAt) {
          throw new NotFoundError(`Meal with ID ${itemReferenceId}`);
        }

        if (!itemData.isAvailable) {
          throw new AppError(
            `Meal "${itemData.mealNameEn}" is not available`,
            400
          );
        }

        basePrice = itemData.sellingPrice;
        estimatedTime = itemData.preparationTime || 20;
        break;
    }

    // Validate and add cooking method cost
    if (cookingMethodId) {
      const cookingMethod = await prisma.cookingMethod.findUnique({
        where: { id: cookingMethodId },
        select: {
          id: true,
          methodNameEn: true,
          additionalCost: true,
          isAvailable: true,
          cookingTime: true,
          deletedAt: true,
        },
      });

      if (!cookingMethod || cookingMethod.deletedAt) {
        throw new NotFoundError(`Cooking method with ID ${cookingMethodId}`);
      }

      if (!cookingMethod.isAvailable) {
        throw new AppError(
          `Cooking method "${cookingMethod.methodNameEn}" is not available`,
          400
        );
      }

      additionalCost = cookingMethod.additionalCost;
      estimatedTime += cookingMethod.cookingTime || 0;
    }

    const unitPrice = Number(basePrice) + Number(additionalCost);
    const totalPrice = unitPrice * Number(quantity);

    return {
      unitPrice,
      totalPrice,
      estimatedTime: estimatedTime * Number(quantity),
      itemData,
    };
  }

  /**
   * Calculate totals from pre-validated items
   */
  calculateOrderTotalsFromValidated(validatedItems, deliveryArea) {
    let subtotal = 0;
    let estimatedTime = 0;

    for (const item of validatedItems) {
      subtotal += item.totalPrice;
      estimatedTime += item.estimatedTime;
    }

    // VAT (15% Saudi Arabia)
    const vatRate = 0.15;
    const taxAmount = subtotal * vatRate;

    // Delivery fee
    let deliveryFee = 0;
    if (deliveryArea) {
      deliveryFee = Number(deliveryArea.deliveryFee) || 0;
      estimatedTime += deliveryArea.estimatedDeliveryTime || 30;
    }

    const totalAmount = subtotal + taxAmount + deliveryFee;

    return {
      subtotal,
      taxAmount,
      deliveryFee,
      totalAmount,
      estimatedTime: Math.max(estimatedTime, 15), // Minimum 15 minutes
    };
  }

  /**
   * Generate unique order number with better collision prevention
   */
  // orders.service.js - التعديلات على generateOrderNumber و publish

  /**
   * Generate unique order number - FIXED للعمل مع Redis Manager
   */
  async generateOrderNumber() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const timestamp = Date.now().toString().slice(-6);

    try {
      const counterKey = `order_counter:${dateStr}`;

      // استخدام operations منفصلة (Redis Manager لا يدعم multi حالياً)
      const counter = await redisClient.incr(counterKey);

      // Set expiration if this is the first increment
      if (counter === 1) {
        await redisClient.expire(counterKey, 86400);
      }

      return `ORD-${dateStr}-${timestamp}-${counter
        .toString()
        .padStart(3, "0")}`;
    } catch (error) {
      logger.error("Failed to generate order number", {
        error: error.message,
        fallbackMode: redisClient.fallbackMode,
      });

      // Fallback: استخدم timestamp + random
      const random = Math.random().toString(36).slice(2, 5).toUpperCase();
      return `ORD-${dateStr}-${timestamp}-${random}`;
    }
  }

  /**
   * Cache order - مع التعامل مع fallback mode
   */
  async cacheOrder(order) {
    try {
      await this.orderQueue.set(`order:${order.id}`, order);
    } catch (error) {
      logger.error("Failed to cache order", {
        orderId: order.id,
        error: error.message,
        fallbackMode: redisClient.fallbackMode,
      });
      // Don't throw - caching failure shouldn't fail the order
    }
  }

  /**
   * Publish order event - مع retry logic
   */
  async publishOrderEvent(eventData, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Check if in fallback mode
        if (redisClient.fallbackMode) {
          logger.warn("Cannot publish event - Redis in fallback mode", {
            event: eventData.type,
            orderId: eventData.orderId,
          });
          return 0;
        }

        const result = await redisClient.publish("order_events", {
          ...eventData,
          timestamp: new Date().toISOString(),
        });

        return result;
      } catch (error) {
        logger.error("Failed to publish order event", {
          event: eventData,
          error: error.message,
          attempt,
          maxRetries: retries,
        });

        if (attempt === retries) {
          // Final attempt failed - log but don't throw
          logger.error("All publish attempts failed", {
            event: eventData.type,
            orderId: eventData.orderId,
          });
          return 0;
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Update order status with improved validation
   */
  async updateOrderStatus(orderId, newStatus, updatedBy, notes = null) {
    const startTime = Date.now();

    try {
      const db = this.getDb();

      const order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: true,
          table: true,
        },
      });

      if (!order) {
        throw new NotFoundError("Order");
      }

      // Validate status transition
      const allowedStatuses = this.statusFlow[order.orderStatus] || [];
      if (!allowedStatuses.includes(newStatus)) {
        throw new AppError(
          `Cannot change status from ${
            order.orderStatus
          } to ${newStatus}. Allowed transitions: ${
            allowedStatuses.join(", ") || "none"
          }`,
          400
        );
      }

      const updateData = {
        orderStatus: newStatus,
        updatedAt: new Date(),
      };

      // Set timestamps based on status
      switch (newStatus) {
        case "CONFIRMED":
          updateData.confirmedAt = new Date();
          if (updatedBy.staff?.id) {
            updateData.kitchenStaffId = updatedBy.staff.id;
          }
          break;
        case "PREPARING":
          updateData.kitchenStartAt = new Date();
          break;
        case "READY":
          updateData.readyAt = new Date();
          break;
        case "SERVED":
          updateData.servedAt = new Date();
          if (updatedBy.staff?.id) {
            updateData.hallManagerId = updatedBy.staff.id;
          }
          break;
        case "DELIVERED":
          updateData.deliveredAt = new Date();
          if (updatedBy.staff?.id) {
            updateData.deliveryStaffId = updatedBy.staff.id;
          }
          break;
      }

      // Update in transaction
      await db.$transaction(async (prisma) => {
        // Update order
        await prisma.order.update({
          where: { id: orderId },
          data: updateData,
        });

        // Create status history
        await prisma.orderStatusHistory.create({
          data: {
            orderId,
            oldStatus: order.orderStatus,
            newStatus,
            changedByStaffId: updatedBy.id,
            notes: notes || `Status changed to ${newStatus}`,
          },
        });

        // Free table if order completed
        if (
          ["SERVED", "DELIVERED", "CANCELLED"].includes(newStatus) &&
          order.tableId
        ) {
          await prisma.table.update({
            where: { id: order.tableId },
            data: { tableStatus: "AVAILABLE" },
          });
        }

        // Update order items status
        if (newStatus === "PREPARING") {
          await prisma.orderItem.updateMany({
            where: {
              orderId,
              status: "PENDING",
            },
            data: { status: "PREPARING" },
          });
        } else if (newStatus === "READY") {
          await prisma.orderItem.updateMany({
            where: {
              orderId,
              status: "PREPARING",
            },
            data: { status: "READY" },
          });
        }
      });

      // Clear cache
      try {
        await this.orderQueue.del(`order:${orderId}`);
      } catch (error) {
        logger.error("Failed to clear order cache", {
          orderId,
          error: error.message,
        });
      }

      // Publish event
      await this.publishOrderEvent({
        type: "STATUS_UPDATED",
        orderId,
        orderNumber: order.orderNumber,
        oldStatus: order.orderStatus,
        newStatus,
        updatedBy: updatedBy.id,
      });

      logger.info("Order status updated", {
        orderId,
        orderNumber: order.orderNumber,
        oldStatus: order.orderStatus,
        newStatus,
        updatedBy: updatedBy.id,
        duration: Date.now() - startTime,
      });

      return await this.getOrderById(orderId);
    } catch (error) {
      logger.error("Update order status failed", {
        orderId,
        newStatus,
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Get order by ID with complete details
   */
  async getOrderById(orderId) {
    try {
      const db = this.getDb();

      const order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
          companyCustomer: {
            select: {
              companyName: true,
              contactPerson: true,
              contactPhone: true,
            },
          },
          table: {
            select: {
              tableNumber: true,
              tableType: true,
              capacity: true,
            },
          },
          cashier: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          kitchenStaff: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          deliveryStaff: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          orderItems: {
            include: {
              item: {
                select: {
                  itemNameEn: true,
                  itemNameAr: true,
                },
              },
              recipe: {
                select: {
                  recipeNameEn: true,
                  recipeNameAr: true,
                },
              },
              meal: {
                select: {
                  mealNameEn: true,
                  mealNameAr: true,
                },
              },
              cookingMethod: {
                select: {
                  methodNameEn: true,
                  methodNameAr: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          orderStatusHistory: {
            include: {
              changedByStaff: {
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
              changedAt: "desc",
            },
          },
          payments: {
            orderBy: {
              paymentDateTime: "desc",
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Order");
      }

      // Add calculated fields
      order.itemsReady = order.orderItems.filter(
        (item) => item.status === "READY"
      ).length;
      order.totalItems = order.orderItems.length;
      order.isFullyReady = order.itemsReady === order.totalItems;
      order.estimatedTimeRemaining = this.calculateRemainingTime(order);

      return order;
    } catch (error) {
      logger.error("Get order by ID failed", {
        orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate remaining preparation time
   */
  calculateRemainingTime(order) {
    if (
      ["READY", "SERVED", "DELIVERED", "CANCELLED"].includes(order.orderStatus)
    ) {
      return 0;
    }

    if (!order.estimatedReadyTime) {
      return null;
    }

    const remainingMs =
      new Date(order.estimatedReadyTime).getTime() - Date.now();
    return Math.max(0, Math.ceil(remainingMs / 60000));
  }
}

const ordersService = new OrdersService();
export default ordersService;
