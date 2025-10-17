// src/modules/auth/auth.controller.js - Phone Authentication
import phoneAuthService from "./auth.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import logger from "../../utils/logger.js";

/**
 * Phone Authentication Controller
 */
class PhoneAuthController {
  // ==================== OTP REGISTRATION ====================

  /**
   * Step 1: Request registration OTP
   */
  requestRegistrationOtp = asyncHandler(async (req, res) => {
    const { phone } = req.body;
    const requestInfo = {
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    };

    const result = await phoneAuthService.requestRegistrationOtp(
      phone,
      requestInfo
    );

    return responseHandler.success(
      res,
      result,
      "OTP sent successfully. Valid for 5 minutes."
    );
  });

  /**
   * Step 2: Verify OTP and complete registration
   */
  registerWithOtp = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const result = await phoneAuthService.registerWithOtp(req.body);

    return responseHandler.withPerformance(
      res,
      result,
      "Registration successful. You can now login.",
      startTime
    );
  });

  // ==================== OTP LOGIN ====================

  /**
   * Step 1: Request login OTP
   */
  requestLoginOtp = asyncHandler(async (req, res) => {
    const { phone } = req.body;
    const requestInfo = {
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    };

    const result = await phoneAuthService.requestLoginOtp(phone, requestInfo);

    return responseHandler.success(
      res,
      result,
      "OTP sent successfully. Valid for 5 minutes."
    );
  });

  /**
   * Step 2: Verify OTP and login
   */
  loginWithOtp = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const credentials = req.body;
    const loginInfo = {
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      deviceInfo: {
        deviceName: req.body.deviceName,
        platform: req.body.platform,
        ...req.body.deviceInfo,
      },
    };

    const result = await phoneAuthService.loginWithOtp(credentials, loginInfo);

    return responseHandler.withPerformance(
      res,
      result,
      "Login successful",
      startTime
    );
  });

  // ==================== PASSWORD AUTHENTICATION (OPTIONAL) ====================

  /**
   * Register with password (optional method)
   */
  registerWithPassword = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const result = await phoneAuthService.registerWithPassword(req.body);

    return responseHandler.withPerformance(
      res,
      result,
      result.message || "Registration successful",
      startTime
    );
  });

  /**
   * Login with password (optional method)
   */
  loginWithPassword = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const credentials = req.body;
    const loginInfo = {
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      deviceInfo: {
        deviceName: req.body.deviceName,
        platform: req.body.platform,
        ...req.body.deviceInfo,
      },
    };

    const result = await phoneAuthService.loginWithPassword(
      credentials,
      loginInfo
    );

    return responseHandler.withPerformance(
      res,
      result,
      "Login successful",
      startTime
    );
  });

  // ==================== PHONE VERIFICATION ====================

  /**
   * Verify phone number with OTP
   */
  verifyPhone = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { otp } = req.body;

    const result = await phoneAuthService.verifyPhone(userId, otp);

    return responseHandler.success(res, result, result.message);
  });

  /**
   * Resend verification OTP
   */
  resendVerificationOtp = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const result = await phoneAuthService.resendVerificationOtp(userId);

    return responseHandler.success(res, result, "Verification OTP resent");
  });

  // ==================== INHERITED METHODS ====================
  // Keep existing methods for logout, refresh token, etc.

  logout = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const tokens = {
      accessToken: req.token,
      refreshToken: req.body.refreshToken,
    };
    const options = {
      logoutAll: req.body.logoutAll || false,
    };

    const result = await phoneAuthService.logout(userId, tokens, options);
    return responseHandler.success(res, result, "Logout successful");
  });

  refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const result = await phoneAuthService.refreshToken(refreshToken);
    return responseHandler.success(res, result, "Token refreshed successfully");
  });

  getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const profile = await phoneAuthService.getProfile(userId);
    return responseHandler.success(
      res,
      profile,
      "Profile retrieved successfully"
    );
  });

  getSessions = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const sessions = await phoneAuthService.getUserSessions(userId);
    return responseHandler.success(
      res,
      { sessions },
      "Sessions retrieved successfully"
    );
  });

  revokeSession = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { deviceId } = req.params;
    const result = await phoneAuthService.revokeSession(
      userId,
      deviceId,
      req.user
    );
    return responseHandler.success(res, result, "Session revoked successfully");
  });
}

const phoneAuthController = new PhoneAuthController();
export default phoneAuthController;
