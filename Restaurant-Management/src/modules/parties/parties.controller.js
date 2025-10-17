import partiesService from "./parties.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

/**
 * Parties Controller V2
 * Handles party types and party orders management
 */
class PartiesController {
  // ==================== PARTY TYPES ====================

  /**
   * Get all party types
   */
  getAllPartyTypes = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100),
      search: req.query.search,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await partiesService.getAllPartyTypes(options);
    return responseHandler.paginated(
      res,
      result.partyTypes,
      result.pagination,
      "Party types retrieved successfully"
    );
  });

  /**
   * Get party type by ID
   */
  getPartyTypeById = asyncHandler(async (req, res) => {
    const typeId = parseInt(req.params.id);
    if (isNaN(typeId)) {
      return responseHandler.error(res, "Invalid party type ID", 400);
    }

    const partyType = await partiesService.getPartyTypeById(typeId);
    return responseHandler.success(
      res,
      partyType,
      "Party type retrieved successfully"
    );
  });

  /**
   * Create new party type
   */
  createPartyType = asyncHandler(async (req, res) => {
    const partyType = await partiesService.createPartyType(req.body, req.user);
    return responseHandler.created(
      res,
      partyType,
      "Party type created successfully"
    );
  });

  /**
   * Update party type
   */
  updatePartyType = asyncHandler(async (req, res) => {
    const typeId = parseInt(req.params.id);
    if (isNaN(typeId)) {
      return responseHandler.error(res, "Invalid party type ID", 400);
    }

    const partyType = await partiesService.updatePartyType(
      typeId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      partyType,
      "Party type updated successfully"
    );
  });

  /**
   * Delete party type
   */
  deletePartyType = asyncHandler(async (req, res) => {
    const typeId = parseInt(req.params.id);
    if (isNaN(typeId)) {
      return responseHandler.error(res, "Invalid party type ID", 400);
    }

    await partiesService.deletePartyType(typeId, req.user);
    return responseHandler.success(
      res,
      null,
      "Party type deleted successfully"
    );
  });

  /**
   * Get active party types (for booking)
   */
  getActivePartyTypes = asyncHandler(async (req, res) => {
    const activeTypes = await partiesService.getActivePartyTypes();
    return responseHandler.success(
      res,
      activeTypes,
      "Active party types retrieved successfully"
    );
  });

  // ==================== PARTY ORDERS ====================

  /**
   * Get all party orders
   */
  getAllPartyOrders = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100),
      customerId: req.query.customerId
        ? parseInt(req.query.customerId)
        : undefined,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    // For customers, only show their own orders
    if (req.user.role === "END_USER" && req.user.customer) {
      options.customerId = req.user.customer.id;
    }

    const result = await partiesService.getAllPartyOrders(options);
    return responseHandler.paginated(
      res,
      result.partyOrders,
      result.pagination,
      "Party orders retrieved successfully"
    );
  });

  /**
   * Get party order by ID
   */
  getPartyOrderById = asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return responseHandler.error(res, "Invalid party order ID", 400);
    }

    const partyOrder = await partiesService.getPartyOrderById(
      orderId,
      req.user
    );
    return responseHandler.success(
      res,
      partyOrder,
      "Party order retrieved successfully"
    );
  });

  /**
   * Create new party order
   */
  createPartyOrder = asyncHandler(async (req, res) => {
    // For customers, use their customer ID
    if (req.user.role === "END_USER" && req.user.customer) {
      req.body.customerId = req.user.customer.id;
    }

    const partyOrder = await partiesService.createPartyOrder(
      req.body,
      req.user
    );
    return responseHandler.created(
      res,
      partyOrder,
      "Party order created successfully"
    );
  });

  /**
   * Update party order
   */
  updatePartyOrder = asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return responseHandler.error(res, "Invalid party order ID", 400);
    }

    const partyOrder = await partiesService.updatePartyOrder(
      orderId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      partyOrder,
      "Party order updated successfully"
    );
  });

  /**
   * Update party order status
   */
  updatePartyOrderStatus = asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return responseHandler.error(res, "Invalid party order ID", 400);
    }

    const { status, notes } = req.body;
    const partyOrder = await partiesService.updatePartyOrderStatus(
      orderId,
      status,
      notes,
      req.user
    );

    return responseHandler.success(
      res,
      partyOrder,
      `Party order status updated to ${status}`
    );
  });

  /**
   * Cancel party order
   */
  cancelPartyOrder = asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return responseHandler.error(res, "Invalid party order ID", 400);
    }

    const { cancellationReason } = req.body;
    const partyOrder = await partiesService.cancelPartyOrder(
      orderId,
      cancellationReason,
      req.user
    );

    return responseHandler.success(
      res,
      partyOrder,
      "Party order cancelled successfully"
    );
  });

  /**
   * Calculate party order cost
   */
  calculatePartyOrderCost = asyncHandler(async (req, res) => {
    const { partyTypeId, numberOfPeople, locationType, serviceType } = req.body;

    if (!partyTypeId || !numberOfPeople) {
      return responseHandler.error(
        res,
        "Party type ID and number of people are required",
        400
      );
    }

    const costCalculation = await partiesService.calculatePartyOrderCost({
      partyTypeId,
      numberOfPeople,
      locationType,
      serviceType,
    });

    return responseHandler.success(
      res,
      costCalculation,
      "Party order cost calculated successfully"
    );
  });

  /**
   * Get party statistics
   */
  getPartyStats = asyncHandler(async (req, res) => {
    const { dateFrom, dateTo, partyTypeId } = req.query;

    const stats = await partiesService.getPartyStats({
      dateFrom,
      dateTo,
      partyTypeId: partyTypeId ? parseInt(partyTypeId) : undefined,
    });

    return responseHandler.success(
      res,
      stats,
      "Party statistics retrieved successfully"
    );
  });

  /**
   * Get upcoming party orders
   */
  getUpcomingPartyOrders = asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;

    const upcomingOrders = await partiesService.getUpcomingPartyOrders(
      parseInt(days)
    );

    return responseHandler.success(
      res,
      upcomingOrders,
      "Upcoming party orders retrieved successfully"
    );
  });

  /**
   * Get party order timeline
   */
  getPartyOrderTimeline = asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return responseHandler.error(res, "Invalid party order ID", 400);
    }

    const timeline = await partiesService.getPartyOrderTimeline(
      orderId,
      req.user
    );
    return responseHandler.success(
      res,
      timeline,
      "Party order timeline retrieved successfully"
    );
  });

  /**
   * Generate party order report
   */
  generatePartyOrderReport = asyncHandler(async (req, res) => {
    const { dateFrom, dateTo, format = "json" } = req.query;

    const report = await partiesService.generatePartyOrderReport({
      dateFrom,
      dateTo,
      format,
      generatedBy: req.user,
    });

    if (format === "pdf" || format === "excel") {
      return responseHandler.download(
        res,
        report.filePath,
        report.fileName,
        report.contentType
      );
    }

    return responseHandler.success(
      res,
      report,
      "Party order report generated successfully"
    );
  });
}

const partiesController = new PartiesController();
export default partiesController;
