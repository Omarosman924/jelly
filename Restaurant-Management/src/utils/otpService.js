// src/utils/otpService.js
import crypto from "crypto";
import bcrypt from "bcryptjs";
import BaseService from "./baseService.js";
import logger from "./logger.js";
import redisClient from "./redis.js";
import { AppError, ValidationError } from "../middleware/errorHandler.js";

/**
 * OTP Service - SMS-based authentication
 */
class OtpService extends BaseService {
  constructor() {
    super();
    this.otpLength = 6;
    this.otpExpiry = 5 * 60; // 5 minutes
    this.maxAttempts = 3;
    this.resendDelay = 60; // 1 minute between resends
  }

  /**
   * Generate OTP code
   */
  generateOtp() {
    // Generate 6-digit random code
    const otp = crypto.randomInt(100000, 999999).toString();
    return otp;
  }

  /**
   * Hash OTP before storing
   */
  async hashOtp(otp) {
    return await bcrypt.hash(otp, 10);
  }

  /**
   * Verify OTP hash
   */
  async verifyOtp(otp, hash) {
    return await bcrypt.compare(otp, hash);
  }

  /**
   * Send OTP via SMS
   */
  async sendOtp(phone, purpose, userId = null, metadata = {}) {
    try {
      // Validate phone number
      if (!this.isValidSaudiPhone(phone)) {
        throw new ValidationError("Invalid Saudi phone number");
      }

      // Check if phone is blocked
      await this.checkPhoneBlocked(phone);

      // Check rate limiting
      await this.checkRateLimit(phone);

      // Generate OTP
      const otp = this.generateOtp();
      const hashedOtp = await this.hashOtp(otp);

      // Calculate expiry
      const expiresAt = new Date(Date.now() + this.otpExpiry * 1000);

      // Store in database
      const otpRecord = await this.db.otpVerification.create({
        data: {
          userId,
          phone,
          otp: hashedOtp,
          purpose,
          expiresAt,
          attempts: 0,
          maxAttempts: this.maxAttempts,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });

      // Send SMS
      await this.sendSMS(phone, otp, purpose);

      // Set rate limit
      await this.setRateLimit(phone);

      logger.info("OTP sent successfully", {
        phone: this.maskPhone(phone),
        purpose,
        otpId: otpRecord.id,
      });

      return {
        success: true,
        otpId: otpRecord.id,
        expiresAt,
        message: "OTP sent to your phone",
      };
    } catch (error) {
      logger.error("Failed to send OTP", {
        phone: this.maskPhone(phone),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtpCode(phone, otp, purpose) {
    try {
      // Get latest OTP for this phone and purpose
      const otpRecord = await this.db.otpVerification.findFirst({
        where: {
          phone,
          purpose,
          isUsed: false,
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!otpRecord) {
        throw new ValidationError("Invalid or expired OTP");
      }

      // Check attempts
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        await this.db.otpVerification.update({
          where: { id: otpRecord.id },
          data: { isUsed: true },
        });
        throw new ValidationError("Maximum verification attempts exceeded");
      }

      // Verify OTP
      const isValid = await this.verifyOtp(otp, otpRecord.otp);

      if (!isValid) {
        // Increment attempts
        await this.db.otpVerification.update({
          where: { id: otpRecord.id },
          data: { attempts: { increment: 1 } },
        });

        const remainingAttempts =
          otpRecord.maxAttempts - otpRecord.attempts - 1;
        throw new ValidationError(
          `Invalid OTP. ${remainingAttempts} attempts remaining`
        );
      }

      // Mark as used
      await this.db.otpVerification.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      });

      logger.info("OTP verified successfully", {
        phone: this.maskPhone(phone),
        purpose,
        otpId: otpRecord.id,
      });

      return {
        success: true,
        userId: otpRecord.userId,
        message: "OTP verified successfully",
      };
    } catch (error) {
      logger.error("OTP verification failed", {
        phone: this.maskPhone(phone),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send SMS (integrate with SMS provider)
   */
  async sendSMS(phone, otp, purpose) {
    try {
      const messages = {
        REGISTRATION: `مرحباً! رمز التحقق للتسجيل هو: ${otp}. صالح لمدة 5 دقائق`,
        LOGIN: `رمز تسجيل الدخول: ${otp}. صالح لمدة 5 دقائق`,
        PASSWORD_RESET: `رمز إعادة تعيين كلمة المرور: ${otp}. صالح لمدة 5 دقائق`,
        PHONE_VERIFICATION: `رمز التحقق من رقم الهاتف: ${otp}`,
        TWO_FACTOR_AUTH: `رمز المصادقة الثنائية: ${otp}`,
      };

      const message = messages[purpose] || `رمز التحقق: ${otp}`;

      // Development/Mock mode - log to console
      if (
        process.env.NODE_ENV === "development" ||
        process.env.SMS_MOCK_MODE === "true" ||
        !process.env.OURSMS_API_TOKEN
      ) {
        console.log("\n" + "=".repeat(60));
        console.log("📱 SMS NOTIFICATION (DEVELOPMENT MODE)");
        console.log("=".repeat(60));
        console.log(`📞 To: ${phone}`);
        console.log(`🔐 OTP: ${otp}`);
        console.log(`💬 Message: ${message}`);
        console.log(`🎯 Purpose: ${purpose}`);
        console.log("=".repeat(60) + "\n");

        logger.info("SMS sent (DEV MODE)", {
          phone: this.maskPhone(phone),
          otp,
          purpose,
        });

        return true;
      }

      // Production - use OurSMS API directly
      const axios = (await import("axios")).default;

      const response = await axios.post(
        "https://api.oursms.com/msgs/sms",
        {
          src: process.env.OURSMS_SENDER_ID || "oursms",
          dests: [phone],
          body: message,
          msgClass: "transactional",
          dlr: 1,
          prevDups: 5,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OURSMS_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      logger.info("SMS sent successfully via OurSMS", {
        phone: this.maskPhone(phone),
        messageId: response.data?.msgId,
      });

      return true;
    } catch (error) {
      logger.error("SMS sending failed", {
        phone: this.maskPhone(phone),
        error: error.message,
      });

      // في Development - لا تفشل العملية
      if (process.env.NODE_ENV === "development") {
        logger.warn("Continuing despite SMS failure in dev mode");
        return true;
      }

      throw new AppError("Failed to send SMS", 500);
    }
  }

  /**
   * Get SMS provider instance
   */
  // getSmsProvider() {
  //   const providerType = process.env.SMS_PROVIDER || "oursms";

  //   switch (providerType.toLowerCase()) {
  //     case "oursms":
  //       return new OurSmsProvider();

  //     // يمكنك إضافة providers أخرى لاحقاً
  //     // case "twilio":
  //     //   return new TwilioProvider();

  //     default:
  //       // في حالة development mode
  //       if (process.env.NODE_ENV === "development") {
  //         return new OurSmsProvider(); // استخدم OurSMS حتى في dev mode
  //       }
  //       throw new Error(`Unknown SMS provider: ${providerType}`);
  //   }
  // }

  /**
   * Validate Saudi phone number
   */
  isValidSaudiPhone(phone) {
    const regex = /^((\+966)|966|0)?5[0-9]{8}$/;
    return regex.test(phone);
  }

  /**
   * Normalize phone number to international format
   */
  normalizePhone(phone) {
    // Remove spaces and dashes
    phone = phone.replace(/[\s-]/g, "");

    // Convert to international format
    if (phone.startsWith("05")) {
      return "+966" + phone.substring(1);
    } else if (phone.startsWith("5")) {
      return "+966" + phone;
    } else if (phone.startsWith("966")) {
      return "+" + phone;
    } else if (phone.startsWith("+966")) {
      return phone;
    }

    return phone;
  }

  /**
   * Mask phone number for logging
   */
  maskPhone(phone) {
    if (!phone || phone.length < 4) return "****";
    return phone.substring(0, 4) + "****" + phone.substring(phone.length - 2);
  }

  /**
   * Check if phone is blocked
   */
  async checkPhoneBlocked(phone) {
    const blocked = await this.db.blockedPhone.findUnique({
      where: { phone },
    });

    if (blocked) {
      if (blocked.expiresAt && blocked.expiresAt < new Date()) {
        // Block expired, remove it
        await this.db.blockedPhone.delete({
          where: { phone },
        });
        return;
      }

      throw new AppError("Phone number is blocked", 403);
    }
  }

  /**
   * Check rate limiting
   */
  async checkRateLimit(phone) {
    const key = `otp_rate_limit:${phone}`;
    const lastSent = await redisClient.get(key);

    if (lastSent) {
      const elapsed = Date.now() - parseInt(lastSent);
      const remaining = Math.ceil((this.resendDelay * 1000 - elapsed) / 1000);

      if (remaining > 0) {
        throw new AppError(
          `Please wait ${remaining} seconds before requesting another OTP`,
          429
        );
      }
    }
  }

  /**
   * Set rate limit
   */
  async setRateLimit(phone) {
    const key = `otp_rate_limit:${phone}`;
    await redisClient.set(key, Date.now().toString(), this.resendDelay);
  }

  /**
   * Block phone number
   */
  async blockPhone(phone, reason, blockedBy, expiresAt = null) {
    await this.db.blockedPhone.create({
      data: {
        phone,
        reason,
        blockedBy,
        expiresAt,
      },
    });

    logger.warn("Phone blocked", {
      phone: this.maskPhone(phone),
      reason,
      blockedBy,
    });
  }

  /**
   * Cleanup expired OTPs
   */
  async cleanupExpiredOtps() {
    const deleted = await this.db.otpVerification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        isUsed: true,
      },
    });

    logger.info("Expired OTPs cleaned up", { count: deleted.count });
    return deleted.count;
  }

  /**
   * Get OTP statistics
   */
  async getOtpStats(dateFrom, dateTo) {
    const stats = await this.db.otpVerification.groupBy({
      by: ["purpose"],
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      _count: { _all: true },
      _avg: { attempts: true },
    });

    return stats;
  }
}

export const otpService = new OtpService();
export default otpService;
