// src/utils/smsProviders/ourSmsProvider.js
import axios from "axios";
import logger from "../logger.js";

/**
 * OurSMS Provider
 * Integration with OurSMS.com API
 */
export class OurSmsProvider {
  constructor() {
    this.apiUrl = "https://api.oursms.com";
    this.apiToken = process.env.OURSMS_API_TOKEN;
    this.senderId = process.env.OURSMS_SENDER_ID || "oursms";

    if (!this.apiToken) {
      logger.warn("OURSMS_API_TOKEN not configured");
    }
  }

  /**
   * Send SMS via OurSMS
   */
  async sendSMS(phone, message, options = {}) {
    try {
      if (!this.apiToken) {
        throw new Error("OurSMS API token not configured");
      }

      // Ensure phone is in international format
      const formattedPhone = this.formatPhone(phone);

      const requestBody = {
        src: options.senderId || this.senderId,
        dests: [formattedPhone],
        body: message,
        priority: options.priority || 0,
        delay: options.delay || 0,
        validity: options.validity || 0,
        maxParts: options.maxParts || 0,
        dlr: options.dlr || 1, // Request delivery report
        prevDups: options.prevDups || 5, // Prevent duplicates within 5 minutes
        msgClass: options.msgClass || "transactional", // transactional or promotional
      };

      logger.info("Sending SMS via OurSMS", {
        phone: this.maskPhone(formattedPhone),
        msgClass: requestBody.msgClass,
      });

      const response = await axios.post(
        `${this.apiUrl}/msgs/sms`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000, // 10 seconds timeout
        }
      );

      if (response.status === 200) {
        logger.info("SMS sent successfully via OurSMS", {
          phone: this.maskPhone(formattedPhone),
          messageId: response.data?.msgId,
        });

        return {
          success: true,
          messageId: response.data?.msgId,
          provider: "oursms",
          data: response.data,
        };
      }

      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      logger.error("OurSMS send failed", {
        phone: this.maskPhone(phone),
        error: error.message,
        response: error.response?.data,
      });

      throw new Error(
        `OurSMS failed: ${error.response?.data?.error || error.message}`
      );
    }
  }

  /**
   * Get delivery reports
   */
  async getDeliveryReports(count = 100) {
    try {
      if (!this.apiToken) {
        throw new Error("OurSMS API token not configured");
      }

      const response = await axios.get(`${this.apiUrl}/inbox/dlrs`, {
        params: { count: Math.min(count, 500) },
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
        timeout: 10000,
      });

      if (response.status === 200) {
        logger.info("Delivery reports retrieved", {
          count: response.data?.length || 0,
        });

        return response.data || [];
      }

      return [];
    } catch (error) {
      logger.error("Failed to get delivery reports", {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get account credits balance
   */
  async getBalance() {
    try {
      if (!this.apiToken) {
        throw new Error("OurSMS API token not configured");
      }

      const response = await axios.get(`${this.apiUrl}/billing/credits`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
        timeout: 5000,
      });

      if (response.status === 200) {
        const balance = response.data?.credits || 0;

        logger.info("OurSMS balance retrieved", {
          balance,
        });

        // Alert if balance is low
        if (balance < 100) {
          logger.warn("OurSMS balance is low", { balance });
        }

        return balance;
      }

      return null;
    } catch (error) {
      logger.error("Failed to get OurSMS balance", {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Format phone number to international format
   */
  formatPhone(phone) {
    // Remove spaces and dashes
    phone = phone.replace(/[\s-]/g, "");

    // Convert to international format
    if (phone.startsWith("05")) {
      return "966" + phone.substring(1);
    } else if (phone.startsWith("5")) {
      return "966" + phone;
    } else if (phone.startsWith("+966")) {
      return phone.substring(1);
    } else if (phone.startsWith("966")) {
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
   * Send bulk SMS (up to 500 recipients)
   */
  async sendBulkSMS(phones, message, options = {}) {
    try {
      if (!this.apiToken) {
        throw new Error("OurSMS API token not configured");
      }

      if (phones.length > 500) {
        throw new Error("Maximum 500 recipients per request");
      }

      const formattedPhones = phones.map((phone) => this.formatPhone(phone));

      const requestBody = {
        src: options.senderId || this.senderId,
        dests: formattedPhones,
        body: message,
        priority: options.priority || 0,
        delay: options.delay || 0,
        validity: options.validity || 0,
        maxParts: options.maxParts || 0,
        dlr: options.dlr || 1,
        prevDups: options.prevDups || 5,
        msgClass: options.msgClass || "promotional",
      };

      const response = await axios.post(
        `${this.apiUrl}/msgs/sms`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 seconds for bulk
        }
      );

      if (response.status === 200) {
        logger.info("Bulk SMS sent successfully", {
          recipientCount: phones.length,
          messageId: response.data?.msgId,
        });

        return {
          success: true,
          messageId: response.data?.msgId,
          recipientCount: phones.length,
          data: response.data,
        };
      }

      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      logger.error("Bulk SMS failed", {
        recipientCount: phones.length,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Health check - verify API connectivity and balance
   */
  async healthCheck() {
    try {
      const balance = await this.getBalance();

      return {
        status: "healthy",
        provider: "oursms",
        balance: balance,
        configured: !!this.apiToken,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        provider: "oursms",
        error: error.message,
        configured: !!this.apiToken,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default OurSmsProvider;
