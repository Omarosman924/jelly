import deliveryAreasService from "./deliveryAreas.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

/**
 * Delivery Areas Controller
 * Handles HTTP requests for delivery area management
 */
class DeliveryAreasController {
  /**
   * Get all delivery areas
   */
  getAllDeliveryAreas = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      search: req.query.search,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      sortBy: req.query.sortBy || "areaName",
      sortOrder: req.query.sortOrder || "asc",
    };

    const result = await deliveryAreasService.getAllDeliveryAreas(options);
    return responseHandler.paginated(
      res,
      result.areas,
      result.pagination,
      "Delivery areas retrieved successfully"
    );
  });

  /**
   * Get delivery area by ID
   */
  getDeliveryAreaById = asyncHandler(async (req, res) => {
    const areaId = parseInt(req.params.id);

    if (isNaN(areaId)) {
      return responseHandler.error(res, "Invalid delivery area ID", 400);
    }

    const area = await deliveryAreasService.getDeliveryAreaById(areaId);
    return responseHandler.success(
      res,
      area,
      "Delivery area retrieved successfully"
    );
  });

  /**
   * Create new delivery area
   */
  createDeliveryArea = asyncHandler(async (req, res) => {
    const area = await deliveryAreasService.createDeliveryArea(
      req.body,
      req.user
    );
    return responseHandler.created(
      res,
      area,
      "Delivery area created successfully"
    );
  });

  /**
   * Update delivery area
   */
  updateDeliveryArea = asyncHandler(async (req, res) => {
    const areaId = parseInt(req.params.id);

    if (isNaN(areaId)) {
      return responseHandler.error(res, "Invalid delivery area ID", 400);
    }

    const area = await deliveryAreasService.updateDeliveryArea(
      areaId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      area,
      "Delivery area updated successfully"
    );
  });

  /**
   * Delete delivery area
   */
  deleteDeliveryArea = asyncHandler(async (req, res) => {
    const areaId = parseInt(req.params.id);

    if (isNaN(areaId)) {
      return responseHandler.error(res, "Invalid delivery area ID", 400);
    }

    await deliveryAreasService.deleteDeliveryArea(areaId, req.user);
    return responseHandler.success(
      res,
      null,
      "Delivery area deleted successfully"
    );
  });

  /**
   * Toggle delivery area status
   */
  toggleDeliveryAreaStatus = asyncHandler(async (req, res) => {
    const areaId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (isNaN(areaId)) {
      return responseHandler.error(res, "Invalid delivery area ID", 400);
    }

    const area = await deliveryAreasService.toggleDeliveryAreaStatus(
      areaId,
      isActive,
      req.user
    );

    const message = isActive
      ? "Delivery area activated successfully"
      : "Delivery area deactivated successfully";

    return responseHandler.success(res, area, message);
  });

  /**
   * Get delivery area statistics
   */
  getDeliveryAreaStats = asyncHandler(async (req, res) => {
    const stats = await deliveryAreasService.getDeliveryAreaStats();
    return responseHandler.success(
      res,
      stats,
      "Delivery area statistics retrieved successfully"
    );
  });
}

const deliveryAreasController = new DeliveryAreasController();
export default deliveryAreasController;
