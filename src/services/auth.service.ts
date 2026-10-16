// src/services/auth.service.ts (updated to use res.error)
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import logger from '../utils/logger';

const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

export interface DecodedToken {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const verifyUserToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check cookies first, then Authorization header
    let token = req.cookies?.jwt;
    
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.error('Not authorized, token not available', 401, 'TOKEN_MISSING');
    }
    
    // Verify the JWT token
    const decoded = jwt.verify(token, jwtSecret) as DecodedToken;
    
    // Check if user exists in database
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.error('User not found', 401, 'USER_NOT_FOUND');
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.error(`Account is ${user.status}. Please contact support.`, 403, 'ACCOUNT_INACTIVE');
    }
    
    // Attach user to request
    req.user = user;
    next();
    
  } catch (error: any) {
    logger.error('Token verification failed', { error: error.message });
    
    if (error.name === 'JsonWebTokenError') {
      return res.error('Invalid token', 401, 'INVALID_TOKEN');
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.error('Token expired. Please login again.', 401, 'TOKEN_EXPIRED');
    }
    
    return res.error('Not authorized', 401, 'UNAUTHORIZED');
  }
};

// Role checking middleware
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.error('Not authenticated', 401, 'NOT_AUTHENTICATED');
    }
    
    if (!roles.includes(req.user.role)) {
      return res.error(
        `Access denied. Requires one of: ${roles.join(', ')}`, 
        403, 
        'INSUFFICIENT_PERMISSIONS'
      );
    }
    
    next();
  };
};