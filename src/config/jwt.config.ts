// src/config/jwt.config.ts
import dotenv from 'dotenv';
dotenv.config();

export default {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
  expiresIn: '7d' as string | number, // Token expiration time (7 days)
  refreshExpiresIn: '30d' as string | number // Refresh token expiration
};