import { Router } from 'express';
import {
  raiseDispute,
  getMyDisputes,
  getDisputeById,
  addMessage,
  requestInfo,
  resolveDispute,
  getDisputeByBooking,
} from '../controllers/disputes.controller';
import { verifyUserToken } from '../services/auth.service';

const router = Router();
router.use(verifyUserToken);

router.post('/', raiseDispute);
router.get('/', getMyDisputes);
router.get('/booking/:bookingId', getDisputeByBooking);
router.get('/:id', getDisputeById);
router.post('/:id/messages', addMessage);
router.post('/:id/request-info', requestInfo);
router.patch('/:id/resolve', resolveDispute);

export default router;