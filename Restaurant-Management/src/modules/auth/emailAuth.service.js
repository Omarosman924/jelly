// src/modules/auth/emailAuth.service.js
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
import emailOtpService from "../../utils/emailOtpService.js";

class EmailAuthService extends BaseService {
  constructor() {
    super();
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  }

  /**
   * Step 1: Request registration OTP via Email
   */
  async requestRegistrationOtp(email, requestInfo = {}) {
    try {
      // Validate email
      if (!this.isValidEmail(email)) {
        throw new ValidationError("Invalid email address");
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if email already exists
      const existingUser = await this.db.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ValidationError("Email already registered");
      }

      // Send OTP via email
      const result = await emailOtpService.sendOtp(
        normalizedEmail,
        "REGISTRATION",
        null,
        {
          ipAddress: requestInfo.ipAddress,
          userAgent: requestInfo.userAgent,
        }
      );

      logger.info("Registration OTP sent via email", {
        email: this.maskEmail(normalizedEmail),
      });

      return result;
    } catch (error) {
      logger.error("Email registration OTP request failed", {
        email: this.maskEmail(email),
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
        email,
        otp,
        firstName,
        lastName,
        role = "END_USER",
        phone,
      } = userData;

      const normalizedEmail = email.toLowerCase().trim();

      // Verify OTP
      await emailOtpService.verifyOtpCode(normalizedEmail, otp, "REGISTRATION");

      // Check email again (race condition protection)
      const existingUser = await this.db.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ValidationError("Email already registered");
      }

      // Create user in transaction
      const user = await this.executeTransaction(async (prisma) => {
        const newUser = await prisma.user.create({
          data: {
            email: normalizedEmail,
            phone: phone || null,
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
        email: normalizedEmail,
        role: user.role,
        method: "EMAIL_OTP",
      });

      authLogger.info("User registered successfully via Email OTP", {
        userId: user.id,
        email: this.maskEmail(normalizedEmail),
        role: user.role,
      });

      return { user };
    } catch (error) {
      logger.error("Email OTP registration failed", {
        email: this.maskEmail(userData.email),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Step 1: Request login OTP via Email
   */
  async requestLoginOtp(email, requestInfo = {}) {
    try {
      if (!this.isValidEmail(email)) {
        throw new ValidationError("Invalid email address");
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if user exists
      const user = await this.db.user.findUnique({
        where: { email: normalizedEmail, isActive: true },
        select: { id: true, email: true, firstName: true },
      });

      // Don't reveal if user exists (security)
      if (!user) {
        logger.info("Login OTP requested for non-existent email", {
          email: this.maskEmail(normalizedEmail),
        });

        return {
          success: true,
          message: "If email exists, OTP has been sent",
        };
      }

      // Send OTP via email
      const result = await emailOtpService.sendOtp(
        normalizedEmail,
        "LOGIN",
        user.id,
        {
          ipAddress: requestInfo.ipAddress,
          userAgent: requestInfo.userAgent,
        }
      );

      logger.info("Login OTP sent via email", {
        userId: user.id,
        email: this.maskEmail(normalizedEmail),
      });

      return result;
    } catch (error) {
      logger.error("Email login OTP request failed", {
        email: this.maskEmail(email),
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
      const { email, otp } = credentials;
      const { ipAddress, userAgent, deviceInfo } = loginInfo;

      const normalizedEmail = email.toLowerCase().trim();

      // Verify OTP
      await emailOtpService.verifyOtpCode(normalizedEmail, otp, "LOGIN");

      // Get user with related data
      const user = await this.db.user.findUnique({
        where: { email: normalizedEmail, isActive: true },
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

      // Generate tokens
      const tokenPayload = {
        id: user.id,
        email: user.email,
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
        email: normalizedEmail,
        ipAddress,
        userAgent,
        deviceId: tokens.deviceId,
        method: "EMAIL_OTP",
      });

      authLogger.info("User logged in successfully via Email OTP", {
        userId: user.id,
        email: this.maskEmail(normalizedEmail),
        role: user.role,
        deviceId: tokens.deviceId,
      });

      return {
        user,
        tokens,
      };
    } catch (error) {
      logger.error("Email OTP login failed", {
        email: this.maskEmail(credentials.email),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Password-based registration with email
   */
  async registerWithPassword(userData) {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        role = "END_USER",
        phone,
      } = userData;

      const normalizedEmail = email.toLowerCase().trim();

      if (!this.isValidEmail(normalizedEmail)) {
        throw new ValidationError("Invalid email address");
      }

      // Check if email exists
      const existingUser = await this.db.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ValidationError("Email already registered");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      // Create user
      const user = await this.executeTransaction(async (prisma) => {
        const newUser = await prisma.user.create({
          data: {
            email: normalizedEmail,
            phone: phone || null,
            passwordHash,
            firstName,
            lastName,
            role,
            isActive: true,
            isVerified: false, // Need to verify email
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

        // Create profile
        if (userProfileManager.isEndUser(role)) {
          await userProfileManager.createCustomerProfile(newUser.id, prisma);
        } else if (userProfileManager.isStaff(role)) {
          await userProfileManager.createStaffProfile(newUser.id, role, prisma);
        }

        return newUser;
      });

      // Send verification OTP
      await emailOtpService.sendOtp(
        normalizedEmail,
        "EMAIL_VERIFICATION",
        user.id
      );

      await auditLogger.logAuthEvent("REGISTRATION", user.id, {
        email: normalizedEmail,
        role: user.role,
        method: "EMAIL_PASSWORD",
      });

      return {
        user,
        message: "Registration successful. Please verify your email.",
      };
    } catch (error) {
      logger.error("Email password registration failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Password-based login with email
   */
  async loginWithPassword(credentials, loginInfo = {}) {
    try {
      const { email, password } = credentials;
      const { ipAddress, userAgent, deviceInfo } = loginInfo;

      const normalizedEmail = email.toLowerCase().trim();

      const user = await this.db.user.findUnique({
        where: { email: normalizedEmail, isActive: true },
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
          email: normalizedEmail,
          ipAddress,
          reason: "INVALID_PASSWORD",
        });
        throw new AuthenticationError("Invalid credentials");
      }

      // Generate tokens
      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const tokens = await tokenManager.generateTokenPair(tokenPayload, {
        ipAddress,
        userAgent,
        deviceName: deviceInfo?.deviceName || "Unknown Device",
        ...deviceInfo,
      });

      await this.db.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
      });

      await auditLogger.logAuthEvent("LOGIN_SUCCESS", user.id, {
        email: normalizedEmail,
        ipAddress,
        userAgent,
        deviceId: tokens.deviceId,
        method: "EMAIL_PASSWORD",
      });

      return {
        user,
        tokens,
      };
    } catch (error) {
      logger.error("Email password login failed", { error: error.message });
      throw error;
    }
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

const emailAuthService = new EmailAuthService();
export default emailAuthService;
