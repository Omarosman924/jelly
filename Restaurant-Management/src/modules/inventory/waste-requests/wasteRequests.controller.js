import wasteRequestsService from "./wasteRequests.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";

/**
 * Waste Requests Controller V2
 * Handles waste request operations with approval workflow
 */
class WasteRequestsController {
  /**
   * Get all waste requests with filtering and pagination
   */
  getAllWasteRequests = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      itemId: req.query.itemId ? parseInt(req.query.itemId) : undefined,
      status: req.query.status,
      requestedByStaffId: req.query.requestedByStaffId
        ? parseInt(req.query.requestedByStaffId)
        : undefined,
      approvedByAdminId: req.query.approvedByAdminId
        ? parseInt(req.query.approvedByAdminId)
        : undefined,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      sortBy: req.query.sortBy || "requestedAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await wasteRequestsService.getAllWasteRequests(options);
    return responseHandler.paginated(
      res,
      result.wasteRequests,
      result.pagination,
      "Waste requests retrieved successfully"
    );
  });

  /**
   * Get waste request by ID
   */
  getWasteRequestById = asyncHandler(async (req, res) => {
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return responseHandler.error(res, "Invalid request ID", 400);
    }

    const wasteRequest = await wasteRequestsService.getWasteRequestById(
      requestId
    );
    return responseHandler.success(
      res,
      wasteRequest,
      "Waste request retrieved successfully"
    );
  });

  /**
   * Create new waste request
   */
  createWasteRequest = asyncHandler(async (req, res) => {
    const wasteRequest = await wasteRequestsService.createWasteRequest(
      req.body,
      req.user
    );
    return responseHandler.created(
      res,
      wasteRequest,
      "Waste request created successfully"
    );
  });

  /**
   * Approve waste request
   */
  approveWasteRequest = asyncHandler(async (req, res) => {
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return responseHandler.error(res, "Invalid request ID", 400);
    }

    const { adminNotes } = req.body;
    const wasteRequest = await wasteRequestsService.approveWasteRequest(
      requestId,
      req.user,
      adminNotes
    );
    return responseHandler.success(
      res,
      wasteRequest,
      "Waste request approved successfully"
    );
  });

  /**
   * Reject waste request
   */
  rejectWasteRequest = asyncHandler(async (req, res) => {
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return responseHandler.error(res, "Invalid request ID", 400);
    }

    const { adminNotes } = req.body;
    if (!adminNotes || adminNotes.trim().length < 10) {
      return responseHandler.error(
        res,
        "Rejection reason is required and must be at least 10 characters",
        400
      );
    }

    const wasteRequest = await wasteRequestsService.rejectWasteRequest(
      requestId,
      req.user,
      adminNotes
    );
    return responseHandler.success(
      res,
      wasteRequest,
      "Waste request rejected successfully"
    );
  });

  /**
   * Get pending waste requests (for approval queue)
   */
  getPendingWasteRequests = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
    };

    const result = await wasteRequestsService.getPendingWasteRequests(options);
    return responseHandler.paginated(
      res,
      result.requests,
      result.pagination,
      "Pending waste requests retrieved successfully"
    );
  });

  /**
   * Get waste request statistics
   */
  getWasteRequestStats = asyncHandler(async (req, res) => {
    const { period = "month" } = req.query;
    const stats = await wasteRequestsService.getWasteRequestStats(period);
    return responseHandler.success(
      res,
      stats,
      "Waste request statistics retrieved successfully"
    );
  });

  /**
   * Generate waste report
   */
  generateWasteReport = asyncHandler(async (req, res) => {
    const options = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      itemId: req.query.itemId ? parseInt(req.query.itemId) : undefined,
      status: req.query.status,
      format: req.query.format || "summary",
    };

    const report = await wasteRequestsService.generateWasteReport(
      options,
      req.user
    );
    return responseHandler.success(
      res,
      report,
      "Waste report generated successfully"
    );
  });

  /**
   * Get my waste requests (for staff to see their own requests)
   */
  getMyWasteRequests = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 50),
      requestedByStaffId: req.user.staff?.id || req.user.id,
      status: req.query.status,
      sortBy: "requestedAt",
      sortOrder: "desc",
    };

    const result = await wasteRequestsService.getAllWasteRequests(options);
    return responseHandler.paginated(
      res,
      result.wasteRequests,
      result.pagination,
      "Your waste requests retrieved successfully"
    );
  });

  /**
   * Get urgent waste requests (high value or old requests)
   */
  getUrgentWasteRequests = asyncHandler(async (req, res) => {
    const requests = await wasteRequestsService.getPendingWasteRequests({
      page: 1,
      limit: 50,
    });

    // Filter only urgent requests
    const urgentRequests = requests.requests.filter(
      (request) =>
        request.isUrgent || request.priority > 70 || request.wasteValue > 500
    );

    return responseHandler.success(
      res,
      urgentRequests,
      "Urgent waste requests retrieved successfully"
    );
  });

  /**
   * Bulk approve waste requests
   */
  bulkApproveWasteRequests = asyncHandler(async (req, res) => {
    const { requestIds, adminNotes } = req.body;

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return responseHandler.error(res, "Request IDs array is required", 400);
    }

    if (requestIds.length > 20) {
      return responseHandler.error(
        res,
        "Maximum 20 requests can be approved at once",
        400
      );
    }

    const results = {
      approved: [],
      failed: [],
    };

    for (const requestId of requestIds) {
      try {
        const approvedRequest = await wasteRequestsService.approveWasteRequest(
          requestId,
          req.user,
          adminNotes
        );
        results.approved.push({
          id: requestId,
          success: true,
          request: approvedRequest,
        });
      } catch (error) {
        results.failed.push({
          id: requestId,
          success: false,
          error: error.message,
        });
      }
    }

    const message = `Bulk approval completed: ${results.approved.length} approved, ${results.failed.length} failed`;

    if (results.failed.length === 0) {
      return responseHandler.success(res, results, message);
    } else {
      return responseHandler.success(res, results, message, 207); // Multi-status
    }
  });
}

const wasteRequestsController = new WasteRequestsController();
export default wasteRequestsController;
