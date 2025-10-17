import { getDatabaseClient } from "../../utils/database.js";
import logger from "../../utils/logger.js";
import redisClient from "../../utils/redis.js";
import { AppError, NotFoundError } from "../../middleware/errorHandler.js";

/**
 * Payments Service V2
 * Advanced payment processing with multiple gateway support
 */
class PaymentsService {
  constructor() {
    this.db = getDatabaseClient();
    this.cache = redisClient.cache(1800); // 30 minutes cache

    // Payment gateways configuration
    this.gateways = {
      MADA: {
        enabled: process.env.MADA_ENABLED === "true",
        merchantId: process.env.MADA_MERCHANT_ID,
        secretKey: process.env.MADA_SECRET_KEY,
        endpoint: process.env.MADA_ENDPOINT,
      },
      STC_PAY: {
        enabled: process.env.STC_PAY_ENABLED === "true",
        merchantId: process.env.STC_PAY_MERCHANT_ID,
        secretKey: process.env.STC_PAY_SECRET_KEY,
        endpoint: process.env.STC_PAY_ENDPOINT,
      },
      STRIPE: {
        enabled: process.env.STRIPE_ENABLED === "true",
        secretKey: process.env.STRIPE_SECRET_KEY,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      },
    };
  }

  /**
   * Process payment for an order
   */
  async processPayment(paymentData, processedBy) {
    try {
      const {
        orderId,
        paymentMethod,
        amountPaid,
        transactionReference,
        gatewayData,
      } = paymentData;

      // Validate order exists and is not already paid
      const order = await this.db.order.findUnique({
        where: { id: orderId },
        include: {
          payments: {
            where: { paymentStatus: "COMPLETED" },
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Order");
      }

      if (order.isPaid) {
        throw new AppError("Order is already paid", 400);
      }

      // Validate payment amount
      const totalPaid = order.payments.reduce(
        (sum, payment) => sum + Number(payment.amountPaid),
        0
      );
      const remainingAmount = Number(order.totalAmount) - totalPaid;

      if (Number(amountPaid) > remainingAmount) {
        throw new AppError("Payment amount exceeds remaining balance", 400);
      }

      // Process payment based on method
      let paymentResult;
      switch (paymentMethod) {
        case "CASH":
          paymentResult = await this.processCashPayment(paymentData);
          break;
        case "CARD":
          paymentResult = await this.processCardPayment(
            paymentData,
            gatewayData
          );
          break;
        case "DIGITAL_WALLET":
          paymentResult = await this.processDigitalWalletPayment(
            paymentData,
            gatewayData
          );
          break;
        default:
          throw new AppError("Invalid payment method", 400);
      }

      // Create payment record in transaction
      const payment = await this.db.$transaction(async (prisma) => {
        // Create payment record
        const newPayment = await prisma.payment.create({
          data: {
            orderId,
            paymentMethod,
            amountPaid: Number(amountPaid),
            paymentStatus: paymentResult.status,
            transactionReference:
              paymentResult.transactionReference || transactionReference,
            paymentDateTime: new Date(),
          },
        });

        // Check if order is fully paid
        const totalPayments = totalPaid + Number(amountPaid);
        const isFullyPaid = totalPayments >= Number(order.totalAmount);

        if (isFullyPaid && paymentResult.status === "COMPLETED") {
          // Update order status
          await prisma.order.update({
            where: { id: orderId },
            data: {
              isPaid: true,
              // Auto-confirm paid orders if they're still pending
              orderStatus:
                order.orderStatus === "PENDING"
                  ? "CONFIRMED"
                  : order.orderStatus,
            },
          });

          // Update customer loyalty points for end users
          if (order.customerId && order.customerType === "INDIVIDUAL") {
            const loyaltyPoints = Math.floor(Number(order.totalAmount) / 10); // 1 point per 10 SAR
            await prisma.customer.update({
              where: { id: order.customerId },
              data: {
                loyaltyPoints: { increment: loyaltyPoints },
                lastOrderDate: new Date(),
              },
            });
          }
        }

        return newPayment;
      });

      // Publish payment event
      await redisClient.publish("payment_events", {
        type: "PAYMENT_PROCESSED",
        paymentId: payment.id,
        orderId,
        amount: amountPaid,
        method: paymentMethod,
        status: paymentResult.status,
        processedBy: processedBy?.id,
        timestamp: new Date().toISOString(),
      });

      logger.info("Payment processed successfully", {
        paymentId: payment.id,
        orderId,
        amount: amountPaid,
        method: paymentMethod,
        status: paymentResult.status,
        processedBy: processedBy?.id,
      });

      return {
        payment,
        orderFullyPaid:
          order.isPaid ||
          totalPaid + Number(amountPaid) >= Number(order.totalAmount),
        gatewayResponse: paymentResult.gatewayResponse,
      };
    } catch (error) {
      logger.error("Payment processing failed", {
        orderId: paymentData.orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process cash payment
   */
  async processCashPayment(paymentData) {
    // Cash payments are always immediately completed
    return {
      status: "COMPLETED",
      transactionReference: `CASH-${Date.now()}`,
      gatewayResponse: null,
    };
  }

  /**
   * Process card payment through configured gateways
   */
  async processCardPayment(paymentData, gatewayData) {
    const { gateway = "MADA" } = gatewayData || {};

    if (!this.gateways[gateway]?.enabled) {
      throw new AppError(`${gateway} gateway is not enabled`, 400);
    }

    try {
      let result;
      switch (gateway) {
        case "MADA":
          result = await this.processMadaPayment(paymentData, gatewayData);
          break;
        case "STRIPE":
          result = await this.processStripePayment(paymentData, gatewayData);
          break;
        default:
          throw new AppError(`Unsupported card gateway: ${gateway}`, 400);
      }

      return result;
    } catch (error) {
      logger.error(`Card payment failed via ${gateway}`, {
        error: error.message,
        orderId: paymentData.orderId,
      });

      return {
        status: "FAILED",
        transactionReference: null,
        gatewayResponse: { error: error.message },
      };
    }
  }

  /**
   * Process digital wallet payment
   */
  async processDigitalWalletPayment(paymentData, gatewayData) {
    const { gateway = "STC_PAY" } = gatewayData || {};

    if (!this.gateways[gateway]?.enabled) {
      throw new AppError(`${gateway} gateway is not enabled`, 400);
    }

    try {
      let result;
      switch (gateway) {
        case "STC_PAY":
          result = await this.processSTCPayPayment(paymentData, gatewayData);
          break;
        default:
          throw new AppError(`Unsupported wallet gateway: ${gateway}`, 400);
      }

      return result;
    } catch (error) {
      logger.error(`Digital wallet payment failed via ${gateway}`, {
        error: error.message,
        orderId: paymentData.orderId,
      });

      return {
        status: "FAILED",
        transactionReference: null,
        gatewayResponse: { error: error.message },
      };
    }
  }

  /**
   * Process MADA payment (Saudi domestic cards)
   */
  async processMadaPayment(paymentData, gatewayData) {
    // Mock MADA payment processing
    // In production, integrate with actual MADA API
    const { cardNumber, expiryDate, cvv } = gatewayData;

    // Simulate payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock success/failure based on card number
    const isSuccess = !cardNumber || !cardNumber.endsWith("0000");

    if (isSuccess) {
      return {
        status: "COMPLETED",
        transactionReference: `MADA-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        gatewayResponse: {
          gateway: "MADA",
          authCode: Math.random().toString(36).substr(2, 6).toUpperCase(),
          rrn: Math.random().toString().substr(2, 12),
          cardMask: cardNumber
            ? `****-****-****-${cardNumber.slice(-4)}`
            : "****-****-****-1234",
        },
      };
    } else {
      return {
        status: "FAILED",
        transactionReference: null,
        gatewayResponse: {
          gateway: "MADA",
          error: "Payment declined by issuing bank",
          errorCode: "51",
        },
      };
    }
  }

  /**
   * Process Stripe payment
   */
  async processStripePayment(paymentData, gatewayData) {
    // Mock Stripe payment processing
    // In production, integrate with Stripe API
    const { paymentMethodId } = gatewayData;

    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      status: "COMPLETED",
      transactionReference: `pi_${Math.random().toString(36).substr(2, 24)}`,
      gatewayResponse: {
        gateway: "STRIPE",
        paymentIntent: `pi_${Math.random().toString(36).substr(2, 24)}`,
        clientSecret: `pi_${Math.random()
          .toString(36)
          .substr(2, 24)}_secret_${Math.random().toString(36).substr(2, 10)}`,
      },
    };
  }

  /**
   * Process STC Pay payment
   */
  async processSTCPayPayment(paymentData, gatewayData) {
    // Mock STC Pay processing
    const { phoneNumber } = gatewayData;

    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      status: "COMPLETED",
      transactionReference: `STC-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 8)}`,
      gatewayResponse: {
        gateway: "STC_PAY",
        transactionId: Math.random().toString().substr(2, 10),
        phoneNumberMask: phoneNumber
          ? `****${phoneNumber.slice(-4)}`
          : "****1234",
      },
    };
  }

  /**
   * Process refund
   */
  async processRefund(refundData, refundedBy) {
    try {
      const { paymentId, refundAmount, reason } = refundData;

      const payment = await this.db.payment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      });

      if (!payment) {
        throw new NotFoundError("Payment");
      }

      if (payment.paymentStatus !== "COMPLETED") {
        throw new AppError("Only completed payments can be refunded", 400);
      }

      if (Number(refundAmount) > Number(payment.amountPaid)) {
        throw new AppError("Refund amount cannot exceed payment amount", 400);
      }

      // Process gateway refund if not cash
      let refundResult = { status: "COMPLETED", transactionReference: null };

      if (payment.paymentMethod !== "CASH") {
        refundResult = await this.processGatewayRefund(payment, refundAmount);
      }

      // Create refund payment record
      const refundPayment = await this.db.$transaction(async (prisma) => {
        const newRefund = await prisma.payment.create({
          data: {
            orderId: payment.orderId,
            paymentMethod: payment.paymentMethod,
            amountPaid: -Number(refundAmount), // Negative amount for refund
            paymentStatus: refundResult.status,
            transactionReference:
              refundResult.transactionReference || `REFUND-${Date.now()}`,
            paymentDateTime: new Date(),
          },
        });

        // Update order payment status if fully refunded
        const totalPayments = await prisma.payment.aggregate({
          _sum: { amountPaid: true },
          where: { orderId: payment.orderId },
        });

        if (Number(totalPayments._sum.amountPaid) <= 0) {
          await prisma.order.update({
            where: { id: payment.orderId },
            data: { isPaid: false },
          });
        }

        return newRefund;
      });

      logger.info("Refund processed successfully", {
        originalPaymentId: paymentId,
        refundPaymentId: refundPayment.id,
        refundAmount,
        reason,
        refundedBy: refundedBy?.id,
      });

      return refundPayment;
    } catch (error) {
      logger.error("Refund processing failed", {
        paymentId: refundData.paymentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process gateway refund
   */
  async processGatewayRefund(payment, refundAmount) {
    // Mock gateway refund processing
    // In production, call actual gateway APIs

    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      status: "COMPLETED",
      transactionReference: `REFUND-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 6)}`,
    };
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId) {
    try {
      const payment = await this.db.payment.findUnique({
        where: { id: paymentId },
        include: {
          order: {
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
              table: {
                select: {
                  tableNumber: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundError("Payment");
      }

      return payment;
    } catch (error) {
      logger.error("Get payment by ID failed", {
        paymentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get payments by order
   */
  async getOrderPayments(orderId) {
    try {
      const payments = await this.db.payment.findMany({
        where: { orderId },
        orderBy: { paymentDateTime: "desc" },
      });

      const summary = {
        totalPaid: payments
          .filter((p) => p.paymentStatus === "COMPLETED" && p.amountPaid > 0)
          .reduce((sum, p) => sum + Number(p.amountPaid), 0),
        totalRefunded: payments
          .filter((p) => p.paymentStatus === "COMPLETED" && p.amountPaid < 0)
          .reduce((sum, p) => sum + Math.abs(Number(p.amountPaid)), 0),
        paymentMethods: [...new Set(payments.map((p) => p.paymentMethod))],
        lastPayment: payments[0],
      };

      return { payments, summary };
    } catch (error) {
      logger.error("Get order payments failed", {
        orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(period = "month") {
    try {
      const cacheKey = `payment_stats:${period}`;
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
          totalPayments,
          completedPayments,
          failedPayments,
          totalRevenue,
          paymentsByMethod,
          avgTransactionValue,
        ] = await Promise.all([
          this.db.payment.count({
            where: {
              paymentDateTime: { gte: startDate, lte: endDate },
            },
          }),
          this.db.payment.count({
            where: {
              paymentStatus: "COMPLETED",
              paymentDateTime: { gte: startDate, lte: endDate },
              amountPaid: { gt: 0 },
            },
          }),
          this.db.payment.count({
            where: {
              paymentStatus: "FAILED",
              paymentDateTime: { gte: startDate, lte: endDate },
            },
          }),
          this.db.payment.aggregate({
            _sum: { amountPaid: true },
            where: {
              paymentStatus: "COMPLETED",
              paymentDateTime: { gte: startDate, lte: endDate },
              amountPaid: { gt: 0 },
            },
          }),
          this.db.payment.groupBy({
            by: ["paymentMethod"],
            _count: { paymentMethod: true },
            _sum: { amountPaid: true },
            where: {
              paymentStatus: "COMPLETED",
              paymentDateTime: { gte: startDate, lte: endDate },
              amountPaid: { gt: 0 },
            },
          }),
          this.db.payment.aggregate({
            _avg: { amountPaid: true },
            where: {
              paymentStatus: "COMPLETED",
              paymentDateTime: { gte: startDate, lte: endDate },
              amountPaid: { gt: 0 },
            },
          }),
        ]);

        stats = {
          period,
          totalPayments,
          completedPayments,
          failedPayments,
          successRate: totalPayments
            ? (completedPayments / totalPayments) * 100
            : 0,
          totalRevenue: totalRevenue._sum.amountPaid || 0,
          avgTransactionValue: avgTransactionValue._avg.amountPaid || 0,
          paymentsByMethod: paymentsByMethod.reduce((acc, item) => {
            acc[item.paymentMethod] = {
              count: item._count.paymentMethod,
              total: item._sum.amountPaid || 0,
            };
            return acc;
          }, {}),
          timestamp: new Date().toISOString(),
        };

        // Cache for 15 minutes
        await this.cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error("Get payment stats failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get available payment gateways
   */
  getAvailableGateways() {
    return Object.entries(this.gateways)
      .filter(([name, config]) => config.enabled)
      .map(([name, config]) => ({
        name,
        displayName: name.replace("_", " "),
        type: name === "MADA" || name === "STRIPE" ? "CARD" : "DIGITAL_WALLET",
      }));
  }
}

export default PaymentsService;
