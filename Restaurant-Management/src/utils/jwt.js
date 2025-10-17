import jwt from "jsonwebtoken";
import redisClient from "./redis.js";
import logger from "./logger.js";

/**
 * JWT Utility Class
 * Handles token generation, verification, and management
 */
class JWTManager {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
    this.issuer = process.env.JWT_ISSUER || "restaurant-management";
    this.audience = process.env.JWT_AUDIENCE || "restaurant-users";
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload) {
    const tokenPayload = {
      ...payload,
      type: "access",
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(tokenPayload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload) {
    const tokenPayload = {
      ...payload,
      type: "refresh",
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(tokenPayload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.expiresIn,
      tokenType: "Bearer",
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch (error) {
      logger.debug("Access token verification failed", {
        error: error.message,
        token: token.substring(0, 20) + "...",
      });
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshSecret, {
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch (error) {
      logger.debug("Refresh token verification failed", {
        error: error.message,
        token: token.substring(0, 20) + "...",
      });
      throw error;
    }
  }

  /**
   * Blacklist token
   */
  async blacklistToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redisClient.set(`blacklist:${token}`, "1", ttl);
          logger.info("Token blacklisted", {
            userId: decoded.id,
            exp: new Date(decoded.exp * 1000),
          });
        }
      }
    } catch (error) {
      logger.error("Failed to blacklist token", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token) {
    try {
      const result = await redisClient.get(`blacklist:${token}`);
      return result !== null;
    } catch (error) {
      logger.error("Failed to check token blacklist status", {
        error: error.message,
      });
      return false; // Fail open for availability
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);

      if (decoded.type !== "refresh") {
        throw new Error("Invalid token type");
      }

      // Check if refresh token is blacklisted
      if (await this.isTokenBlacklisted(refreshToken)) {
        throw new Error("Token has been revoked");
      }

      // Generate new access token
      const newPayload = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };

      return this.generateAccessToken(newPayload);
    } catch (error) {
      logger.warn("Failed to refresh access token", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Decode token without verification
   */
  decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token) {
    const decoded = this.decodeToken(token);
    return decoded?.exp ? new Date(decoded.exp * 1000) : null;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    const exp = this.getTokenExpiration(token);
    return exp ? exp < new Date() : true;
  }
}

const jwtManager = new JWTManager();
export default jwtManager;





