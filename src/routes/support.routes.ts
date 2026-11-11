// src/routes/support.routes.ts
import { Router } from 'express';
import {
  createTicket,
  getMyTickets,
  getMyTicket,
  getMyTicketMessages,
  postRequesterMessage,
  markMyTicketRead,
} from '../controllers/support.controller';
import { verifyUserToken, requireRole } from '../services/auth.service';

const router = Router();
router.use(verifyUserToken);
router.use(requireRole('CLIENT', 'PROVIDER'));

router.post('/tickets', createTicket);
router.get('/tickets', getMyTickets);
router.get('/tickets/:id', getMyTicket);
router.get('/tickets/:id/messages', getMyTicketMessages);
router.post('/tickets/:id/messages', postRequesterMessage);
router.post('/tickets/:id/read', markMyTicketRead);

export default router;