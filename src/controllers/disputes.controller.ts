// src/controllers/disputes.controller.ts
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Dispute from '../models/Dispute';
import DisputeMessage from '../models/DisputeMessage';
import Booking from '../models/Booking';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';
import { createNotification } from './notifications.controller';

// ============================================================
// HELPERS
// ============================================================
function fireNotification(input: Parameters<typeof createNotification>[0]): void {
  createNotification(input).catch((err) =>
    logger.error('Failed to create notification', err)
  );
}

function displayNameOf(u: { firstName?: string; lastName?: string }): string {
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'User';
}

function isStaff(role?: string): boolean {
  return role === 'EMPLOYEE' || role === 'ADMIN';
}

async function toApi(d: Dispute) {
  const messages = await DisputeMessage.findAll({
    where: { disputeId: d.id },
    order: [['createdAt', 'ASC']],
  });

  return {
    id: d.id,
    bookingId: d.bookingId,
    requestRef: d.requestRef,
    raisedByUserId: d.raisedByUserId,
    raisedByRole: d.raisedByRole,
    raisedByDisplayName: d.raisedByDisplayName,
    againstUserId: d.againstUserId,
    againstRole: d.againstRole,
    againstDisplayName: d.againstDisplayName,
    category: d.category,
    reason: d.reason,
    photos: d.photos ?? [],
    status: d.status,
    resolution: d.resolution ?? undefined,
    finalBookingStatus: d.finalBookingStatus ?? undefined,
    resolutionNote: d.resolutionNote ?? undefined,
    resolvedByUserId: d.resolvedByUserId ?? undefined,
    resolvedByDisplayName: d.resolvedByDisplayName ?? undefined,
    resolvedAt: d.resolvedAt?.toISOString(),
    messages: messages.map((m) => ({
      id: m.id,
      authorId: m.authorId,
      authorDisplayName: m.authorDisplayName,
      authorRole: m.authorRole,
      text: m.text,
      internal: m.internal,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

// ==================== RAISE DISPUTE ====================
export const raiseDispute = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT' && user.role !== 'PROVIDER') {
    return res.error('Only clients and providers can raise disputes', 403, 'FORBIDDEN');
  }

  const { bookingId, category, reason, photos } = req.body;

  if (!bookingId || !category || !reason || !String(reason).trim()) {
    return res.error('bookingId, category, and reason are required', 400, 'MISSING_FIELDS');
  }
  if (String(reason).trim().length < 20) {
    return res.error('reason must be at least 20 characters', 400, 'REASON_TOO_SHORT');
  }

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const isClient = user.role === 'CLIENT';
  if (isClient && booking.clientId !== user.id) {
    return res.error('You can only dispute your own bookings', 403, 'FORBIDDEN');
  }
  if (!isClient && booking.providerId !== user.id) {
    return res.error('You can only dispute your own bookings', 403, 'FORBIDDEN');
  }

  if (booking.status === 'requested' || booking.status === 'cancelled') {
    return res.error(`Cannot dispute booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }

  // One open dispute per booking
  const existing = await Dispute.findOne({
    where: { bookingId: booking.id, status: { [Op.in]: ['open', 'awaiting_info'] } },
  });
  if (existing) {
    return res.error('An open dispute already exists for this booking', 409, 'DISPUTE_EXISTS');
  }

  const dispute = await Dispute.create({
    bookingId: booking.id,
    requestRef: booking.requestRef,
    raisedByUserId: user.id,
    raisedByRole: isClient ? 'CLIENT' : 'PROVIDER',
    raisedByDisplayName: displayNameOf(user),
    againstUserId: isClient ? booking.providerId : booking.clientId,
    againstRole: isClient ? 'PROVIDER' : 'CLIENT',
    againstDisplayName: isClient ? booking.providerDisplayName : booking.clientDisplayName,
    category,
    reason: String(reason).trim(),
    photos: Array.isArray(photos) ? photos : [],
    status: 'open',
  });

  // Seed system message
  await DisputeMessage.create({
    disputeId: dispute.id,
    authorId: user.id,
    authorDisplayName: 'ServiceConnect',
    authorRole: 'SYSTEM',
    text: `Dispute raised by ${displayNameOf(user)}. A support agent will review this and respond shortly.`,
    internal: false,
  });

  // Notify counterparty
  fireNotification({
    userId: dispute.againstUserId,
    type: 'dispute_raised',
    priority: 'high',
    title: 'New dispute raised',
    message: `${displayNameOf(user)} raised a dispute about ${booking.serviceTitle}. Support will review.`,
    linkTo: isClient ? '/provider/dashboard?tab=support' : '/client/dashboard?tab=support',
    actorId: user.id,
    actorDisplayName: displayNameOf(user),
    bookingId: booking.id,
  });

  logger.info(`Dispute ${dispute.id} raised by ${user.email} on ${booking.requestRef}`);

  res.status(201).success({ dispute: await toApi(dispute) }, 'Dispute raised');
});

// ==================== GET MY DISPUTES (role-aware) ====================
export const getMyDisputes = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const where: any = {};

  if (isStaff(user.role)) {
    // Staff sees all disputes
  } else if (user.role === 'CLIENT' || user.role === 'PROVIDER') {
    where[Op.or] = [{ raisedByUserId: user.id }, { againstUserId: user.id }];
  } else {
    return res.error('Invalid role', 403, 'FORBIDDEN');
  }

  const disputes = await Dispute.findAll({
    where,
    order: [['updatedAt', 'DESC']],
  });

  const payload = await Promise.all(disputes.map(toApi));

  res.success({ disputes: payload }, 'Disputes retrieved');
});

// ==================== GET ONE DISPUTE ====================
export const getDisputeById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const dispute = await Dispute.findByPk(id);
  if (!dispute) return res.error('Dispute not found', 404, 'NOT_FOUND');

  // Access: staff always; party only if involved
  if (!isStaff(user.role)) {
    if (dispute.raisedByUserId !== user.id && dispute.againstUserId !== user.id) {
      return res.error('Forbidden', 403, 'FORBIDDEN');
    }
  }

  res.success({ dispute: await toApi(dispute) }, 'Dispute retrieved');
});

// ==================== ADD MESSAGE ====================
export const addMessage = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { text, internal } = req.body;

  if (!text || !String(text).trim()) {
    return res.error('text is required', 400, 'MISSING_TEXT');
  }

  const dispute = await Dispute.findByPk(id);
  if (!dispute) return res.error('Dispute not found', 404, 'NOT_FOUND');

  // Access
  const staff = isStaff(user.role);
  if (!staff && dispute.raisedByUserId !== user.id && dispute.againstUserId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  if (dispute.status === 'resolved' || dispute.status === 'closed') {
    return res.error('Dispute is closed', 400, 'DISPUTE_CLOSED');
  }

  // Only staff can post internal notes
  const internalFlag = staff ? Boolean(internal) : false;

  const role = (staff ? user.role : dispute.raisedByUserId === user.id
    ? dispute.raisedByRole
    : dispute.againstRole) as 'CLIENT' | 'PROVIDER' | 'EMPLOYEE' | 'ADMIN' | 'SYSTEM';

  const message = await DisputeMessage.create({
    disputeId: dispute.id,
    authorId: user.id,
    authorDisplayName: displayNameOf(user),
    authorRole: role,
    text: String(text).trim(),
    internal: internalFlag,
  });

  await dispute.changed(); // bump updatedAt for sorting
  await dispute.save();

  // Fire notification on public messages
  if (!internalFlag) {
    const counterpartyId =
      dispute.raisedByUserId === user.id ? dispute.againstUserId : dispute.raisedByUserId;

    fireNotification({
      userId: counterpartyId,
      type: 'dispute_message',
      priority: 'normal',
      title: 'New reply on your dispute',
      message: `${displayNameOf(user)} replied on the dispute for ${dispute.requestRef}.`,
      linkTo: dispute.againstRole === 'CLIENT'
        ? '/client/dashboard?tab=support'
        : '/provider/dashboard?tab=support',
      actorId: user.id,
      actorDisplayName: displayNameOf(user),
      bookingId: dispute.bookingId,
    });
  }

  res.success(
    {
      message: {
        id: message.id,
        authorId: message.authorId,
        authorDisplayName: message.authorDisplayName,
        authorRole: message.authorRole,
        text: message.text,
        internal: message.internal,
        createdAt: message.createdAt.toISOString(),
      },
    },
    'Message added'
  );
});

// ==================== REQUEST INFO (staff only) ====================
export const requestInfo = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (!isStaff(user.role)) return res.error('Staff only', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const dispute = await Dispute.findByPk(id);
  if (!dispute) return res.error('Dispute not found', 404, 'NOT_FOUND');

  await dispute.update({ status: 'awaiting_info' });

  await DisputeMessage.create({
    disputeId: dispute.id,
    authorId: user.id,
    authorDisplayName: displayNameOf(user),
    authorRole: user.role as 'EMPLOYEE' | 'ADMIN',
    text: 'We need more information to continue. Please respond to this thread with any details or evidence you think is relevant.',
    internal: false,
  });

  // Notify both parties
  for (const recipientId of [dispute.raisedByUserId, dispute.againstUserId]) {
    fireNotification({
      userId: recipientId,
      type: 'dispute_message',
      priority: 'high',
      title: 'More info needed',
      message: `Support needs more information about the dispute for ${dispute.requestRef}.`,
      linkTo: dispute.raisedByRole === 'CLIENT' || dispute.againstRole === 'CLIENT'
        ? '/client/dashboard?tab=support'
        : '/provider/dashboard?tab=support',
      actorId: user.id,
      actorDisplayName: displayNameOf(user),
      bookingId: dispute.bookingId,
    });
  }

  res.success({ dispute: await toApi(dispute) }, 'Requested more info');
});

// ==================== RESOLVE (staff only) ====================
export const resolveDispute = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (!isStaff(user.role)) return res.error('Staff only', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { resolution, resolutionNote, finalBookingStatus } = req.body;

  if (!resolution || !resolutionNote || !String(resolutionNote).trim()) {
    return res.error('resolution and resolutionNote are required', 400, 'MISSING_FIELDS');
  }

  const dispute = await Dispute.findByPk(id);
  if (!dispute) return res.error('Dispute not found', 404, 'NOT_FOUND');
  if (dispute.status === 'resolved' || dispute.status === 'closed') {
    return res.error('Dispute already resolved', 400, 'ALREADY_RESOLVED');
  }

  const newStatus = resolution === 'no_action' ? 'closed' : 'resolved';

  await dispute.update({
    status: newStatus,
    resolution,
    finalBookingStatus: finalBookingStatus ?? null,
    resolutionNote: String(resolutionNote).trim(),
    resolvedByUserId: user.id,
    resolvedByDisplayName: displayNameOf(user),
    resolvedAt: new Date(),
  });

  // Apply booking status change if provided
  if (finalBookingStatus) {
    const booking = await Booking.findByPk(dispute.bookingId);
    if (booking) {
      await booking.update({ status: finalBookingStatus });
    }
  }

  // Post public resolution message
  await DisputeMessage.create({
    disputeId: dispute.id,
    authorId: user.id,
    authorDisplayName: 'ServiceConnect',
    authorRole: 'SYSTEM',
    text: `Dispute resolved: ${resolution}. ${String(resolutionNote).trim()}`,
    internal: false,
  });

  // Notify both parties
  for (const recipientId of [dispute.raisedByUserId, dispute.againstUserId]) {
    fireNotification({
      userId: recipientId,
      type: 'dispute_raised',
      priority: 'high',
      title: 'Dispute resolved',
      message: `Support has resolved the dispute for ${dispute.requestRef}. Outcome: ${resolution}.`,
      linkTo: dispute.raisedByRole === 'CLIENT' || dispute.againstRole === 'CLIENT'
        ? '/client/dashboard?tab=support'
        : '/provider/dashboard?tab=support',
      actorId: user.id,
      actorDisplayName: displayNameOf(user),
      bookingId: dispute.bookingId,
    });
  }

  logger.info(`Dispute ${dispute.id} resolved by ${user.email}: ${resolution}`);

  res.success({ dispute: await toApi(dispute) }, 'Dispute resolved');
});

// ==================== GET DISPUTE BY BOOKING ====================
export const getDisputeByBooking = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const bookingIdParam = req.params.bookingId;
  const bookingId = Array.isArray(bookingIdParam) ? bookingIdParam[0] : bookingIdParam;

  const dispute = await Dispute.findOne({
    where: { bookingId },
    order: [['createdAt', 'DESC']],
  });

  if (!dispute) {
    return res.success({ dispute: null }, 'No dispute for this booking');
  }

  if (!isStaff(user.role)) {
    if (dispute.raisedByUserId !== user.id && dispute.againstUserId !== user.id) {
      return res.error('Forbidden', 403, 'FORBIDDEN');
    }
  }

  res.success({ dispute: await toApi(dispute) }, 'Dispute retrieved');
});