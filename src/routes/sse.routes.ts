// src/routes/sse.routes.ts
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { addClient, removeClient } from '../utils/sseRegistry';
import logger from '../utils/logger';

const router = Router();
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

router.get('/', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) return void res.status(401).json({ success: false, message: 'Missing token' });

  let userId: string;
  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string };
    userId = decoded.id;
  } catch {
    return void res.status(401).json({ success: false, message: 'Invalid token' });
  }

  const user = await User.findByPk(userId);
  if (!user || user.status !== 'active') {
    return void res.status(401).json({ success: false, message: 'User not active' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(': connected\n\n');
  addClient(userId, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* cleaned up by close handler */
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
    logger.info(`[sse] closed for ${userId}`);
  });
});

export default router;