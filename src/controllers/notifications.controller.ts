// src/controllers/notifications.controller.ts
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Notification from '../models/Notification';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';

// ============================================================
// MAPPER
// ============================================================
function toApi(n: Notification) {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    priority: n.priority,
    title: n.title,
    message: n.message,
    linkTo: n.linkTo,
    actorId: n.actorId ?? undefined,
    actorDisplayName: n.actorDisplayName ?? undefined,
    bookingId: n.bookingId ?? undefined,
    workSessionId: n.workSessionId ?? undefined,
    threadId: n.threadId ?? undefined,
    readAt: n.readAt?.toISOString(),
    createdAt: n.createdAt.toISOString(),
  };
}

// ==================== GET MY NOTIFICATIONS ====================
export const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const unreadOnly = req.query.unread === 'true';

  const where: any = { userId: user.id };
  if (unreadOnly) where.readAt = { [Op.is]: null };

  const notifications = await Notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
  });

  const unreadCount = await Notification.count({
    where: { userId: user.id, readAt: { [Op.is]: null } },
  });

  res.success(
    {
      notifications: notifications.map(toApi),
      unreadCount,
    },
    'Notifications retrieved'
  );
});

// ==================== MARK ONE READ ====================
export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const n = await Notification.findByPk(id);
  if (!n) return res.error('Notification not found', 404, 'NOT_FOUND');
  if (n.userId !== user.id) return res.error('Forbidden', 403, 'FORBIDDEN');

  if (!n.readAt) {
    await n.update({ readAt: new Date() });
  }

  res.success({ notification: toApi(n) }, 'Marked as read');
});

// ==================== MARK ALL READ ====================
export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  await Notification.update(
    { readAt: new Date() },
    { where: { userId: user.id, readAt: { [Op.is]: null } } }
  );

  res.success({}, 'All marked as read');
});

// ==================== DELETE ONE ====================
export const deleteOne = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const n = await Notification.findByPk(id);
  if (!n) return res.error('Notification not found', 404, 'NOT_FOUND');
  if (n.userId !== user.id) return res.error('Forbidden', 403, 'FORBIDDEN');

  await n.destroy();
  res.success({ id }, 'Notification deleted');
});

// ==================== CLEAR ALL ====================
export const clearAll = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  await Notification.destroy({ where: { userId: user.id } });

  res.success({}, 'All notifications cleared');
});

// ============================================================
// INTERNAL HELPER — used by other controllers to create notifications
// ============================================================
export async function createNotification(input: {
  userId: string;
  type: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  message: string;
  linkTo: string;
  actorId?: string;
  actorDisplayName?: string;
  bookingId?: string;
  workSessionId?: string;
  threadId?: string;
}): Promise<Notification> {
  return Notification.create({
    userId: input.userId,
    type: input.type,
    priority: input.priority ?? 'normal',
    title: input.title,
    message: input.message,
    linkTo: input.linkTo,
    actorId: input.actorId,
    actorDisplayName: input.actorDisplayName,
    bookingId: input.bookingId,
    workSessionId: input.workSessionId,
    threadId: input.threadId,
  });
}