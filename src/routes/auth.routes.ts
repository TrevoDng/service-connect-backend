// src/routes/auth.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  verifyEmail,
  validateSecretCode,
  getMe,
  updateProfile,
  resendVerification
} from '../controllers/auth.controller';
import { verifyUserToken, requireRole } from '../services/auth.service';

const router = Router();

// ==================== PUBLIC ROUTES ====================

// Unified Registration - Handles both customers and employees
router.post(
  '/register',
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
    body('secretCode').optional().isString(),
    body('phone').optional().isString(),
    body('rememberMe').optional().isBoolean(),
  ],
  register
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

// Email Verification
router.get('/verify-email', verifyEmail);

// Validate Secret Code (for employee registration)
router.post(
  '/employee/validate-registration-code',
  [
    body('secretCode').notEmpty().withMessage('Secret code is required'),
  ],
  validateSecretCode
);

// ==================== PROTECTED ROUTES (require authentication) ====================

// Get current user profile (any authenticated user)
router.get('/me', verifyUserToken, getMe);

// Example: Admin-only route
router.get(
  '/admin-only',
  verifyUserToken,
  requireRole('ADMIN'),
  (req, res) => {
    res.success({ message: 'Welcome admin!' }, 'Admin access granted');
  }
);

// Example: Employee or Admin route
router.get(
  '/employee-dashboard',
  verifyUserToken,
  requireRole('EMPLOYEE', 'ADMIN'),
  (req: Request, res: Response) => {
    const user = (req as any).user; // Type assertion
    res.success({ 
      message: 'Welcome employee!',
      user: {
        id: user?.id,
        name: `${user?.firstName} ${user?.lastName}`,
        role: user?.role
      }
    }, 'Employee access granted');
  }
);

// Resend Verification Email
router.post(
  '/resend-verification',
  [
    body('email').isEmail().withMessage('Valid email is required'),
  ],
  resendVerification
);

// Example: Customer-only route
router.get(
  '/customer-dashboard',
  verifyUserToken,
  requireRole('CLIENT'),
  (req: Request, res: Response) => {
    const user = (req as any).user; // Type assertion
    res.success({ 
      message: 'Welcome customer!',
      user: {
        id: user?.id,
        name: `${user?.firstName} ${user?.lastName}`
      }
    }, 'Customer access granted');
  }
);

// Test route to verify middleware (remove in production)
router.post('/test', (req, res) => {
  res.success({ test: true }, "Auth routes are working!");
});


// In auth.routes.ts - add this route
router.put('/update-profile', verifyUserToken, updateProfile);

export default router;