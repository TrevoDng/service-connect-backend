// src/controllers/reviews.controller.ts
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Review from '../models/Review';
import Booking from '../models/Booking';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';
import { createNotification } from './notifications.controller';

function fireNotification(input: Parameters<typeof createNotification>[0]): void {
  createNotification(input).catch((err) =>
    logger.error('Failed to create notification', err)
  );
}

function displayNameOf(u: { firstName?: string; lastName?: string }): string {
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'User';
}

function toApi(r: Review) {
  return {
    id: r.id,
    bookingId: r.bookingId,
    clientId: r.clientId,
    clientDisplayName: r.clientDisplayName,
    providerId: r.providerId,
    providerDisplayName: r.providerDisplayName,
    rating: r.rating,
    comment: r.comment ?? undefined,
    photos: r.photos ?? [],
    tags: r.tags ?? [],
    wouldRecommend: r.wouldRecommend,
    createdAt: r.createdAt.toISOString(),
    providerReply: r.providerReplyText
      ? {
          text: r.providerReplyText,
          createdAt: r.providerRepliedAt?.toISOString() ?? r.updatedAt.toISOString(),
        }
      : undefined,
  };
}

// ==================== SUBMIT REVIEW (CLIENT) ====================
export const submitReview = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT') {
    return res.error('Only clients can submit reviews', 403, 'FORBIDDEN');
  }

  const { bookingId, rating, comment, photos, tags, wouldRecommend } = req.body;

  if (!bookingId) return res.error('bookingId is required', 400, 'MISSING_BOOKING');
  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return res.error('rating must be an integer between 1 and 5', 400, 'INVALID_RATING');
  }

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.clientId !== user.id) {
    return res.error('You can only review your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'completed') {
    return res.error('You can only review completed bookings', 400, 'INVALID_STATUS');
  }

  const existing = await Review.findOne({ where: { bookingId: booking.id } });
  if (existing) {
    return res.error('You have already reviewed this booking', 409, 'REVIEW_EXISTS');
  }

  const review = await Review.create({
    bookingId: booking.id,
    clientId: user.id,
    clientDisplayName: displayNameOf(user),
    providerId: booking.providerId,
    providerDisplayName: booking.providerDisplayName,
    rating: numRating,
    comment: comment ? String(comment).trim() : null,
    photos: Array.isArray(photos) ? photos : [],
    tags: Array.isArray(tags) ? tags : [],
    wouldRecommend: wouldRecommend !== false,
  });

  fireNotification({
    userId: booking.providerId,
    type: 'review_submitted',
    priority: 'normal',
    title: `New ${numRating}-star review`,
    message: `${displayNameOf(user)} left a ${numRating}-star review for ${booking.serviceTitle}.`,
    linkTo: '/provider/dashboard?tab=requests',
    actorId: user.id,
    actorDisplayName: displayNameOf(user),
    bookingId: booking.id,
  });

  logger.info(`Review ${review.id} submitted for ${booking.requestRef} by ${user.email}`);

  res.status(201).success({ review: toApi(review) }, 'Review submitted');
});

// ==================== GET REVIEW FOR BOOKING ====================
export const getReviewForBooking = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.bookingId;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;

  const review = await Review.findOne({ where: { bookingId } });
  if (!review) return res.success({ review: null }, 'No review for this booking');

  res.success({ review: toApi(review) }, 'Review retrieved');
});

// ==================== GET REVIEWS FOR PROVIDER (PUBLIC) ====================
export const getReviewsForProvider = catchAsync(async (req: Request, res: Response) => {
  const idParam = req.params.providerId;
  const providerId = Array.isArray(idParam) ? idParam[0] : idParam;

  const reviews = await Review.findAll({
    where: { providerId },
    order: [['createdAt', 'DESC']],
  });

  // Rating summary
  const count = reviews.length;
  let sum = 0;
  let recommends = 0;
  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    const b = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
    if (b >= 1 && b <= 5) breakdown[b] += 1;
    sum += r.rating;
    if (r.wouldRecommend) recommends += 1;
  }

  const summary = {
    average: count > 0 ? Number((sum / count).toFixed(2)) : null,
    count,
    breakdown,
    recommendRate: count > 0 ? Number(((recommends / count) * 100).toFixed(0)) : null,
  };

  res.success(
    { reviews: reviews.map(toApi), summary },
    'Provider reviews retrieved'
  );
});

// ==================== PROVIDER REPLY ====================
export const replyToReview = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can reply to reviews', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { text } = req.body;

  if (!text || !String(text).trim()) {
    return res.error('text is required', 400, 'MISSING_TEXT');
  }

  const review = await Review.findByPk(id);
  if (!review) return res.error('Review not found', 404, 'NOT_FOUND');
  if (review.providerId !== user.id) {
    return res.error('You can only reply to your own reviews', 403, 'FORBIDDEN');
  }
  if (review.providerReplyText) {
    return res.error('You have already replied to this review', 409, 'ALREADY_REPLIED');
  }

  await review.update({
    providerReplyText: String(text).trim(),
    providerRepliedAt: new Date(),
  });

  fireNotification({
    userId: review.clientId,
    type: 'review_replied',
    priority: 'normal',
    title: 'Provider replied to your review',
    message: `${displayNameOf(user)} replied to your review.`,
    linkTo: '/client/dashboard?tab=history',
    actorId: user.id,
    actorDisplayName: displayNameOf(user),
    bookingId: review.bookingId,
  });

  logger.info(`Review ${review.id} replied by ${user.email}`);

  res.success({ review: toApi(review) }, 'Reply posted');
});

// ==================== GET MY REVIEWS (role-aware) ====================
export const getMyReviews = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const where: any =
    user.role === 'CLIENT'
      ? { clientId: user.id }
      : user.role === 'PROVIDER'
      ? { providerId: user.id }
      : {};

  const reviews = await Review.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });

  res.success({ reviews: reviews.map(toApi) }, 'Reviews retrieved');
});