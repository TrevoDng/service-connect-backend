// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import logger from '../utils/logger';
//import '/types/express-augmentation.d.ts'; // Import the type definitions
import { verifyJwtToken } from '../utils/jwt.utils';

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: { code: 'NO_TOKEN', message: 'No token provided' } 
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token using jwt.utils - this will throw if token is 
    // invalid or expired
    const decoded = verifyJwtToken(token);
    //jwt.verify(token, process.env.JWT_SECRET) as { uid: string };
    
    // Get user from database using Sequelize
    const dbUser = await User.findOne({
      where: { id: decoded.id }
    });
    
    if (!dbUser) {
      return res.status(401).json({ 
        success: false, 
        error: { code: 'USER_NOT_FOUND', message: 'User not found in database' } 
      });
    }
    
    // Check if user is active
    if (dbUser.status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        error: { code: 'ACCOUNT_NOT_ACTIVE', message: `Account status: ${dbUser.status}` } 
      });
    }
    
    // Attach user to request - now guaranteed to exist
    // I suggest firebase will be replaced with a custom auth system, 
    // so we can directly use dbUser info from postgres without needing to verify with Firebase
    req.user = dbUser;
    
    next();
  } catch (error) {
    logger.error('Token verification failed', { error });
    return res.status(401).json({ 
      success: false, 
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } 
    });
  }
};