// src/modules/auth/auth.routes.js - Phone Authentication
import express from "express";
import phoneAuthController from "./auth.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateRequest } from "./auth.validation.js";

const router = express.Router();

/**
 * Phone Authentication Routes
 */

// ==================== OTP REGISTRATION ====================

// Step 1: Request OTP for registration
router.post(
  "/register/request-otp",
  validateRequest("requestRegistrationOtp"),
  phoneAuthController.requestRegistrationOtp
);

// Step 2: Verify OTP and complete registration
router.post(
  "/register/verify-otp",
  validateRequest("registerWithOtp"),
  phoneAuthController.registerWithOtp
);

// ==================== OTP LOGIN ====================

// Step 1: Request OTP for login
router.post(
  "/login/request-otp",
  validateRequest("requestLoginOtp"),
  phoneAuthController.requestLoginOtp
);

// Step 2: Verify OTP and login
router.post(
  "/login/verify-otp",
  validateRequest("loginWithOtp"),
  phoneAuthController.loginWithOtp
);

// ==================== PASSWORD AUTHENTICATION (OPTIONAL) ====================

// Register with password (alternative method)
router.post(
  "/register/password",
  validateRequest("registerWithPassword"),
  phoneAuthController.registerWithPassword
);

// Login with password (alternative method)
router.post(
  "/login/password",
  validateRequest("loginWithPassword"),
  phoneAuthController.loginWithPassword
);

// ==================== PHONE VERIFICATION ====================

// Verify phone number (for password-registered users)
router.post(
  "/verify-phone",
  authMiddleware,
  validateRequest("verifyPhone"),
  phoneAuthController.verifyPhone
);

// Resend verification OTP
router.post(
  "/verify-phone/resend",
  authMiddleware,
  phoneAuthController.resendVerificationOtp
);

// ==================== SESSION MANAGEMENT ====================

// Logout
router.post("/logout", authMiddleware, phoneAuthController.logout);

// Refresh token
router.post(
  "/refresh-token",
  validateRequest("refreshToken"),
  phoneAuthController.refreshToken
);

// Get user profile
router.get("/profile", authMiddleware, phoneAuthController.getProfile);

// Get active sessions
router.get("/sessions", authMiddleware, phoneAuthController.getSessions);

// Revoke specific session
router.delete(
  "/sessions/:deviceId",
  authMiddleware,
  phoneAuthController.revokeSession
);

// ==================== ADMIN ROUTES ====================

// Update user role (admin only)
// router.put(
//   "/users/:userId/role",
//   authMiddleware,
//   requireRole("ADMIN"),
//   validateRequest("updateUserRole"),
//   phoneAuthController.updateUserRole
// );

export default router;
