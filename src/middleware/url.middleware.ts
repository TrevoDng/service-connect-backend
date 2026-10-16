// src/middleware/url.middleware.ts
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      frontendUrl?: string;
      backendUrl?: string;
    }
  }
}

export const detectFrontendUrl = (req: Request, res: Response, next: NextFunction) => {
    // 1. Check if it's explicitly set in environment (for webhooks)
    if (process.env.FRONTEND_URL) {
        req.frontendUrl = process.env.FRONTEND_URL;
        console.log(`🔗 Frontend URL from env: ${req.frontendUrl}`);
        return next();
    }

    // 2. Try to get from Origin header (most reliable)
    const origin = req.headers.origin;
    if (origin) {
        req.frontendUrl = origin;
        console.log(`🔗 Frontend URL from Origin: ${req.frontendUrl}`);
        return next();
    }

    // 3. Try to get from Referer header
    const referer = req.headers.referer;
    if (referer) {
        try {
            const url = new URL(referer);
            req.frontendUrl = `${url.protocol}//${url.host}`;
            console.log(`🔗 Frontend URL from Referer: ${req.frontendUrl}`);
            return next();
        } catch (e) {}
    }

    // 4. ✅ Auto-detect based on environment
    const host = req.get('host');
    if (host) {
        // Check if running in Docker (DB_HOST === 'postgres')
        if (process.env.DB_HOST === 'postgres' || process.env.REDIS_HOST === 'redis') {
            // Running in Docker - frontend is on port 80
            req.frontendUrl = 'http://localhost';
            console.log(`🔗 Frontend URL (Docker auto-detect): ${req.frontendUrl}`);
            return next();
        }
        
        // Local development - frontend is on port 3000
        req.frontendUrl = 'http://localhost:3000';
        console.log(`🔗 Frontend URL (Local auto-detect): ${req.frontendUrl}`);
        return next();
    }

    // 5. Fallback
    req.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    console.log(`🔗 Frontend URL (Fallback): ${req.frontendUrl}`);
    next();
};

export const getBackendUrl = (req: Request): string => {
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`;
};