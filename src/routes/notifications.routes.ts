// src/routes/notifications.routes.ts
import { Router } from 'express';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteOne,
  clearAll,
} from '../controllers/notifications.controller';
import { verifyUserToken } from '../services/auth.service';

const router = Router();

router.use(verifyUserToken);

router.get('/', getMyNotifications);
router.patch('/:id/read', markAsRead);
router.post('/read-all', markAllAsRead);
router.delete('/:id', deleteOne);
router.delete('/', clearAll);

export default router;