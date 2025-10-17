// src/utils/emailOtpService.js
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import BaseService from "./baseService.js";
import logger from "./logger.js";
import redisClient from "./redis.js";
import { AppError, ValidationError } from "../middleware/errorHandler.js";

/**
 * Email OTP Service
 */
class EmailOtpService extends BaseService {
  constructor() {
    super();
    this.otpLength = 6;
    this.otpExpiry = 10 * 60; // 10 minutes
    this.maxAttempts = 3;
    this.resendDelay = 60; // 1 minute

    // Configure email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Generate OTP code
   */
  generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Hash OTP
   */
  async hashOtp(otp) {
    return await bcrypt.hash(otp, 10);
  }

  /**
   * Verify OTP
   */
  async verifyOtp(otp, hash) {
    return await bcrypt.compare(otp, hash);
  }

  /**
   * Send OTP via Email
   */
  async sendOtp(email, purpose, userId = null, metadata = {}) {
    try {
      // Validate email
      if (!this.isValidEmail(email)) {
        throw new ValidationError("Invalid email address");
      }

      // Check rate limiting
      await this.checkRateLimit(email);

      // Generate OTP
      const otp = this.generateOtp();
      const hashedOtp = await this.hashOtp(otp);

      // Calculate expiry
      const expiresAt = new Date(Date.now() + this.otpExpiry * 1000);

      // Store in database
      const otpRecord = await this.db.otpVerification.create({
        data: {
          userId,
          phone: email, // Using phone field for email temporarily
          otp: hashedOtp,
          purpose,
          expiresAt,
          attempts: 0,
          maxAttempts: this.maxAttempts,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });

      // Send email
      await this.sendEmail(email, otp, purpose);

      // Set rate limit
      await this.setRateLimit(email);

      logger.info("Email OTP sent successfully", {
        email: this.maskEmail(email),
        purpose,
        otpId: otpRecord.id,
      });

      return {
        success: true,
        otpId: otpRecord.id,
        expiresAt,
        message: "OTP sent to your email",
      };
    } catch (error) {
      logger.error("Failed to send email OTP", {
        email: this.maskEmail(email),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtpCode(email, otp, purpose) {
    try {
      // Get latest OTP
      const otpRecord = await this.db.otpVerification.findFirst({
        where: {
          phone: email, // Using phone field for email
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

      logger.info("Email OTP verified successfully", {
        email: this.maskEmail(email),
        purpose,
        otpId: otpRecord.id,
      });

      return {
        success: true,
        userId: otpRecord.userId,
        message: "OTP verified successfully",
      };
    } catch (error) {
      logger.error("Email OTP verification failed", {
        email: this.maskEmail(email),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send email
   */
  async sendEmail(email, otp, purpose) {
    try {
      const subjects = {
        REGISTRATION: "Welcome! Verify Your Email",
        LOGIN: "Login Verification Code",
        PASSWORD_RESET: "Password Reset Code",
        PHONE_VERIFICATION: "Email Verification Code",
        TWO_FACTOR_AUTH: "Two-Factor Authentication Code",
      };

      const htmlTemplates = {
        REGISTRATION: this.getRegistrationTemplate(otp),
        LOGIN: this.getLoginTemplate(otp),
        PASSWORD_RESET: this.getPasswordResetTemplate(otp),
        PHONE_VERIFICATION: this.getVerificationTemplate(otp),
        TWO_FACTOR_AUTH: this.get2FATemplate(otp),
      };

      const subject = subjects[purpose] || "Verification Code";
      const html = htmlTemplates[purpose] || this.getDefaultTemplate(otp);

      // Development mode - log to console
      if (
        process.env.NODE_ENV === "development" ||
        !process.env.SMTP_USER ||
        !process.env.SMTP_PASS
      ) {
        console.log("\n" + "=".repeat(60));
        console.log("📧 EMAIL NOTIFICATION (DEVELOPMENT MODE)");
        console.log("=".repeat(60));
        console.log(`📬 To: ${email}`);
        console.log(`🔐 OTP: ${otp}`);
        console.log(`📝 Subject: ${subject}`);
        console.log(`🎯 Purpose: ${purpose}`);
        console.log("=".repeat(60) + "\n");

        logger.info("Email sent (DEV MODE)", {
          email: this.maskEmail(email),
          otp,
          purpose,
        });

        return true;
      }

      // Production - send actual email
      await this.transporter.sendMail({
        from: `"${process.env.APP_NAME || "Restaurant"}" <${
          process.env.SMTP_FROM || process.env.SMTP_USER
        }>`,
        to: email,
        subject,
        html,
      });

      logger.info("Email sent successfully", {
        email: this.maskEmail(email),
        purpose,
      });

      return true;
    } catch (error) {
      logger.error("Email sending failed", {
        email: this.maskEmail(email),
        error: error.message,
      });

      // في Development - لا تفشل العملية
      if (process.env.NODE_ENV === "development" || !process.env.SMTP_USER) {
        logger.warn("Continuing despite email failure in dev mode");
        console.log("\n⚠️  Email sending failed, but continuing in dev mode");
        console.log(`📧 Email: ${email}`);
        console.log(`🔐 OTP: ${otp}\n`);
        return true;
      }

      throw new AppError("Failed to send email", 500);
    }
  }

  /**
   * Email templates
   */
  getRegistrationTemplate(otp) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .otp-box { background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Welcome to ${process.env.APP_NAME || "Our Restaurant"}!</h2>
          <p>Thank you for registering. Please use the following code to verify your email:</p>
          <div class="otp-box">${otp}</div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getLoginTemplate(otp) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .otp-box { background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Login Verification</h2>
          <p>Use this code to complete your login:</p>
          <div class="otp-box">${otp}</div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't attempt to login, please secure your account immediately.</p>
        </div>
      </body>
      </html>
    `;
  }

  getPasswordResetTemplate(otp) {
    return `
      <!DOCTYPE html>
      <html>
      <body>
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Use this code:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code expires in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      </body>
      </html>
    `;
  }

  getVerificationTemplate(otp) {
    return this.getRegistrationTemplate(otp);
  }

  get2FATemplate(otp) {
    return this.getLoginTemplate(otp);
  }

  getDefaultTemplate(otp) {
    return `
      <html>
      <body>
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code expires in 10 minutes.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Helper methods
   */
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

  async checkRateLimit(email) {
    const key = `email_otp_rate_limit:${email}`;
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

  async setRateLimit(email) {
    const key = `email_otp_rate_limit:${email}`;
    await redisClient.set(key, Date.now().toString(), this.resendDelay);
  }
}

export const emailOtpService = new EmailOtpService();
export default emailOtpService;
