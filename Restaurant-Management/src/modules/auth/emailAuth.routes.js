// src/modules/auth/emailAuth.routes.js
import express from "express";
import emailAuthController from "./emailAuth.controller.js";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/authMiddleware.js";
import { validateEmailRequest } from "./emailAuth.validation.js";

const router = express.Router();

/**
 * Email Authentication Routes
 */

// ==================== OTP REGISTRATION ====================

// Step 1: Request OTP for registration via email
router.post(
  "/register/request-otp",
  validateEmailRequest("requestRegistrationOtp"),
  emailAuthController.requestRegistrationOtp
);

// Step 2: Verify OTP and complete registration
router.post(
  "/register/verify-otp",
  validateEmailRequest("registerWithOtp"),
  emailAuthController.registerWithOtp
);

// ==================== OTP LOGIN ====================

// Step 1: Request OTP for login via email
router.post(
  "/login/request-otp",
  validateEmailRequest("requestLoginOtp"),
  emailAuthController.requestLoginOtp
);

// Step 2: Verify OTP and login
router.post(
  "/login/verify-otp",
  validateEmailRequest("loginWithOtp"),
  emailAuthController.loginWithOtp
);

// ==================== PASSWORD AUTHENTICATION ====================

// Register with password
router.post(
  "/register/password",
  validateEmailRequest("registerWithPassword"),
  emailAuthController.registerWithPassword
);

// Login with password
router.post(
  "/login/password",
  validateEmailRequest("loginWithPassword"),
  emailAuthController.loginWithPassword
);

// ==================== SESSION MANAGEMENT ====================

// Logout
router.post("/logout", authMiddleware, emailAuthController.logout);

// Refresh token
router.post(
  "/refresh-token",
  validateEmailRequest("refreshToken"),
  emailAuthController.refreshToken
);

// Get user profile
router.get("/profile", authMiddleware, emailAuthController.getProfile);

// Get active sessions
router.get("/sessions", authMiddleware, emailAuthController.getSessions);

// Revoke specific session
router.delete(
  "/sessions/:deviceId",
  authMiddleware,
  emailAuthController.revokeSession
);

export default router;
