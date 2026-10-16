// src/routes/admin.routes.ts
import { Router } from 'express';
import { body } from 'express-validator';
import { AdminController } from '../controllers/admin.controller';
import { verifyUserToken, requireRole } from '../services/auth.service';

const router = Router();
const adminController = new AdminController();

// All admin routes require authentication and ADMIN role
router.use(verifyUserToken);
router.use(requireRole('ADMIN'));

// ==================== ADMIN USER MANAGEMENT ====================

// Create a new admin (only existing admins can do this)
router.post(
  '/create-admin',
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
  ],
  adminController.createAdmin
);

// Get all users (with optional role filter)
router.get('/users', adminController.getAllUsers);

// Get user by ID
router.get('/users/:userId', adminController.getUserById);

// Update user status (activate/deactivate)
router.patch(
  '/users/:userId/status',
  [
    body('status').isIn(['active', 'deactivated']).withMessage('Invalid status'),
  ],
  adminController.updateUserStatus
);

// Generate secret code for employee registration
router.post(
  '/generate-code',
  [
    body('expiresInHours').optional().isInt({ min: 1, max: 168 }).withMessage('Expires in hours must be between 1 and 168'),
    body('employeeEmail').isEmail().withMessage('Valid employee email is required'),
  ],
  adminController.generateSecretCode
);

// Get all pending employees
router.get('/pending-employees', adminController.getPendingEmployees);

// Approve or reject employee
router.post(
  '/approve-employee',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('approve').isBoolean().withMessage('Approve must be a boolean'),
    body('reason').optional().isString(),
  ],
  adminController.approveEmployee
);

// Add to admin.routes.ts (inside the router after auth middleware)

// Secret code management
router.get('/secret-codes', adminController.getSecretCodes);
router.delete('/secret-codes/:codeId', adminController.deleteSecretCode);

// Employee management
router.get('/active-employees', adminController.getActiveEmployees);

// Get audit logs
router.get('/audit-logs', adminController.getAuditLogs);

export default router;