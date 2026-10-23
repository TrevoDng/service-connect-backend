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
import { assign } from 'nodemailer/lib/shared';

// ==================== REGISTRATION CONTROLLER ====================
export const register = catchAsync(async (req: Request, res: Response) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
  }

  const { 
    firstName, 
    lastName, 
    email, 
    password, 
    secretCode, 
    phone, 
    rememberMe 
  } = req.body;
  
  const ipAddress = req.ip;
  const userAgent = req.headers['user-agent'];
  
  const transaction = await User.sequelize!.transaction();
  
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ 
      where: { email },
      transaction 
    });
    
    if (existingUser) {
      await transaction.rollback();
      return res.error('Email already registered', 409, 'EMAIL_EXISTS');
    }
    
    let role: 'CLIENT' | 'EMPLOYEE' = 'CLIENT';
    let status: 'pending_email' | 'active' = 'active';
    let requiresEmailVerification = false;
    let requiresAdminApproval = false;
    let validatedSecretCode = null;
    
    // Check if secret code is provided -> Employee registration
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

      // NEW: Validate that the email matches the assigned email
      if (inviteCode.assignedEmail.toLowerCase() !== email.toLowerCase()) {
        await AuditLog.create({
          eventType: 'REGISTRATION_FAILED',
          severity: 'WARNING',
          email,
          details: { 
            secretCode, 
            reason: 'Email mismatch',
            expectedEmail: inviteCode.assignedEmail,
            providedEmail: email
          },
          ipAddress,
        }, { transaction });
        
        await transaction.rollback();
        return res.error(
          'This registration code is assigned to a different email address. Please use the correct email or contact your administrator.',
          403,
          'EMAIL_MISMATCH'
        );
      }
      
      // Mark code as used
      await inviteCode.update({
        isUsed: true,
        usedAt: new Date(),
        usedBy: undefined, // We don't have the user ID yet, will update after user is created
      }, { transaction });
      
      validatedSecretCode = secretCode;
      role = 'EMPLOYEE';
      status = 'pending_email';
      requiresEmailVerification = true;
      requiresAdminApproval = true;
    }

    const frontendUrl = req.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Generate email verification token for employees
    let verificationToken = undefined;
    let tokenExpires = undefined;
    
    if (role === 'EMPLOYEE') {
      verificationToken = generateVerificationToken();
      tokenExpires = getTokenExpiry(24);
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user account
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

    // If we have a secret code, update it with the user ID
    if (secretCode) {
      await SecretCode.update(
        { usedBy: user.id },
        { where: { code: secretCode }, transaction }
      );
    }
    
    console.log('User created with ID:', user.id);
    
    // Log successful registration
    await AuditLog.create({
      eventType: 'USER_REGISTERED',
      severity: 'INFO',
      userId: user.id,
      email,
      details: { 
        userType: role.toLowerCase(), 
        secretCode: !!validatedSecretCode, 
        rememberMe 
      },
      ipAddress,
      userAgent,
    }, { transaction });
    
    await transaction.commit();
    
    // TODO: Send verification email when email service is configured
    if (verificationToken) {
      await sendVerificationEmail(email, verificationToken, role.toLowerCase(), frontendUrl);
    }
    
    // Prepare success message based on role
    const message = role === 'CLIENT' 
      ? 'Registration successful! You can now log in.'
      : 'Registration successful! Please check your email to verify your account.';
    
    res.success({
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role
      },
      requiresEmailVerification,
      requiresAdminApproval
    }, message);
    
  } catch (error: any) {
    await transaction.rollback();
    logger.error('Registration failed', { error: error.message, email });
    res.error('Registration failed. Please try again.', 500, 'REGISTRATION_ERROR');
  }
});

// ==================== LOGIN CONTROLLER ====================
export const login = catchAsync(async (req: Request, res: Response) => {
  // Check for validation errors
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
    
    // Role-specific status checks
    if (user.role === 'ADMIN' && user.status !== 'active') {
      return res.error('Admin account is not active. Please contact support.', 403, 'ACCOUNT_INACTIVE');
    }

    if (user.role === 'CLIENT' && user.status !== 'active') {
      return res.error('Customer account is not active. Please contact support.', 403, 'ACCOUNT_INACTIVE');
    }

    if (user.role === 'EMPLOYEE') {
      if (user.status === 'pending_email') {
        return res.error('Please verify your email before logging in.', 403, 'EMAIL_NOT_VERIFIED');
      }
      if (user.status === 'pending_approval') {
        return res.error('Your account is pending admin approval.', 403, 'PENDING_APPROVAL');
      }
      if (user.status !== 'active') {
        return res.error(`Account status: ${user.status}. Contact HR.`, 403, 'ACCOUNT_INACTIVE');
      }
    }

        // Also for CLIENT role:
    if (user.role === 'CLIENT' && user.status !== 'active') {
      // Check if it's pending_email
      if (user.status === 'pending_email') {
        return res.error(
          'Please verify your email before logging in.', 
          403, 
          'EMAIL_NOT_VERIFIED'
        );
      }
      return res.error(
        'Account is not active. Please contact support.', 
        403, 
        'ACCOUNT_INACTIVE'
      );
    }
    
    // Update last login
    await user.update({ lastLogin: new Date() });
    
    // Generate JWT
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    
    res.success({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    }, 'Login successful');
    
  } catch (error: any) {
    console.error('Login error:', error);
    logger.error('Login failed', { 
      email, 
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name
    });
    res.error('Login failed. Please try again.', 500, 'LOGIN_ERROR');
  }
});

// ==================== EMAIL VERIFICATION CONTROLLER ====================
export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.query;

  const frontendUrl = req.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  
  if (!token || typeof token !== 'string') {
    // Check if it's an API request or browser request
    if (req.headers.accept?.includes('application/json')) {
      return res.error('Invalid verification token', 400, 'INVALID_TOKEN');
    }
    //const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/verify-email?reason=invalid-token`);
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
      return res.redirect(`${process.env.FRONTEND_URL}/verify-email?reason=invalid-token`);
    }
    
    let newStatus: 'pending_approval' | 'active';
    let message: string;
    
    if (user.role === 'EMPLOYEE') {
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
    
    // For API requests, return JSON response
    if (req.headers.accept?.includes('application/json')) {
      return res.success({
        verified: true,
        message,
        role: user.role
      }, 'Email verified successfully');
    }
    
    // For browser requests, redirect to frontend verification page
    //const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(
      `${frontendUrl}/verify-email?verified=true&message=${encodeURIComponent(message)}&role=${user.role}`
    );
    
  } catch (error) {
    logger.error('Email verification failed', { error });
    
    if (req.headers.accept?.includes('application/json')) {
      return res.error('Verification failed', 500, 'VERIFICATION_ERROR');
    }
    
    //const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${frontendUrl}/verify-email?reason=error`);
  }
});

// ==================== RESEND VERIFICATION EMAIL CONTROLLER ====================
export const resendVerification = catchAsync(async (req: Request, res: Response) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
  }

  const { email } = req.body;

  if (!email) {
    return res.error('Email is required', 400, 'MISSING_EMAIL');
  }

  // Find user by email
  const user = await User.findOne({ where: { email } });

  if (!user) {
    return res.error('User not found with this email', 404, 'USER_NOT_FOUND');
  }

  // Check if user is already verified
  if (user.status === 'active') {
    return res.error('This email is already verified. Please login.', 400, 'ALREADY_VERIFIED');
  }

  // Check if user is in pending_email state
  if (user.status !== 'pending_email') {
    return res.error(`Account is ${user.status}. Please contact support.`, 400, 'INVALID_STATUS');
  }

  // Generate new verification token
  const verificationToken = generateVerificationToken();
  const tokenExpires = getTokenExpiry(24); // 24 hours

  // Update user with new token
  await user.update({
    verificationToken: verificationToken,
    verificationTokenExpires: tokenExpires,
  });

  const frontendUrl = req.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';

  // Send verification email
  await sendVerificationEmail(email, verificationToken, user.role.toLowerCase(), frontendUrl);
   //console.log("frontendUrl: ", frontendUrl);
  // Log the action
  await AuditLog.create({
    eventType: 'VERIFICATION_RESENT',
    severity: 'INFO',
    userId: user.id,
    email: user.email,
    details: {
      userRole: user.role,
      ipAddress: req.ip,
    },
  });

  logger.info(`Verification email resent to ${email}`);

  res.success({
    email: user.email,
    message: 'Verification email has been resent. Please check your inbox.'
  }, 'Verification email resent successfully');
});

/*export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.query;
  
  if (!token || typeof token !== 'string') {
    return res.redirect('/verify-failed?reason=invalid-token');
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
      return res.redirect('/verify-failed?reason=invalid-token');
    }
    
    let newStatus: 'pending_approval' | 'active';
    let message: string;
    
    if (user.role === 'EMPLOYEE') {
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
    
    res.redirect(`/login?verified=true&message=${encodeURIComponent(message)}`);
    
  } catch (error) {
    logger.error('Email verification failed', { error });
    res.redirect('/verify-failed?reason=error');
  }
});
*/
// ==================== VALIDATE SECRET CODE CONTROLLER ====================
export const validateSecretCode = catchAsync(async (req: Request, res: Response) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
  }

  const { secretCode } = req.body;

  if (!secretCode) {
    return res.error('Secret code is required', 400, 'MISSING_CODE');
  }

  // Find valid secret code
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
  }, 'Secret code is valid');
});

// ==================== GET CURRENT USER CONTROLLER ====================
export const getMe = catchAsync(async (req: Request, res: Response) => {
  res.success({
    user: req.user
  }, 'User retrieved successfully');
});


export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { firstName, lastName, phone } = req.body;
  
  if (!user) {
    return res.error('User not authenticated', 401, 'UNAUTHORIZED');
  }
  
  // Update only allowed fields
  await User.update(
    { firstName, lastName, phone },
    { where: { id: user.id } }
  );
  
  // Fetch updated user
  const updatedUser = await User.findByPk(user.id);
  
  res.success({ user: updatedUser }, 'Profile updated successfully');
});