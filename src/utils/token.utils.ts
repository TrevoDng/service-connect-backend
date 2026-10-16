// src/utils/token.utils.ts
import crypto from 'crypto';

/**
 * Generate a random verification token for email verification
 * @returns {string} Random token string
 */
export const generateVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a random secret code for employee invitations
 * @returns {string} Random secret code
 */
export const generateSecretCode = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Generate a numeric OTP code
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} Numeric OTP
 */
export const generateOTP = (length: number = 6): string => {
  return crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
};

/**
 * Calculate token expiry date
 * @param {number} hours - Hours until expiry (default: 24)
 * @returns {Date} Expiry date
 */
export const getTokenExpiry = (hours: number = 24): Date => {
  const expires = new Date();
  expires.setHours(expires.getHours() + hours);
  return expires;
};