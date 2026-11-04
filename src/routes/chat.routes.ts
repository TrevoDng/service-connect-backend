// src/routes/chat.routes.ts
import { Router } from 'express';
import {
  createOrGetThread,
  getMyThreads,
  getThreadMessages,
  postMessage,
  markThreadRead,
} from '../controllers/chat.controller';
import { verifyUserToken, requireRole } from '../services/auth.service';

const router = Router();
router.use(verifyUserToken);
router.use(requireRole('CLIENT', 'PROVIDER'));

router.post('/threads', createOrGetThread);
router.get('/threads', getMyThreads);
router.get('/threads/:id/messages', getThreadMessages);
router.post('/threads/:id/messages', postMessage);
router.post('/threads/:id/read', markThreadRead);

export default router;