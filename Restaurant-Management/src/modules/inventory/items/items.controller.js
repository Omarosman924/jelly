import itemsService from "./items.service.js";
import { responseHandler } from "../../../utils/response.js";
import { asyncHandler } from "../../../middleware/errorHandler.js";

class ItemsController {
  getAllItems = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100),
      search: req.query.search,
      itemType: req.query.itemType,
      unitId: req.query.unitId ? parseInt(req.query.unitId) : undefined,
      isAvailable:
        req.query.isAvailable === "true"
          ? true
          : req.query.isAvailable === "false"
          ? false
          : undefined,
      lowStock: req.query.lowStock === "true",
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await itemsService.getAllItems(options);
    return responseHandler.paginated(
      res,
      result.items,
      result.pagination,
      "Items retrieved successfully"
    );
  });

  getItemById = asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return responseHandler.error(res, "Invalid item ID", 400);
    }

    const item = await itemsService.getItemById(itemId);
    return responseHandler.success(res, item, "Item retrieved successfully");
  });

  createItem = asyncHandler(async (req, res) => {
    const item = await itemsService.createItem(req.body, req.user);
    return responseHandler.created(res, item, "Item created successfully");
  });

  updateItem = asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return responseHandler.error(res, "Invalid item ID", 400);
    }

    const item = await itemsService.updateItem(itemId, req.body, req.user);
    return responseHandler.success(res, item, "Item updated successfully");
  });

  deleteItem = asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return responseHandler.error(res, "Invalid item ID", 400);
    }

    await itemsService.deleteItem(itemId, req.user);
    return responseHandler.success(res, null, "Item deleted successfully");
  });

  adjustStock = asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return responseHandler.error(res, "Invalid item ID", 400);
    }

    const item = await itemsService.adjustStock(itemId, req.body, req.user);
    return responseHandler.success(res, item, "Stock adjusted successfully");
  });

  getLowStockItems = asyncHandler(async (req, res) => {
    const items = await itemsService.getLowStockItems();
    return responseHandler.success(
      res,
      items,
      "Low stock items retrieved successfully"
    );
  });

  getInventoryStats = asyncHandler(async (req, res) => {
    const stats = await itemsService.getInventoryStats();
    return responseHandler.success(
      res,
      stats,
      "Inventory statistics retrieved successfully"
    );
  });
}

const itemsController = new ItemsController();
export default itemsController;
