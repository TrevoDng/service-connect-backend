// src/middleware/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';

// ============================================
// AUTHENTICATION LIMITER
// ============================================
// Limits login and registration attempts to prevent brute-force attacks.
// 10 requests per 15 minutes per IP address.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts from this IP, please try again after 15 minutes'
    }
  }
});

// ============================================
// GENERAL API LIMITER
// ============================================
// A softer limit for general endpoints to prevent basic DOS/Spam.
// 100 requests per minute per IP.
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // <-- INCREASE THIS from 100 to 1000
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please slow down.'
    }
  }
});