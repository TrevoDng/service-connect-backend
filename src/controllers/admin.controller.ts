// src/controllers/admin.controller.ts
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import SecretCode from '../models/SecretCode';
import AuditLog from '../models/AuditLog';
import { generateSecretCode as generateCode } from '../utils/token.utils';
import logger from '../utils/logger';
import catchAsync from '../utils/catchAsync';
import { sendInviteEmail } from '../services/email.service';

export class AdminController {

  // ==================== CREATE NEW ADMIN ====================
  createAdmin = catchAsync(async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
    }

    const { firstName, lastName, email, password } = req.body;
    const adminUser = req.user; // Current admin creating new admin

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.error('Email already exists', 409, 'EMAIL_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone: '',
      role: 'ADMIN',
      status: 'active',
    });

    // Log the action
    await AuditLog.create({
      eventType: 'ADMIN_CREATED',
      severity: 'INFO',
      userId: adminUser?.id,
      email: adminUser?.email,
      details: {
        newAdminEmail: email,
        newAdminName: `${firstName} ${lastName}`,
        createdBy: adminUser?.email
      },
    });

    logger.info(`New admin created by ${adminUser?.email}: ${email}`);

    res.status(201).success({
      id: newAdmin.id,
      firstName: newAdmin.firstName,
      lastName: newAdmin.lastName,
      email: newAdmin.email,
      role: newAdmin.role
    }, 'Admin created successfully');
  });

  // ==================== GET ALL USERS ====================
  getAllUsers = catchAsync(async (req: Request, res: Response) => {
    const { role, status, limit = 100, offset = 0 } = req.query;

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;

    const users = await User.findAndCountAll({
      where,
      attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'status', 'createdAt', 'approvedAt', 'lastLogin'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.success({
      users: users.rows,
      total: users.count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    }, 'Users retrieved successfully');
  });

  // ==================== GET USER BY ID ====================
  getUserById = catchAsync(async (req: Request, res: Response) => {
    const userIdParam = req.params.userId;
    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam; // Handle array case if it occurs

    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'status', 'createdAt', 'approvedAt', 'lastLogin', 'approvedBy']
    });

    if (!user) {
      return res.error('User not found', 404, 'USER_NOT_FOUND');
    }

    res.success({ user }, 'User retrieved successfully');
  });

  // ==================== UPDATE USER STATUS ====================
  updateUserStatus = catchAsync(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
    }

    const userIdParam = req.params.userId;
    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam; // Handle array case if it occurs
    const { status } = req.body;
    const adminUser = req.user;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.error('User not found', 404, 'USER_NOT_FOUND');
    }

    // Prevent deactivating your own account
    if (user.id === adminUser?.id && status === 'deactivated') {
      return res.error('You cannot deactivate your own account', 403, 'SELF_DEACTIVATE_NOT_ALLOWED');
    }

    await user.update({ status });

    await AuditLog.create({
      eventType: 'USER_STATUS_UPDATED',
      severity: 'INFO',
      userId: adminUser?.id,
      email: adminUser?.email,
      details: {
        targetUserId: userId,
        targetUserEmail: user.email,
        oldStatus: user.status,
        newStatus: status
      },
    });

    logger.info(`User ${user.email} status updated to ${status} by ${adminUser?.email}`);

    res.success({
      id: user.id,
      email: user.email,
      status: user.status
    }, 'User status updated successfully');
  });

generateSecretCode = catchAsync(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
  }

  const { expiresInHours = 24, employeeEmail } = req.body;
  const adminUser = req.user;
  
  const frontendUrl = req.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';

  // VALIDATE: employeeEmail is required
  if (!employeeEmail || !employeeEmail.trim()) {
    return res.error('Employee email is required', 400, 'EMAIL_REQUIRED');
  }

  // VALIDATE: email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(employeeEmail)) {
    return res.error('Invalid email format', 400, 'INVALID_EMAIL');
  }

  if (!adminUser?.id) {
    return res.error('Admin user not found', 401, 'UNAUTHORIZED');
  }

  // CHECK: if there's already an unused code for this email
  const existingCode = await SecretCode.findOne({
    where: {
      assignedEmail: employeeEmail,
      isUsed: false,
      expiresAt: { [Op.gt]: new Date() }
    }
  });

  if (existingCode) {
    return res.error(
      `An active invite code already exists for ${employeeEmail}. Please use the existing code or wait for it to expire.`,
      409,
      'CODE_ALREADY_EXISTS',
      { existingCode: existingCode.code, expiresAt: existingCode.expiresAt }
    );
  }

  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  const secretCode = await SecretCode.create({
    code,
    expiresAt,
    createdBy: adminUser.id, // This is now a UUID
    assignedEmail: employeeEmail,
    isUsed: false,
  });

  await AuditLog.create({
    eventType: 'SECRET_CODE_GENERATED',
    severity: 'INFO',
    userId: adminUser?.id,
    email: adminUser?.email,
    details: { 
      expiresInHours, 
      code: secretCode.code,
      assignedEmail: employeeEmail
    },
  });

  logger.info(`Secret code generated by admin ${adminUser?.email} for employee ${employeeEmail}, expires in ${expiresInHours} hours`);

  res.success({
    code: secretCode.code,
    expiresAt: secretCode.expiresAt,
    expiresInHours,
    assignedTo: employeeEmail
  }, 'Secret code generated successfully');
  
  sendInviteEmail(employeeEmail, code, expiresAt, frontendUrl).catch(error => {
    logger.error(`Failed to send invite email to ${employeeEmail} for code ${code}: ${error.message}`);
  });
});

   

// Get all secret codes (for active invites display)
getSecretCodes = catchAsync(async (req: Request, res: Response) => {
  const { status, limit = 100, offset = 0 } = req.query;

  const where: any = {};
  const now = new Date();
  
  if (status === 'active') {
    where.expiresAt = { [Op.gt]: now };
    where.isUsed = false;
  } else if (status === 'expired') {
    where.expiresAt = { [Op.lte]: now };
  } else if (status === 'used') {
    where.isUsed = true;
  }

  const codes = await SecretCode.findAndCountAll({
    where,
    attributes: ['id', 'code', 'assignedEmail', 'expiresAt', 'isUsed', 'createdAt', 'createdBy'],
    include: [{
      model: User,
      as: 'createdByAdmin',
      attributes: ['id', 'email', 'firstName', 'lastName'],
      required: false, // Use false to include even if admin user is deleted
    }],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit as string),
    offset: parseInt(offset as string)
  });

  // Add expiring soon flag
  const expiringSoonThreshold = new Date();
  expiringSoonThreshold.setHours(expiringSoonThreshold.getHours() + 24);

  const codesWithStatus = codes.rows.map(code => {
    const codeJson = code.toJSON();
    return {
      ...codeJson,
      isExpiringSoon: !code.isUsed && code.expiresAt <= expiringSoonThreshold && code.expiresAt > now
    };
  });

  res.success({
    codes: codesWithStatus,
    total: codes.count,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string)
  }, 'Secret codes retrieved successfully');
});


// Delete a secret code
deleteSecretCode = catchAsync(async (req: Request, res: Response) => {
  const codeIdParam = req.params.codeId;
  const codeId = Array.isArray(codeIdParam) ? codeIdParam[0] : codeIdParam; // Handle array case if it occurs
  const adminUser = req.user;

  const secretCode = await SecretCode.findByPk(codeId);

  if (!secretCode) {
    return res.error('Secret code not found', 404, 'CODE_NOT_FOUND');
  }

  await secretCode.destroy();

  await AuditLog.create({
    eventType: 'SECRET_CODE_DELETED',
    severity: 'INFO',
    userId: adminUser?.id,
    email: adminUser?.email,
    details: {
      deletedCode: secretCode.code,
      wasUsed: secretCode.isUsed
    },
  });

  logger.info(`Secret code ${secretCode.code} deleted by admin ${adminUser?.email}`);

  res.success({ message: 'Secret code deleted successfully' }, 'Code deleted');
});

// Get active employees
getActiveEmployees = catchAsync(async (req: Request, res: Response) => {
  const employees = await User.findAll({
    where: {
      role: 'EMPLOYEE',
      status: 'active'
    },
    attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'createdAt', 'lastLogin'],
    order: [['createdAt', 'DESC']]
  });

  res.success(employees, 'Active employees retrieved successfully');
});

  // ==================== GET PENDING EMPLOYEES ====================
  getPendingEmployees = catchAsync(async (req: Request, res: Response) => {
    const pendingEmployees = await User.findAll({
      where: {
        role: 'EMPLOYEE',
        status: 'pending_approval'
      },
      attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'createdAt', 'status'],
      order: [['createdAt', 'ASC']]
    });

    res.success(pendingEmployees, 'Pending employees retrieved successfully');
  });

  // ==================== APPROVE/REJECT EMPLOYEE ====================
  approveEmployee = catchAsync(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
    }

    const { userId, approve, reason } = req.body;
    const adminUser = req.user;

    const transaction = await User.sequelize!.transaction();

    try {
      const employee = await User.findByPk(userId, { transaction });

      if (!employee) {
        await transaction.rollback();
        return res.error('Employee not found', 404, 'USER_NOT_FOUND');
      }

      if (employee.role !== 'EMPLOYEE') {
        await transaction.rollback();
        return res.error('User is not an employee', 400, 'INVALID_ROLE');
      }

      if (employee.status !== 'pending_approval') {
        await transaction.rollback();
        return res.error(`Employee status is ${employee.status}, cannot approve/reject`, 400, 'INVALID_STATUS');
      }

      if (approve) {
        // Approve employee
        await employee.update({
          status: 'active',
          approvedAt: new Date(),
          approvedBy: adminUser?.id
        }, { transaction });

        await AuditLog.create({
          eventType: 'ADMIN_APPROVAL',
          severity: 'INFO',
          userId: employee.id,
          email: adminUser?.email,
          details: {
            approved: true,
            employeeEmail: employee.email,
            employeeName: `${employee.firstName} ${employee.lastName}`
          }
        }, { transaction });

        await transaction.commit();

        logger.info(`Employee ${employee.email} approved by admin ${adminUser?.email}`);

        res.success({ message: 'Employee approved successfully' }, 'Employee approved');
      } else {
        // Reject employee
        await employee.update({
          status: 'rejected'
        }, { transaction });

        await AuditLog.create({
          eventType: 'ADMIN_REJECTION',
          severity: 'WARNING',
          userId: employee.id,
          email: adminUser?.email,
          details: {
            approved: false,
            reason: reason || 'No reason provided',
            employeeEmail: employee.email,
            employeeName: `${employee.firstName} ${employee.lastName}`
          }
        }, { transaction });

        await transaction.commit();

        logger.warn(`Employee ${employee.email} rejected by admin ${adminUser?.email}`, { reason });

        res.success({ message: 'Employee rejected successfully' }, 'Employee rejected');
      }
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  });

  

  // ==================== GET AUDIT LOGS ====================
  getAuditLogs = catchAsync(async (req: Request, res: Response) => {
    const { limit = 100, offset = 0, eventType } = req.query;

    const where: any = {};
    if (eventType) where.eventType = eventType;

    const logs = await AuditLog.findAndCountAll({
      where,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      order: [['createdAt', 'DESC']],
    });

    res.success({
      logs: logs.rows,
      total: logs.count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    }, 'Audit logs retrieved successfully');
  });
}