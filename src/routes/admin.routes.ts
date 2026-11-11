// src/routes/admin.routes.ts
import { Router } from 'express';
import { body } from 'express-validator';
import { AdminController } from '../controllers/admin.controller';
import { verifyUserToken, requireRole } from '../services/auth.service';
import { getAllBookings, getUserBookings } from '../controllers/bookings.controller';
import { getAllThreadsForStaff, getThreadMessagesForStaff } from '../controllers/chat.controller';
import { claimTicket, closeTicket, getStaffTicketMessages, getStaffTickets, markStaffTicketRead, postStaffMessage, releaseTicket, reopenTicket } from '../controllers/support.controller';

const router = Router();
const adminController = new AdminController();

// All admin routes require authentication
router.use(verifyUserToken);

// Role checks are applied per-route:
//   - ADMIN-only: create-admin, status updates, secret codes, audit logs, approvals
//   - ADMIN or EMPLOYEE: read-only user listings (used by staff dashboards)

// ==================== ADMIN USER MANAGEMENT ====================

// Create a new admin (ADMIN only)
router.post(
  '/create-admin',
  requireRole('ADMIN'),
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

// Get all users (with optional role filter) — ADMIN + EMPLOYEE (read-only)
router.get(
  '/users',
  requireRole('ADMIN', 'EMPLOYEE'),
  adminController.getAllUsers
);

// Get all bookings (staff) — ADMIN + EMPLOYEE, read-only
router.get(
  '/bookings',
  requireRole('ADMIN', 'EMPLOYEE'),
  getAllBookings
);

// Get user by ID — ADMIN + EMPLOYEE (read-only, ready for drill-down)
router.get(
  '/users/:userId',
  requireRole('ADMIN', 'EMPLOYEE'),
  adminController.getUserById
);

// Get a specific user's bookings — ADMIN + EMPLOYEE, read-only
router.get(
  '/users/:userId/bookings',
  requireRole('ADMIN', 'EMPLOYEE'),
  getUserBookings
);

// Chat observer — ADMIN + EMPLOYEE, read-only
router.get(
  '/chat/threads',
  requireRole('ADMIN', 'EMPLOYEE'),
  getAllThreadsForStaff
);

router.get(
  '/chat/threads/:id/messages',
  requireRole('ADMIN', 'EMPLOYEE'),
  getThreadMessagesForStaff
);

// ==================== SUPPORT TICKETS (STAFF) ====================

router.get(
  '/support/tickets',
  requireRole('ADMIN', 'EMPLOYEE'),
  getStaffTickets
);

router.get(
  '/support/tickets/:id/messages',
  requireRole('ADMIN', 'EMPLOYEE'),
  getStaffTicketMessages
);

router.post(
  '/support/tickets/:id/claim',
  requireRole('ADMIN', 'EMPLOYEE'),
  claimTicket
);

router.post(
  '/support/tickets/:id/release',
  requireRole('ADMIN', 'EMPLOYEE'),
  releaseTicket
);

router.post(
  '/support/tickets/:id/messages',
  requireRole('ADMIN', 'EMPLOYEE'),
  postStaffMessage
);

router.post(
  '/support/tickets/:id/close',
  requireRole('ADMIN', 'EMPLOYEE'),
  closeTicket
);

router.post(
  '/support/tickets/:id/reopen',
  requireRole('ADMIN', 'EMPLOYEE'),
  reopenTicket
);

router.post(
  '/support/tickets/:id/read',
  requireRole('ADMIN', 'EMPLOYEE'),
  markStaffTicketRead
);

// Update user status (activate/deactivate) — ADMIN only
router.patch(
  '/users/:userId/status',
  requireRole('ADMIN'),
  [
    body('status').isIn(['active', 'deactivated']).withMessage('Invalid status'),
  ],
  adminController.updateUserStatus
);

// Request registration secret security code management — ADMIN only
router.get('/registration-requests', 
  requireRole('ADMIN'), 
  adminController.getRegistrationRequests);

router.post(
  '/registration-requests/:id/resend',
  requireRole('ADMIN'),
  adminController.resendRegistrationInvite
);  

router.post('/registration-requests/:id/approve', 
  requireRole('ADMIN'), 
  adminController.approveRegistrationRequest);

router.patch('/registration-requests/:id/decline', 
  requireRole('ADMIN'), 
  adminController.declineRegistrationRequest);

// Generate secret code for employee registration — ADMIN only
router.post(
  '/generate-code',
  requireRole('ADMIN'),
  [
    body('expiresInHours').optional().isInt({ min: 1, max: 168 }).withMessage('Expires in hours must be between 1 and 168'),
    body('employeeEmail').isEmail().withMessage('Valid employee email is required'),
  ],
  adminController.generateSecretCode
);

// Get all pending employees — ADMIN only
router.get(
  '/pending-employees',
  requireRole('ADMIN'),
  adminController.getPendingEmployees
);

// Approve or reject employee — ADMIN only
router.post(
  '/approve-employee',
  requireRole('ADMIN'),
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('approve').isBoolean().withMessage('Approve must be a boolean'),
    body('reason').optional().isString(),
  ],
  adminController.approveEmployee
);

// Secret code management — ADMIN only
router.get('/secret-codes', requireRole('ADMIN'), adminController.getSecretCodes);
router.delete('/secret-codes/:codeId', requireRole('ADMIN'), adminController.deleteSecretCode);

// Employee management — ADMIN only
router.get('/active-employees', requireRole('ADMIN'), adminController.getActiveEmployees);

// Get audit logs — ADMIN only
router.get('/audit-logs', requireRole('ADMIN'), adminController.getAuditLogs);

export default router;