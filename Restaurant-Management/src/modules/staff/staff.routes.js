import express from "express";
import staffController from "./staff.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateRequest, validateQuery } from "./staff.validation.js";

const router = express.Router();

/**
 * Staff Routes V2
 * Handles staff management, shifts, attendance, and performance
 */

// Apply authentication to all routes
router.use(authMiddleware);

// ==================== STAFF PROFILE ROUTES ====================

// Get current staff profile
router.get("/me", staffController.getMyProfile);

// Update current staff profile
router.put(
  "/me",
  validateRequest("updateProfile"),
  staffController.updateMyProfile
);

// ==================== SHIFT MANAGEMENT ROUTES ====================

// Clock in (start shift)
router.post(
  "/me/clock-in",
  validateRequest("clockIn"),
  staffController.clockIn
);

// Clock out (end shift)
router.post(
  "/me/clock-out",
  validateRequest("clockOut"),
  staffController.clockOut
);

// Get current shift status
router.get("/me/shift-status", staffController.getShiftStatus);

// Get my shift history
router.get(
  "/me/shifts",
  validateQuery("shiftHistoryQuery"),
  staffController.getShiftHistory
);

// ==================== ATTENDANCE ROUTES ====================

// Get my attendance records
router.get(
  "/me/attendance",
  validateQuery("attendanceQuery"),
  staffController.getMyAttendance
);

// ==================== SALARY ROUTES ====================

// Get my salary information
router.get("/me/salary", staffController.getSalaryInfo);

// ==================== PERFORMANCE ROUTES ====================

// Get my performance metrics
router.get(
  "/me/performance",
  validateQuery("performanceQuery"),
  staffController.getPerformanceMetrics
);

// Get my performance reviews
router.get(
  "/me/reviews",
  validateQuery("reviewsQuery"),
  staffController.getPerformanceReviews
);

// ==================== NOTIFICATIONS ROUTES ====================

// Get staff notifications
router.get(
  "/me/notifications",
  validateQuery("notificationsQuery"),
  staffController.getStaffNotifications
);

// Mark notification as read
router.patch(
  "/me/notifications/:notificationId/read",
  staffController.markNotificationRead
);

// ==================== STAFF MANAGEMENT ROUTES (ADMIN/MANAGER) ====================

// Get all staff members
router.get(
  "/",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("staffQuery"),
  staffController.getAllStaff
);

// Get active staff members
router.get(
  "/active",
  requireRole("ADMIN", "HALL_MANAGER", "KITCHEN", "CASHIER"),
  staffController.getActiveStaff
);

// Create new staff member
router.post(
  "/",
  requireRole("ADMIN"),
  validateRequest("createStaff"),
  staffController.createStaff
);

// Get staff statistics
router.get(
  "/stats",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("statsQuery"),
  staffController.getStaffStats
);

// Get specific staff member
router.get(
  "/:id",
  requireRole("ADMIN", "HALL_MANAGER"),
  staffController.getStaffById
);

// Update staff member
router.put(
  "/:id",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateStaff"),
  staffController.updateStaff
);

// Delete staff member
router.delete("/:id", requireRole("ADMIN"), staffController.deleteStaff);

// ==================== SHIFT MANAGEMENT (ADMIN/MANAGER) ====================

// Get staff shift status
router.get(
  "/:id/shift-status",
  requireRole("ADMIN", "HALL_MANAGER"),
  staffController.getShiftStatus
);

// Get staff shift history
router.get(
  "/:id/shifts",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("shiftHistoryQuery"),
  staffController.getShiftHistory
);

// Update shift manually
router.put(
  "/shifts/:shiftId",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateShift"),
  staffController.updateShift
);

// Get shift schedule
router.get(
  "/schedule/view",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("scheduleQuery"),
  staffController.getShiftSchedule
);

// Create shift schedule
router.post(
  "/schedule",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("createSchedule"),
  staffController.createShiftSchedule
);

// Update shift schedule
router.put(
  "/schedule/:scheduleId",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("updateSchedule"),
  staffController.updateShiftSchedule
);

// ==================== ATTENDANCE MANAGEMENT ====================

// Get all attendance records
router.get(
  "/attendance/records",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("attendanceQuery"),
  staffController.getAttendance
);

// Generate attendance report
router.get(
  "/attendance/report",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("reportQuery"),
  staffController.generateAttendanceReport
);

// ==================== SALARY MANAGEMENT ====================

// Get staff salary information
router.get(
  "/:id/salary",
  requireRole("ADMIN", "HALL_MANAGER"),
  staffController.getSalaryInfo
);

// Update staff salary
router.put(
  "/:id/salary",
  requireRole("ADMIN"),
  validateRequest("updateSalary"),
  staffController.updateSalary
);

// Calculate monthly salary
router.get(
  "/:id/salary/calculate",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("salaryCalculationQuery"),
  staffController.calculateMonthlySalary
);

// Process payroll
router.post(
  "/payroll/process",
  requireRole("ADMIN"),
  validateRequest("processPayroll"),
  staffController.processPayroll
);

// ==================== PERFORMANCE MANAGEMENT ====================

// Get staff performance metrics
router.get(
  "/:id/performance",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("performanceQuery"),
  staffController.getPerformanceMetrics
);

// Create performance review
router.post(
  "/:id/reviews",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("createReview"),
  staffController.createPerformanceReview
);

// Get staff performance reviews
router.get(
  "/:id/reviews",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("reviewsQuery"),
  staffController.getPerformanceReviews
);

// ==================== REPORTS ====================

// Get productivity report
router.get(
  "/reports/productivity",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("reportQuery"),
  staffController.getProductivityReport
);

// Get overtime report
router.get(
  "/reports/overtime",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateQuery("overtimeQuery"),
  staffController.getOvertimeReport
);

// ==================== NOTIFICATIONS MANAGEMENT ====================

// Send staff notification
router.post(
  "/notifications/send",
  requireRole("ADMIN", "HALL_MANAGER"),
  validateRequest("sendNotification"),
  staffController.sendStaffNotification
);

export default router;
