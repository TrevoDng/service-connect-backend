// src/routes/reviews.routes.ts
import { Router } from 'express';
import {
  submitReview,
  getReviewForBooking,
  getReviewsForProvider,
  replyToReview,
  getMyReviews,
} from '../controllers/reviews.controller';
import { verifyUserToken } from '../services/auth.service';

const router = Router();

// Public — no auth needed for browsing provider reviews
router.get('/provider/:providerId', getReviewsForProvider);

// Protected — everything else
router.use(verifyUserToken);
router.post('/', submitReview);
router.get('/my', getMyReviews);
router.get('/booking/:bookingId', getReviewForBooking);
router.post('/:id/reply', replyToReview);

export default router;