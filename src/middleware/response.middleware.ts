// src/middleware/response.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/api.types';

declare global {
  namespace Express {
    interface Response {
      success: <T>(data?: T, message?: string, statusCode?: number) => void;
      error: (message: string, statusCode?: number, code?: string, details?: any) => void;
    }
  }
}

export const responseMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Success response helper
  res.success = function <T>(data?: T, message?: string, statusCode: number = 200) {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message: message || 'Success'
    };
    this.status(statusCode).json(response);
  };

  // Error response helper
  res.error = function (message: string, statusCode: number = 400, code: string = 'ERROR', details?: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        details,
      },
      message
    };
    this.status(statusCode).json(response);
  };

  next();
};