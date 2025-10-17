// src/modules/auth/emailAuth.controller.js
import emailAuthService from "./emailAuth.service.js";
import { responseHandler } from "../../utils/response.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import logger from "../../utils/logger.js";

/**
 * Email Authentication Controller
 */
class EmailAuthController {
  // ==================== OTP REGISTRATION ====================

  /**
   * Step 1: Request registration OTP via Email
   */
  requestRegistrationOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const requestInfo = {
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    };

    const result = await emailAuthService.requestRegistrationOtp(
      email,
      requestInfo
    );

    return responseHandler.success(
      res,
      result,
      "OTP sent to your email. Valid for 10 minutes."
    );
  });

  /**
   * Step 2: Verify OTP and complete registration
   */
  registerWithOtp = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const result = await emailAuthService.registerWithOtp(req.body);

    return responseHandler.withPerformance(
      res,
      result,
      "Registration successful. You can now login.",
      startTime
    );
  });

  // ==================== OTP LOGIN ====================

  /**
   * Step 1: Request login OTP via Email
   */
  requestLoginOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const requestInfo = {
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    };

    const result = await emailAuthService.requestLoginOtp(email, requestInfo);

    return responseHandler.success(
      res,
      result,
      "OTP sent to your email. Valid for 10 minutes."
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

    const result = await emailAuthService.loginWithOtp(credentials, loginInfo);

    return responseHandler.withPerformance(
      res,
      result,
      "Login successful",
      startTime
    );
  });

  // ==================== PASSWORD AUTHENTICATION ====================

  /**
   * Register with password
   */
  registerWithPassword = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const result = await emailAuthService.registerWithPassword(req.body);

    return responseHandler.withPerformance(
      res,
      result,
      result.message || "Registration successful",
      startTime
    );
  });

  /**
   * Login with password
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

    const result = await emailAuthService.loginWithPassword(
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

  // ==================== SHARED METHODS ====================

  logout = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const tokens = {
      accessToken: req.token,
      refreshToken: req.body.refreshToken,
    };
    const options = {
      logoutAll: req.body.logoutAll || false,
    };

    // Use phone auth service for shared functionality
    const phoneAuthService = (await import("./auth.service.js")).default;
    const result = await phoneAuthService.logout(userId, tokens, options);
    return responseHandler.success(res, result, "Logout successful");
  });

  refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const phoneAuthService = (await import("./auth.service.js")).default;
    const result = await phoneAuthService.refreshToken(refreshToken);
    return responseHandler.success(res, result, "Token refreshed successfully");
  });

  getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const phoneAuthService = (await import("./auth.service.js")).default;
    const profile = await phoneAuthService.getProfile(userId);
    return responseHandler.success(
      res,
      profile,
      "Profile retrieved successfully"
    );
  });

  getSessions = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const phoneAuthService = (await import("./auth.service.js")).default;
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
    const phoneAuthService = (await import("./auth.service.js")).default;
    const result = await phoneAuthService.revokeSession(
      userId,
      deviceId,
      req.user
    );
    return responseHandler.success(res, result, "Session revoked successfully");
  });
}

const emailAuthController = new EmailAuthController();
export default emailAuthController;
