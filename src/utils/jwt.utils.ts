// src/utils/jwt.utils.ts
import jwt, { SignOptions } from 'jsonwebtoken';
import jwtConfig from '../config/jwt.config';

/**
 * Generate a new JWT token
 * @param {Object} payload - Data to encode in token
 * @returns {string} JWT token
 */
export const generateToken = (payload: object): string => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn
  } as SignOptions);
};

/**
 * Generate refresh token
 * @param {Object} payload - Data to encode in token
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.refreshExpiresIn
  } as SignOptions);
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyJwtToken = (token: string): any => {
  try {
    return jwt.verify(token, jwtConfig.secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Decode a JWT token without verification
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
export const decodeToken = (token: string): any => {
  return jwt.decode(token);
};