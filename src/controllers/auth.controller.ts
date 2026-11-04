// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import SecretCode from '../models/SecretCode';
import AuditLog from '../models/AuditLog';
import { generateVerificationToken, getTokenExpiry } from '../utils/token.utils';
import { sendVerificationEmail } from '../services/email.service';
import { generateToken, verifyJwtToken } from '../utils/jwt.utils';
import logger from '../utils/logger';
import catchAsync from '../utils/catchAsync';
import AppError from '../utils/AppError';

// ==================== REGISTRATION CONTROLLER ====================
export const register = catchAsync(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
  }

  const { firstName, lastName, email, password, secretCode, phone, rememberMe } = req.body;
  
  const ipAddress = req.ip;
  const userAgent = req.headers['user-agent'];
  
  const transaction = await User.sequelize!.transaction();
  
  try {
    const existingUser = await User.findOne({ where: { email }, transaction });
    if (existingUser) {
      await transaction.rollback();
      return res.error('Email already registered', 409, 'EMAIL_EXISTS');
    }
    
    let role: 'CLIENT' | 'EMPLOYEE' | 'PROVIDER' = 'CLIENT';
    let status: 'pending_email' | 'active' = 'active';
    let requiresEmailVerification = false;
    let requiresAdminApproval = false;
    let validatedSecretCode = null;
    
    if (secretCode) {
      const inviteCode = await SecretCode.findOne({
        where: {
          code: secretCode,
          expiresAt: { [Op.gt]: new Date() },
          isUsed: false,
        },
        transaction
      });

      if (!inviteCode) {
        await AuditLog.create({
          eventType: 'REGISTRATION_FAILED',
          severity: 'WARNING',
          email,
          details: { secretCode, reason: 'Invalid or expired secret code' },
          ipAddress,
        }, { transaction });
        
        await transaction.rollback();
        return res.error('Invalid or expired registration code. Contact your administrator.', 403, 'INVALID_CODE');
      }

      if (inviteCode.assignedEmail.toLowerCase() !== email.toLowerCase()) {
        await AuditLog.create({
          eventType: 'REGISTRATION_FAILED',
          severity: 'WARNING',
          email,
          details: { secretCode, reason: 'Email mismatch', expectedEmail: inviteCode.assignedEmail, providedEmail: email },
          ipAddress,
        }, { transaction });
        
        await transaction.rollback();
        return res.error('This registration code is assigned to a different email address.', 403, 'EMAIL_MISMATCH');
      }
      
      await inviteCode.update({ isUsed: true, usedAt: new Date() }, { transaction });
      
      validatedSecretCode = secretCode;
      role = inviteCode.role || 'EMPLOYEE';
      status = 'pending_email';
      requiresEmailVerification = true;
      requiresAdminApproval = true;
    }

    const frontendUrl = req.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    
    let verificationToken = undefined;
    let tokenExpires = undefined;
    
    if (role === 'EMPLOYEE' || role === 'PROVIDER') {
      verificationToken = generateVerificationToken();
      tokenExpires = getTokenExpiry(24);
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone: phone || '',
      role: role,
      status: status,
      verificationToken: verificationToken,
      verificationTokenExpires: tokenExpires,
      secretCode: validatedSecretCode,
    }, { transaction });

    if (secretCode) {
      await SecretCode.update({ usedBy: user.id }, { where: { code: secretCode }, transaction });
    }
    
    await AuditLog.create({
      eventType: 'USER_REGISTERED',
      severity: 'INFO',
      userId: user.id,
      email,
      details: { userType: role.toLowerCase(), secretCode: !!validatedSecretCode, rememberMe },
      ipAddress,
      userAgent,
    }, { transaction });
    
    await transaction.commit();
    
    if (verificationToken) {
      await sendVerificationEmail(email, verificationToken, role.toLowerCase(), frontendUrl);
    }
    
    const message = role === 'CLIENT' 
      ? 'Registration successful! You can now log in.'
      : 'Registration successful! Please check your email to verify your account.';
    
    res.success({
      user: { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, role: user.role },
      requiresEmailVerification,
      requiresAdminApproval
    }, message);
    
  } catch (error: any) {
    await transaction.rollback();
    logger.error('Registration failed', { error: error.message, email });
    return res.error('Registration failed. Please try again.', 500, 'REGISTRATION_ERROR');
  }
});

// ==================== LOGIN CONTROLLER ====================
export const login = catchAsync(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.error('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    
    const isValidPassword = await user.comparePassword(password);
    
    if (!isValidPassword) {
      return res.error('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    
    // ROLE-SPECIFIC STATUS CHECKS
    if (user.role === 'ADMIN' && user.status !== 'active') {
      return res.error('Admin account is not active. Please contact support.', 403, 'ACCOUNT_INACTIVE');
    }

    if (user.role === 'CLIENT' && user.status !== 'active') {
      if (user.status === 'pending_email') {
        return res.error('Please verify your email before logging in.', 403, 'EMAIL_NOT_VERIFIED');
      }
      return res.error('Account is not active. Please contact support.', 403, 'ACCOUNT_INACTIVE');
    }

    // 🚨 FIXED: Added PROVIDER to the strict status checks!
    if (user.role === 'EMPLOYEE' || user.role === 'PROVIDER') {
      if (user.status === 'pending_email') {
        return res.error('Please verify your email before logging in.', 403, 'EMAIL_NOT_VERIFIED');
      }
      if (user.status === 'pending_approval') {
        return res.error('Your account is pending admin approval.', 403, 'PENDING_APPROVAL');
      }
      if (user.status !== 'active') {
        return res.error(`Account status: ${user.status}. Please contact support.`, 403, 'ACCOUNT_INACTIVE');
      }
    }
    
    await user.update({ lastLogin: new Date() });
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    
    res.success({
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
    }, 'Login successful');
    
  } catch (error: any) {
    logger.error('Login failed', { email, errorMessage: error.message });
    return res.error('Login failed. Please try again.', 500, 'LOGIN_ERROR');
  }
});

// ==================== EMAIL VERIFICATION CONTROLLER ====================
export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.query;
  const frontendUrl = req.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  
  if (!token || typeof token !== 'string') {
    if (req.headers.accept?.includes('application/json')) {
      return res.error('Invalid verification token', 400, 'INVALID_TOKEN');
    }
    return res.redirect(`${frontendUrl}/service-connect/verify-email?reason=invalid-token`);
  }
  
  try {
    const user = await User.findOne({
      where: {
        verificationToken: token,
        verificationTokenExpires: { [Op.gt]: new Date() },
        status: 'pending_email',
      }
    });
    
    if (!user) {
      if (req.headers.accept?.includes('application/json')) {
        return res.error('Invalid or expired verification token', 400, 'INVALID_TOKEN');
      }
      return res.redirect(`${frontendUrl}/service-connect/verify-email?reason=invalid-token`);
    }
    
    let newStatus: 'pending_approval' | 'active';
    let message: string;
    
    // 🚨 FIXED: Added PROVIDER to the status update logic!
    if (user.role === 'EMPLOYEE' || user.role === 'PROVIDER') {
      newStatus = 'pending_approval';
      message = 'Email verified! Your registration is now pending admin approval. You will be notified once approved.';
    } else {
      newStatus = 'active';
      message = 'Email verified! Your account is now active. You can now log in.';
    }
    
    await user.update({
      status: newStatus,
      verificationToken: undefined,
      verificationTokenExpires: undefined,
    });
    
    await AuditLog.create({
      eventType: 'EMAIL_VERIFIED',
      severity: 'INFO',
      userId: user.id,
      email: user.email,
      details: { role: user.role },
    });
    
    if (req.headers.accept?.includes('application/json')) {
      return res.success({ verified: true, message, role: user.role }, 'Email verified successfully');
    }
    
    // 🚨 FIXED: The success redirect is now correctly inside the try block!
    return res.redirect(
      `${frontendUrl}/service-connect/verify-email?verified=true&message=${encodeURIComponent(message)}&role=${user.role}`
    );
    
  } catch (error) {
    logger.error('Email verification failed', { error });
    
    if (req.headers.accept?.includes('application/json')) {
      return res.error('Verification failed', 500, 'VERIFICATION_ERROR');
    }
    
    // 🚨 FIXED: The catch block now correctly redirects to the error state
    return res.redirect(`${frontendUrl}/service-connect/verify-email?reason=error`);
  }
});

// ==================== RESEND VERIFICATION EMAIL CONTROLLER ====================
export const resendVerification = catchAsync(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
  }

  const { email } = req.body;

  if (!email) {
    return res.error('Email is required', 400, 'MISSING_EMAIL');
  }

  const user = await User.findOne({ where: { email } });

  if (!user) {
    return res.error('User not found with this email', 404, 'USER_NOT_FOUND');
  }

  if (user.status === 'active') {
    return res.error('This email is already verified. Please login.', 400, 'ALREADY_VERIFIED');
  }

  if (user.status !== 'pending_email') {
    return res.error(`Account is ${user.status}. Please contact support.`, 400, 'INVALID_STATUS');
  }

  const verificationToken = generateVerificationToken();
  const tokenExpires = getTokenExpiry(24);

  await user.update({
    verificationToken: verificationToken,
    verificationTokenExpires: tokenExpires,
  });

  const frontendUrl = req.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';

  await sendVerificationEmail(email, verificationToken, user.role.toLowerCase(), frontendUrl);

  await AuditLog.create({
    eventType: 'VERIFICATION_RESENT',
    severity: 'INFO',
    userId: user.id,
    email: user.email,
    details: { userRole: user.role, ipAddress: req.ip },
  });

  logger.info(`Verification email resent to ${email}`);

  res.success({
    email: user.email,
    message: 'Verification email has been resent. Please check your inbox.'
  }, 'Verification email resent successfully');
});

// ==================== VALIDATE SECRET CODE CONTROLLER ====================
export const validateSecretCode = catchAsync(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
  }

  const { secretCode } = req.body;

  if (!secretCode) {
    return res.error('Secret code is required', 400, 'MISSING_CODE');
  }

  const inviteCode = await SecretCode.findOne({
    where: {
      code: secretCode,
      expiresAt: { [Op.gt]: new Date() },
      isUsed: false,
    }
  });

  if (!inviteCode) {
    return res.error('Invalid or expired registration code', 400, 'INVALID_CODE'); 
  }

  res.success({
    expireAt: inviteCode.expiresAt,
    isValid: true,
    assignedEmail: inviteCode.assignedEmail,
    role: inviteCode.role, // Return the role so the frontend knows!
  }, 'Secret code is valid');
});

// ==================== GET CURRENT USER CONTROLLER ====================
export const getMe = catchAsync(async (req: Request, res: Response) => {
  res.success({ user: req.user }, 'User retrieved successfully');
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { firstName, lastName, phone } = req.body;
  
  if (!user) {
    return res.error('User not authenticated', 401, 'UNAUTHORIZED');
  }
  
  await User.update({ firstName, lastName, phone }, { where: { id: user.id } });
  const updatedUser = await User.findByPk(user.id);
  
  res.success({ user: updatedUser }, 'Profile updated successfully');
});