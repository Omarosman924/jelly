import staffService from "./staff.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

/**
 * Staff Controller V2
 * Handles staff management, shifts, attendance, and performance
 */
class StaffController {
  // ==================== STAFF MANAGEMENT ====================

  /**
   * Get all staff members with pagination and filtering
   */
  getAllStaff = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 100),
      search: req.query.search,
      role: req.query.role,
      shiftType: req.query.shiftType,
      isOnDuty:
        req.query.isOnDuty === "true"
          ? true
          : req.query.isOnDuty === "false"
          ? false
          : undefined,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await staffService.getAllStaff(options);
    return responseHandler.paginated(
      res,
      result.staff,
      result.pagination,
      "Staff members retrieved successfully"
    );
  });

  /**
   * Get staff member by ID
   */
  getStaffById = asyncHandler(async (req, res) => {
    const staffId = parseInt(req.params.id);
    if (isNaN(staffId)) {
      return responseHandler.error(res, "Invalid staff ID", 400);
    }

    const staff = await staffService.getStaffById(staffId, req.user);
    return responseHandler.success(
      res,
      staff,
      "Staff member retrieved successfully"
    );
  });

  /**
   * Get current user's staff profile
   */
  getMyProfile = asyncHandler(async (req, res) => {
    if (!req.user.staff) {
      return responseHandler.error(res, "Staff profile not found", 404);
    }

    const staff = await staffService.getStaffById(req.user.staff.id, req.user);
    return responseHandler.success(
      res,
      staff,
      "Staff profile retrieved successfully"
    );
  });

  /**
   * Create new staff member
   */
  createStaff = asyncHandler(async (req, res) => {
    const staff = await staffService.createStaff(req.body, req.user);
    return responseHandler.created(
      res,
      staff,
      "Staff member created successfully"
    );
  });

  /**
   * Update staff member
   */
  updateStaff = asyncHandler(async (req, res) => {
    const staffId = parseInt(req.params.id);
    if (isNaN(staffId)) {
      return responseHandler.error(res, "Invalid staff ID", 400);
    }

    const staff = await staffService.updateStaff(staffId, req.body, req.user);
    return responseHandler.success(
      res,
      staff,
      "Staff member updated successfully"
    );
  });

  /**
   * Update my profile
   */
  updateMyProfile = asyncHandler(async (req, res) => {
    if (!req.user.staff) {
      return responseHandler.error(res, "Staff profile not found", 404);
    }

    const staff = await staffService.updateStaff(
      req.user.staff.id,
      req.body,
      req.user
    );
    return responseHandler.success(res, staff, "Profile updated successfully");
  });

  /**
   * Delete staff member (admin only)
   */
  deleteStaff = asyncHandler(async (req, res) => {
    const staffId = parseInt(req.params.id);
    if (isNaN(staffId)) {
      return responseHandler.error(res, "Invalid staff ID", 400);
    }

    await staffService.deleteStaff(staffId, req.user);
    return responseHandler.success(
      res,
      null,
      "Staff member deleted successfully"
    );
  });

  /**
   * Get active staff members (on duty)
   */
  getActiveStaff = asyncHandler(async (req, res) => {
    const activeStaff = await staffService.getActiveStaff(req.query.role);
    return responseHandler.success(
      res,
      activeStaff,
      "Active staff retrieved successfully"
    );
  });

  // ==================== SHIFT MANAGEMENT ====================

  /**
   * Clock in (start shift)
   */
  clockIn = asyncHandler(async (req, res) => {
    if (!req.user.staff) {
      return responseHandler.error(res, "Staff profile not found", 404);
    }

    const result = await staffService.clockIn(
      req.user.staff.id,
      req.body,
      req.user
    );
    return responseHandler.success(res, result, "Clocked in successfully");
  });

  /**
   * Clock out (end shift)
   */
  clockOut = asyncHandler(async (req, res) => {
    if (!req.user.staff) {
      return responseHandler.error(res, "Staff profile not found", 404);
    }

    const result = await staffService.clockOut(
      req.user.staff.id,
      req.body,
      req.user
    );
    return responseHandler.success(res, result, "Clocked out successfully");
  });

  /**
   * Get current shift status
   */
  getShiftStatus = asyncHandler(async (req, res) => {
    const staffId = req.params.id
      ? parseInt(req.params.id)
      : req.user.staff?.id;

    if (!staffId) {
      return responseHandler.error(res, "Staff ID required", 400);
    }

    const status = await staffService.getShiftStatus(staffId, req.user);
    return responseHandler.success(
      res,
      status,
      "Shift status retrieved successfully"
    );
  });

  /**
   * Get shift history
   */
  getShiftHistory = asyncHandler(async (req, res) => {
    const staffId = req.params.id
      ? parseInt(req.params.id)
      : req.user.staff?.id;

    if (!staffId) {
      return responseHandler.error(res, "Staff ID required", 400);
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      shiftType: req.query.shiftType,
    };

    const result = await staffService.getShiftHistory(
      staffId,
      options,
      req.user
    );
    return responseHandler.paginated(
      res,
      result.shifts,
      result.pagination,
      "Shift history retrieved successfully"
    );
  });

  /**
   * Update shift manually (admin/manager only)
   */
  updateShift = asyncHandler(async (req, res) => {
    const shiftId = parseInt(req.params.shiftId);
    if (isNaN(shiftId)) {
      return responseHandler.error(res, "Invalid shift ID", 400);
    }

    const shift = await staffService.updateShift(shiftId, req.body, req.user);
    return responseHandler.success(res, shift, "Shift updated successfully");
  });

  // ==================== ATTENDANCE MANAGEMENT ====================

  /**
   * Get attendance records
   */
  getAttendance = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      staffId: req.query.staffId ? parseInt(req.query.staffId) : undefined,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      shiftType: req.query.shiftType,
      sortBy: req.query.sortBy || "date",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await staffService.getAttendance(options);
    return responseHandler.paginated(
      res,
      result.attendance,
      result.pagination,
      "Attendance records retrieved successfully"
    );
  });

  /**
   * Get my attendance
   */
  getMyAttendance = asyncHandler(async (req, res) => {
    if (!req.user.staff) {
      return responseHandler.error(res, "Staff profile not found", 404);
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      staffId: req.user.staff.id,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sortBy: req.query.sortBy || "date",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await staffService.getAttendance(options);
    return responseHandler.paginated(
      res,
      result.attendance,
      result.pagination,
      "My attendance records retrieved successfully"
    );
  });

  /**
   * Generate attendance report
   */
  generateAttendanceReport = asyncHandler(async (req, res) => {
    const options = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      staffId: req.query.staffId ? parseInt(req.query.staffId) : undefined,
      format: req.query.format || "json",
      includeDetails: req.query.includeDetails === "true",
    };

    const report = await staffService.generateAttendanceReport(
      options,
      req.user
    );

    if (options.format === "json") {
      return responseHandler.success(
        res,
        report,
        "Attendance report generated successfully"
      );
    }

    return responseHandler.download(
      res,
      report.filePath,
      report.fileName,
      report.contentType
    );
  });

  // ==================== SALARY MANAGEMENT ====================

  /**
   * Get salary information
   */
  getSalaryInfo = asyncHandler(async (req, res) => {
    const staffId = req.params.id
      ? parseInt(req.params.id)
      : req.user.staff?.id;

    if (!staffId) {
      return responseHandler.error(res, "Staff ID required", 400);
    }

    const salaryInfo = await staffService.getSalaryInfo(staffId, req.user);
    return responseHandler.success(
      res,
      salaryInfo,
      "Salary information retrieved successfully"
    );
  });

  /**
   * Update salary (admin only)
   */
  updateSalary = asyncHandler(async (req, res) => {
    const staffId = parseInt(req.params.id);
    if (isNaN(staffId)) {
      return responseHandler.error(res, "Invalid staff ID", 400);
    }

    const result = await staffService.updateSalary(staffId, req.body, req.user);
    return responseHandler.success(res, result, "Salary updated successfully");
  });

  /**
   * Calculate monthly salary
   */
  calculateMonthlySalary = asyncHandler(async (req, res) => {
    const staffId = parseInt(req.params.id);
    const { month, year } = req.query;

    if (isNaN(staffId)) {
      return responseHandler.error(res, "Invalid staff ID", 400);
    }

    if (!month || !year) {
      return responseHandler.error(res, "Month and year are required", 400);
    }

    const calculation = await staffService.calculateMonthlySalary(
      staffId,
      parseInt(month),
      parseInt(year),
      req.user
    );

    return responseHandler.success(
      res,
      calculation,
      "Monthly salary calculated successfully"
    );
  });

  /**
   * Process payroll (admin only)
   */
  processPayroll = asyncHandler(async (req, res) => {
    const { month, year, staffIds } = req.body;

    const result = await staffService.processPayroll(
      parseInt(month),
      parseInt(year),
      staffIds,
      req.user
    );

    return responseHandler.success(
      res,
      result,
      "Payroll processed successfully"
    );
  });

  // ==================== PERFORMANCE MANAGEMENT ====================

  /**
   * Get staff performance metrics
   */
  getPerformanceMetrics = asyncHandler(async (req, res) => {
    const staffId = req.params.id
      ? parseInt(req.params.id)
      : req.user.staff?.id;

    if (!staffId) {
      return responseHandler.error(res, "Staff ID required", 400);
    }

    const options = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      includeComparisons: req.query.includeComparisons === "true",
    };

    const metrics = await staffService.getPerformanceMetrics(
      staffId,
      options,
      req.user
    );
    return responseHandler.success(
      res,
      metrics,
      "Performance metrics retrieved successfully"
    );
  });

  /**
   * Create performance review
   */
  createPerformanceReview = asyncHandler(async (req, res) => {
    const staffId = parseInt(req.params.id);
    if (isNaN(staffId)) {
      return responseHandler.error(res, "Invalid staff ID", 400);
    }

    const review = await staffService.createPerformanceReview(
      staffId,
      req.body,
      req.user
    );
    return responseHandler.created(
      res,
      review,
      "Performance review created successfully"
    );
  });

  /**
   * Get performance reviews
   */
  getPerformanceReviews = asyncHandler(async (req, res) => {
    const staffId = req.params.id
      ? parseInt(req.params.id)
      : req.user.staff?.id;

    if (!staffId) {
      return responseHandler.error(res, "Staff ID required", 400);
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 50),
      reviewType: req.query.reviewType,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    };

    const result = await staffService.getPerformanceReviews(
      staffId,
      options,
      req.user
    );
    return responseHandler.paginated(
      res,
      result.reviews,
      result.pagination,
      "Performance reviews retrieved successfully"
    );
  });

  // ==================== STAFF ANALYTICS ====================

  /**
   * Get staff statistics
   */
  getStaffStats = asyncHandler(async (req, res) => {
    const options = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      role: req.query.role,
      shiftType: req.query.shiftType,
    };

    const stats = await staffService.getStaffStats(options);
    return responseHandler.success(
      res,
      stats,
      "Staff statistics retrieved successfully"
    );
  });

  /**
   * Get staff productivity report
   */
  getProductivityReport = asyncHandler(async (req, res) => {
    const options = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      staffId: req.query.staffId ? parseInt(req.query.staffId) : undefined,
      format: req.query.format || "json",
    };

    const report = await staffService.getProductivityReport(options, req.user);

    if (options.format === "json") {
      return responseHandler.success(
        res,
        report,
        "Productivity report generated successfully"
      );
    }

    return responseHandler.download(
      res,
      report.filePath,
      report.fileName,
      report.contentType
    );
  });

  /**
   * Get overtime report
   */
  getOvertimeReport = asyncHandler(async (req, res) => {
    const options = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      staffId: req.query.staffId ? parseInt(req.query.staffId) : undefined,
      threshold: parseInt(req.query.threshold) || 8, // hours per day
    };

    const report = await staffService.getOvertimeReport(options);
    return responseHandler.success(
      res,
      report,
      "Overtime report generated successfully"
    );
  });

  // ==================== SHIFT SCHEDULING ====================

  /**
   * Get shift schedule
   */
  getShiftSchedule = asyncHandler(async (req, res) => {
    const options = {
      dateFrom: req.query.dateFrom || new Date().toISOString().split("T")[0],
      dateTo: req.query.dateTo,
      staffId: req.query.staffId ? parseInt(req.query.staffId) : undefined,
      shiftType: req.query.shiftType,
    };

    const schedule = await staffService.getShiftSchedule(options);
    return responseHandler.success(
      res,
      schedule,
      "Shift schedule retrieved successfully"
    );
  });

  /**
   * Create shift schedule (admin/manager only)
   */
  createShiftSchedule = asyncHandler(async (req, res) => {
    const schedule = await staffService.createShiftSchedule(req.body, req.user);
    return responseHandler.created(
      res,
      schedule,
      "Shift schedule created successfully"
    );
  });

  /**
   * Update shift schedule
   */
  updateShiftSchedule = asyncHandler(async (req, res) => {
    const scheduleId = parseInt(req.params.scheduleId);
    if (isNaN(scheduleId)) {
      return responseHandler.error(res, "Invalid schedule ID", 400);
    }

    const schedule = await staffService.updateShiftSchedule(
      scheduleId,
      req.body,
      req.user
    );
    return responseHandler.success(
      res,
      schedule,
      "Shift schedule updated successfully"
    );
  });

  // ==================== STAFF NOTIFICATIONS ====================

  /**
   * Get staff notifications
   */
  getStaffNotifications = asyncHandler(async (req, res) => {
    if (!req.user.staff) {
      return responseHandler.error(res, "Staff profile not found", 404);
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      unreadOnly: req.query.unreadOnly === "true",
      type: req.query.type,
    };

    const result = await staffService.getStaffNotifications(
      req.user.staff.id,
      options
    );
    return responseHandler.paginated(
      res,
      result.notifications,
      result.pagination,
      "Staff notifications retrieved successfully"
    );
  });

  /**
   * Mark notification as read
   */
  markNotificationRead = asyncHandler(async (req, res) => {
    const notificationId = parseInt(req.params.notificationId);
    if (isNaN(notificationId)) {
      return responseHandler.error(res, "Invalid notification ID", 400);
    }

    await staffService.markNotificationRead(notificationId, req.user);
    return responseHandler.success(res, null, "Notification marked as read");
  });

  /**
   * Send staff notification (admin/manager only)
   */
  sendStaffNotification = asyncHandler(async (req, res) => {
    const result = await staffService.sendStaffNotification(req.body, req.user);
    return responseHandler.success(
      res,
      result,
      "Notification sent successfully"
    );
  });
}

const staffController = new StaffController();
export default staffController;
