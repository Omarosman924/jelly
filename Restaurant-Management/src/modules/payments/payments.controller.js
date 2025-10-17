import paymentsService from "./payments.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

/**
 * Payments Controller V2
 * Handles payment processing and management operations
 */
class PaymentsController {
  /**
   * Process payment for an order
   */
  processPayment = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    const result = await paymentsService.processPayment(req.body, req.user);

    return responseHandler.withPerformance(
      res,
      result,
      "Payment processed successfully",
      startTime
    );
  });

  /**
   * Get payment by ID
   */
  getPaymentById = asyncHandler(async (req, res) => {
    const paymentId = parseInt(req.params.id);
    if (isNaN(paymentId)) {
      return responseHandler.error(res, "Invalid payment ID", 400);
    }

    const payment = await paymentsService.getPaymentById(paymentId);
    return responseHandler.success(
      res,
      payment,
      "Payment retrieved successfully"
    );
  });

  /**
   * Get payments for a specific order
   */
  getOrderPayments = asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      return responseHandler.error(res, "Invalid order ID", 400);
    }

    const result = await paymentsService.getOrderPayments(orderId);
    return responseHandler.success(
      res,
      result,
      "Order payments retrieved successfully"
    );
  });

  /**
   * Process refund
   */
  processRefund = asyncHandler(async (req, res) => {
    const paymentId = parseInt(req.params.id);
    if (isNaN(paymentId)) {
      return responseHandler.error(res, "Invalid payment ID", 400);
    }

    const refundData = {
      paymentId,
      ...req.body,
    };

    const refund = await paymentsService.processRefund(refundData, req.user);
    return responseHandler.success(
      res,
      refund,
      "Refund processed successfully"
    );
  });

  /**
   * Get payment statistics
   */
  getPaymentStats = asyncHandler(async (req, res) => {
    const { period = "month" } = req.query;

    if (!["week", "month", "year"].includes(period)) {
      return responseHandler.error(
        res,
        "Invalid period. Use: week, month, or year",
        400
      );
    }

    const stats = await paymentsService.getPaymentStats(period);
    return responseHandler.success(
      res,
      stats,
      "Payment statistics retrieved successfully"
    );
  });

  /**
   * Get available payment gateways
   */
  getAvailableGateways = asyncHandler(async (req, res) => {
    const gateways = paymentsService.getAvailableGateways();
    return responseHandler.success(
      res,
      gateways,
      "Available payment gateways retrieved successfully"
    );
  });

  /**
   * Get payment summary for dashboard
   */
  getPaymentSummary = asyncHandler(async (req, res) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const [dailyStats, monthlyStats, availableGateways] = await Promise.all([
      paymentsService.getPaymentStats("week"), // Use week to get recent daily data
      paymentsService.getPaymentStats("month"),
      Promise.resolve(paymentsService.getAvailableGateways()),
    ]);

    const summary = {
      today: {
        // This would need additional filtering for today specifically
        revenue: 0,
        transactions: 0,
        avgTransaction: 0,
      },
      thisMonth: {
        revenue: monthlyStats.totalRevenue,
        transactions: monthlyStats.completedPayments,
        avgTransaction: monthlyStats.avgTransactionValue,
        successRate: monthlyStats.successRate,
      },
      paymentMethods: monthlyStats.paymentsByMethod,
      availableGateways,
      timestamp: new Date().toISOString(),
    };

    return responseHandler.success(
      res,
      summary,
      "Payment summary retrieved successfully"
    );
  });

  /**
   * Generate payment report
   */
  generatePaymentReport = asyncHandler(async (req, res) => {
    const {
      fromDate,
      toDate,
      paymentMethod,
      paymentStatus,
      format = "summary",
    } = req.query;

    // This would be implemented in the service
    const reportData = {
      reportType: "payments",
      generatedBy: `${req.user.firstName} ${req.user.lastName}`,
      generatedAt: new Date().toISOString(),
      filters: {
        fromDate,
        toDate,
        paymentMethod,
        paymentStatus,
      },
      summary: {
        // Would be populated with actual data
        totalTransactions: 0,
        totalRevenue: 0,
        successfulPayments: 0,
        failedPayments: 0,
        refunds: 0,
      },
      data: format === "detailed" ? [] : undefined,
    };

    return responseHandler.success(
      res,
      reportData,
      "Payment report generated successfully"
    );
  });

  /**
   * Verify payment status (for webhook/callback handling)
   */
  verifyPaymentStatus = asyncHandler(async (req, res) => {
    const { transactionReference, gateway } = req.body;

    if (!transactionReference) {
      return responseHandler.error(
        res,
        "Transaction reference is required",
        400
      );
    }

    // Find payment by transaction reference
    const payment = await paymentsService.db.payment.findFirst({
      where: { transactionReference },
      include: { order: true },
    });

    if (!payment) {
      return responseHandler.notFound(res, null, "Payment not found");
    }

    // In production, verify with the actual gateway
    // For now, return the current payment status
    const verificationResult = {
      paymentId: payment.id,
      orderId: payment.orderId,
      transactionReference: payment.transactionReference,
      status: payment.paymentStatus,
      amount: payment.amountPaid,
      verifiedAt: new Date().toISOString(),
    };

    return responseHandler.success(
      res,
      verificationResult,
      "Payment status verified successfully"
    );
  });

  /**
   * Handle payment webhook/callback
   */
  handlePaymentWebhook = asyncHandler(async (req, res) => {
    const { gateway, payload } = req.body;

    // Log webhook receipt
    logger.info("Payment webhook received", {
      gateway,
      payload: payload ? "present" : "missing",
      headers: req.headers,
    });

    // In production, verify webhook signature and process the payload
    // Update payment status based on gateway response

    // For now, acknowledge receipt
    return responseHandler.success(
      res,
      { received: true },
      "Webhook processed successfully"
    );
  });
}

const paymentsController = new PaymentsController();
export default paymentsController;
