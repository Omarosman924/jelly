// orders.controller.js
import ordersService from "./orders.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

class OrdersController {
  createOrder = asyncHandler(async (req, res) => {
    const orderData = req.body;

    // Extract idempotency key from headers
    const idempotencyKey =
      req.headers["idempotency-key"] || req.headers["x-idempotency-key"];

    const order = await ordersService.createOrder(
      orderData,
      req.user,
      idempotencyKey
    );

    return responseHandler.created(res, order, "Order created successfully");
  });

  getOrderById = asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id);

    if (isNaN(orderId) || orderId <= 0) {
      return responseHandler.error(res, "Invalid order ID", 400);
    }

    const order = await ordersService.getOrderById(orderId);
    return responseHandler.success(res, order, "Order retrieved successfully");
  });

  updateOrderStatus = asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id);
    const { status, notes } = req.body;

    if (isNaN(orderId) || orderId <= 0) {
      return responseHandler.error(res, "Invalid order ID", 400);
    }

    const order = await ordersService.updateOrderStatus(
      orderId,
      status,
      req.user,
      notes
    );

    return responseHandler.success(
      res,
      order,
      "Order status updated successfully"
    );
  });
}

const ordersController = new OrdersController();
export default ordersController;
