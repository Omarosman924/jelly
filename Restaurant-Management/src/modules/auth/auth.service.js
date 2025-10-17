// src/modules/auth/auth.service.js - Phone Authentication
import bcrypt from "bcryptjs";
import BaseService from "../../utils/baseService.js";
import logger, { authLogger } from "../../utils/logger.js";
import {
  ValidationError,
  AuthenticationError,
} from "../../middleware/errorHandler.js";
import tokenManager from "../../utils/jwt.js";
import auditLogger from "../../utils/auditLogger.js";
import userProfileManager from "../../utils/userProfileManager.js";
import otpService from "../../utils/otpService.js";

class PhoneAuthService extends BaseService {
  constructor() {
    super();
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  }

  /**
   * Step 1: Request registration OTP
   */
  async requestRegistrationOtp(phone, requestInfo = {}) {
    try {
      // Normalize phone number
      const normalizedPhone = otpService.normalizePhone(phone);

      // Check if phone already exists
      const existingUser = await this.db.user.findUnique({
        where: { phone: normalizedPhone },
      });

      if (existingUser) {
        throw new ValidationError("Phone number already registered");
      }

      // Send OTP
      const result = await otpService.sendOtp(
        normalizedPhone,
        "REGISTRATION",
        null,
        {
          ipAddress: requestInfo.ipAddress,
          userAgent: requestInfo.userAgent,
        }
      );

      logger.info("Registration OTP requested", {
        phone: otpService.maskPhone(normalizedPhone),
      });

      return result;
    } catch (error) {
      logger.error("Registration OTP request failed", {
        phone: otpService.maskPhone(phone),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Step 2: Verify OTP and complete registration
   */
  async registerWithOtp(userData) {
    try {
      const {
        phone,
        otp,
        firstName,
        lastName,
        role = "END_USER",
        email,
      } = userData;

      // Normalize phone
      const normalizedPhone = otpService.normalizePhone(phone);

      // Verify OTP
      await otpService.verifyOtpCode(normalizedPhone, otp, "REGISTRATION");

      // Check phone again (race condition protection)
      const existingUser = await this.db.user.findUnique({
        where: { phone: normalizedPhone },
      });

      if (existingUser) {
        throw new ValidationError("Phone number already registered");
      }

      // Create user in transaction
      const user = await this.executeTransaction(async (prisma) => {
        // Create user (no password needed for OTP-only users)
        const newUser = await prisma.user.create({
          data: {
            phone: normalizedPhone,
            email: email || null,
            passwordHash: null, // OTP-only authentication
            firstName,
            lastName,
            role,
            isActive: true,
            isVerified: true, // Already verified via OTP
          },
          select: {
            id: true,
            phone: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isVerified: true,
            createdAt: true,
          },
        });

        // Create appropriate profile
        if (userProfileManager.isEndUser(role)) {
          await userProfileManager.createCustomerProfile(newUser.id, prisma);
        } else if (userProfileManager.isStaff(role)) {
          await userProfileManager.createStaffProfile(newUser.id, role, prisma);
        }

        return newUser;
      });

      // Log registration
      await auditLogger.logAuthEvent("REGISTRATION", user.id, {
        phone: normalizedPhone,
        role: user.role,
        method: "OTP",
      });

      authLogger.info("User registered successfully via OTP", {
        userId: user.id,
        phone: otpService.maskPhone(normalizedPhone),
        role: user.role,
      });

      return { user };
    } catch (error) {
      logger.error("OTP registration failed", {
        phone: otpService.maskPhone(userData.phone),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Step 1: Request login OTP
   */
  async requestLoginOtp(phone, requestInfo = {}) {
    try {
      // Normalize phone
      const normalizedPhone = otpService.normalizePhone(phone);

      // Check if user exists
      const user = await this.db.user.findUnique({
        where: { phone: normalizedPhone, isActive: true },
        select: { id: true, phone: true, firstName: true },
      });

      // Don't reveal if user exists (security)
      if (!user) {
        // Still pretend to send OTP
        logger.info("Login OTP requested for non-existent phone", {
          phone: otpService.maskPhone(normalizedPhone),
        });

        // Return success but don't actually send
        return {
          success: true,
          message: "If phone exists, OTP has been sent",
        };
      }

      // Send OTP
      const result = await otpService.sendOtp(
        normalizedPhone,
        "LOGIN",
        user.id,
        {
          ipAddress: requestInfo.ipAddress,
          userAgent: requestInfo.userAgent,
        }
      );

      logger.info("Login OTP requested", {
        userId: user.id,
        phone: otpService.maskPhone(normalizedPhone),
      });

      return result;
    } catch (error) {
      logger.error("Login OTP request failed", {
        phone: otpService.maskPhone(phone),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Step 2: Verify OTP and login
   */
  async loginWithOtp(credentials, loginInfo = {}) {
    try {
      const { phone, otp } = credentials;
      const { ipAddress, userAgent, deviceInfo } = loginInfo;

      // Normalize phone
      const normalizedPhone = otpService.normalizePhone(phone);

      // Verify OTP
      const otpResult = await otpService.verifyOtpCode(
        normalizedPhone,
        otp,
        "LOGIN"
      );

      // Get user with related data
      const user = await this.db.user.findUnique({
        where: { phone: normalizedPhone, isActive: true },
        include: {
          customer: {
            select: { id: true, loyaltyPoints: true },
          },
          staff: {
            select: { id: true, employeeCode: true, isOnDuty: true },
          },
        },
      });

      if (!user) {
        throw new AuthenticationError("User not found or inactive");
      }

      // Generate tokens with device tracking
      const tokenPayload = {
        id: user.id,
        phone: user.phone,
        role: user.role,
      };

      const tokens = await tokenManager.generateTokenPair(tokenPayload, {
        ipAddress,
        userAgent,
        deviceName: deviceInfo?.deviceName || "Unknown Device",
        ...deviceInfo,
      });

      // Update last login
      await this.db.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
      });

      // Log successful login
      await auditLogger.logAuthEvent("LOGIN_SUCCESS", user.id, {
        phone: normalizedPhone,
        ipAddress,
        userAgent,
        deviceId: tokens.deviceId,
        method: "OTP",
      });

      authLogger.info("User logged in successfully via OTP", {
        userId: user.id,
        phone: otpService.maskPhone(normalizedPhone),
        role: user.role,
        deviceId: tokens.deviceId,
      });

      return {
        user,
        tokens,
      };
    } catch (error) {
      logger.error("OTP login failed", {
        phone: otpService.maskPhone(credentials.phone),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Traditional password-based registration (optional)
   */
  async registerWithPassword(userData) {
    try {
      const {
        phone,
        password,
        firstName,
        lastName,
        role = "END_USER",
        email,
      } = userData;

      // Normalize phone
      const normalizedPhone = otpService.normalizePhone(phone);

      // Check if phone already exists
      const existingUser = await this.db.user.findUnique({
        where: { phone: normalizedPhone },
      });

      if (existingUser) {
        throw new ValidationError("Phone number already registered");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      // Create user in transaction
      const user = await this.executeTransaction(async (prisma) => {
        const newUser = await prisma.user.create({
          data: {
            phone: normalizedPhone,
            email: email || null,
            passwordHash,
            firstName,
            lastName,
            role,
            isActive: true,
            isVerified: false, // Need to verify phone
          },
          select: {
            id: true,
            phone: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isVerified: true,
            createdAt: true,
          },
        });

        // Create appropriate profile
        if (userProfileManager.isEndUser(role)) {
          await userProfileManager.createCustomerProfile(newUser.id, prisma);
        } else if (userProfileManager.isStaff(role)) {
          await userProfileManager.createStaffProfile(newUser.id, role, prisma);
        }

        return newUser;
      });

      // Send verification OTP
      await otpService.sendOtp(normalizedPhone, "PHONE_VERIFICATION", user.id);

      // Log registration
      await auditLogger.logAuthEvent("REGISTRATION", user.id, {
        phone: normalizedPhone,
        role: user.role,
        method: "PASSWORD",
      });

      return {
        user,
        message: "Registration successful. Please verify your phone.",
      };
    } catch (error) {
      logger.error("Password registration failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Traditional password-based login
   */
  async loginWithPassword(credentials, loginInfo = {}) {
    try {
      const { phone, password } = credentials;
      const { ipAddress, userAgent, deviceInfo } = loginInfo;

      // Normalize phone
      const normalizedPhone = otpService.normalizePhone(phone);

      // Find user
      const user = await this.db.user.findUnique({
        where: { phone: normalizedPhone, isActive: true },
        include: {
          customer: {
            select: { id: true, loyaltyPoints: true },
          },
          staff: {
            select: { id: true, employeeCode: true, isOnDuty: true },
          },
        },
      });

      if (!user || !user.passwordHash) {
        throw new AuthenticationError("Invalid credentials");
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        await auditLogger.logAuthEvent("LOGIN_FAILURE", user.id, {
          phone: normalizedPhone,
          ipAddress,
          reason: "INVALID_PASSWORD",
        });
        throw new AuthenticationError("Invalid credentials");
      }

      // Generate tokens
      const tokenPayload = {
        id: user.id,
        phone: user.phone,
        role: user.role,
      };

      const tokens = await tokenManager.generateTokenPair(tokenPayload, {
        ipAddress,
        userAgent,
        deviceName: deviceInfo?.deviceName || "Unknown Device",
        ...deviceInfo,
      });

      // Update last login
      await this.db.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
      });

      // Log successful login
      await auditLogger.logAuthEvent("LOGIN_SUCCESS", user.id, {
        phone: normalizedPhone,
        ipAddress,
        userAgent,
        deviceId: tokens.deviceId,
        method: "PASSWORD",
      });

      return {
        user,
        tokens,
      };
    } catch (error) {
      logger.error("Password login failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Verify phone number
   */
  async verifyPhone(userId, otp) {
    try {
      const user = await this.db.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true, isVerified: true },
      });

      if (!user) {
        throw new AuthenticationError("User not found");
      }

      if (user.isVerified) {
        return { success: true, message: "Phone already verified" };
      }

      // Verify OTP
      await otpService.verifyOtpCode(user.phone, otp, "PHONE_VERIFICATION");

      // Update user
      await this.db.user.update({
        where: { id: userId },
        data: { isVerified: true },
      });

      logger.info("Phone verified successfully", { userId });

      return { success: true, message: "Phone verified successfully" };
    } catch (error) {
      logger.error("Phone verification failed", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Resend verification OTP
   */
  async resendVerificationOtp(userId) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { phone: true, isVerified: true },
    });

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    if (user.isVerified) {
      throw new ValidationError("Phone already verified");
    }

    return await otpService.sendOtp(user.phone, "PHONE_VERIFICATION", userId);
  }


  // Helper methods
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  maskEmail(email) {
    if (!email) return "***";
    const [local, domain] = email.split("@");
    if (!domain) return "***";
    const maskedLocal = local.slice(0, 2) + "***" + local.slice(-1);
    return `${maskedLocal}@${domain}`;
  }
}

const phoneAuthService = new PhoneAuthService();
export default phoneAuthService;
