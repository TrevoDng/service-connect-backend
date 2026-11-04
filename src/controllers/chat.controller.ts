// src/controllers/chat.controller.ts
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '../config/database.config';
import ChatThread from '../models/ChatThread';
import ChatMessage from '../models/ChatMessage';
import User from '../models/User';
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

function avatarGradientForRole(role: string): string {
  if (role === 'PROVIDER') return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
  if (role === 'CLIENT') return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  return 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)';
}

function participantOf(user: User) {
  const role = user.role === 'PROVIDER' ? ('PROVIDER' as const) : ('CLIENT' as const);
  return {
    userId: user.id,
    displayName: displayNameOf(user),
    role,
    avatarGradient: avatarGradientForRole(user.role),
    providerVerified:
      user.role === 'PROVIDER' ? user.status === 'active' : undefined,
    // providerRating / providerCompletedJobs / providerCategories are
    // intentionally omitted for now — N+1 aggregates per thread. Frontend
    // treats them as optional and skips the corresponding UI.
  };
}

interface ThreadEnrichment {
  unreadCounts: Map<string, number>;
  usersById: Map<string, User>;
}

function toThreadApi(thread: ChatThread, env: ThreadEnrichment) {
  const clientUser = env.usersById.get(thread.clientId);
  const providerUser = env.usersById.get(thread.providerId);

  if (!clientUser || !providerUser) {
    // Defensive: user missing (deleted / corrupt id). Return a stub so the
    // frontend doesn't crash.
    return {
      id: thread.id,
      clientId: thread.clientId,
      providerId: thread.providerId,
      client: {
        userId: thread.clientId,
        displayName: 'Unknown client',
        role: 'CLIENT' as const,
      },
      provider: {
        userId: thread.providerId,
        displayName: 'Unknown provider',
        role: 'PROVIDER' as const,
      },
      createdAt: thread.createdAt.toISOString(),
      lastMessageAt: thread.lastMessageAt.toISOString(),
      lastMessagePreview: thread.lastMessagePreview ?? '',
      unreadCount: 0,
      linkedBookingId: thread.linkedBookingId ?? undefined,
    };
  }

  return {
    id: thread.id,
    clientId: thread.clientId,
    providerId: thread.providerId,
    client: participantOf(clientUser),
    provider: participantOf(providerUser),
    createdAt: thread.createdAt.toISOString(),
    lastMessageAt: thread.lastMessageAt.toISOString(),
    lastMessagePreview: thread.lastMessagePreview ?? '',
    unreadCount: env.unreadCounts.get(thread.id) ?? 0,
    linkedBookingId: thread.linkedBookingId ?? undefined,
  };
}

function toMessageApi(m: ChatMessage) {
  return {
    id: m.id,
    threadId: m.threadId,
    senderId: m.senderId,
    text: m.text,
    attachments: m.attachments ?? undefined,
    sentAt: m.sentAt.toISOString(),
    status: m.status,
    readAt: m.readAt?.toISOString(),
  };
}

async function getUnreadCountsForViewer(
  viewerId: string | null,
  threadIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!viewerId || threadIds.length === 0) {
    threadIds.forEach((id) => map.set(id, 0));
    return map;
  }

  const rows = await ChatMessage.findAll({
    attributes: [
      'threadId',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: {
      threadId: { [Op.in]: threadIds },
      senderId: { [Op.ne]: viewerId },
      status: { [Op.ne]: 'read' },
    },
    group: ['threadId'],
    raw: true,
  });

  for (const row of rows as unknown as Array<{ threadId: string; count: string }>) {
    map.set(row.threadId, Number(row.count));
  }
  threadIds.forEach((id) => {
    if (!map.has(id)) map.set(id, 0);
  });
  return map;
}

async function loadUsersById(ids: string[]): Promise<Map<string, User>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const users = await User.findAll({ where: { id: { [Op.in]: unique } } });
  return new Map(users.map((u) => [u.id, u]));
}

async function enrichThreads(
  threads: ChatThread[],
  viewerId: string | null
): Promise<ThreadEnrichment> {
  const threadIds = threads.map((t) => t.id);
  const userIds: string[] = [];
  threads.forEach((t) => userIds.push(t.clientId, t.providerId));

  const [unreadCounts, usersById] = await Promise.all([
    getUnreadCountsForViewer(viewerId, threadIds),
    loadUsersById(userIds),
  ]);
  return { unreadCounts, usersById };
}

// ============================================================
// POST /api/chat/threads — create or get thread
// ============================================================

export const createOrGetThread = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const { clientId, providerId, linkedBookingId } = req.body;

  if (!clientId || !providerId) {
    return res.error('clientId and providerId are required', 400, 'MISSING_FIELDS');
  }

  if (user.id !== clientId && user.id !== providerId) {
    return res.error('You can only start threads you are part of', 403, 'FORBIDDEN');
  }

  const [clientUser, providerUser] = await Promise.all([
    User.findByPk(clientId),
    User.findByPk(providerId),
  ]);
  if (!clientUser || clientUser.role !== 'CLIENT') {
    return res.error('clientId must reference a CLIENT user', 400, 'INVALID_CLIENT');
  }
  if (!providerUser || providerUser.role !== 'PROVIDER') {
    return res.error('providerId must reference a PROVIDER user', 400, 'INVALID_PROVIDER');
  }

  let thread = await ChatThread.findOne({ where: { clientId, providerId } });

  if (!thread) {
    thread = await ChatThread.create({
      clientId,
      providerId,
      linkedBookingId: linkedBookingId ?? null,
      lastMessageAt: new Date(),
      lastMessagePreview: '',
    });
    logger.info(`Chat thread ${thread.id} created: ${clientId} ↔ ${providerId}`);
  }

  const env = await enrichThreads([thread], user.id);
  res.success({ thread: toThreadApi(thread, env) }, 'Thread ready');
});

// ============================================================
// GET /api/chat/threads — my threads
// ============================================================

export const getMyThreads = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  if (user.role !== 'CLIENT' && user.role !== 'PROVIDER') {
    return res.error(
      'Chat is available to clients and providers only',
      403,
      'FORBIDDEN'
    );
  }

  const threads = await ChatThread.findAll({
    where: {
      [Op.or]: [{ clientId: user.id }, { providerId: user.id }],
    },
    order: [['lastMessageAt', 'DESC']],
  });

  const env = await enrichThreads(threads, user.id);
  res.success({ threads: threads.map((t) => toThreadApi(t, env)) }, 'Threads retrieved');
});

// ============================================================
// GET /api/chat/threads/:id/messages
// ============================================================

export const getThreadMessages = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.id;
  const threadId = Array.isArray(idParam) ? idParam[0] : idParam;

  const thread = await ChatThread.findByPk(threadId);
  if (!thread) return res.error('Thread not found', 404, 'THREAD_NOT_FOUND');

  if (thread.clientId !== user.id && thread.providerId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const messages = await ChatMessage.findAll({
    where: { threadId },
    order: [['sentAt', 'ASC']],
    limit: 200,
  });

  res.success({ messages: messages.map(toMessageApi) }, 'Messages retrieved');
});

// ============================================================
// POST /api/chat/threads/:id/messages — send message
// ============================================================

export const postMessage = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT' && user.role !== 'PROVIDER') {
    return res.error(
      'Only clients and providers can send chat messages',
      403,
      'FORBIDDEN'
    );
  }

  const idParam = req.params.id;
  const threadId = Array.isArray(idParam) ? idParam[0] : idParam;
  const { text, attachments } = req.body;

  const trimmed = typeof text === 'string' ? text.trim() : '';
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!trimmed && !hasAttachments) {
    return res.error(
      'Message must have text or attachments',
      400,
      'EMPTY_MESSAGE'
    );
  }

  const thread = await ChatThread.findByPk(threadId);
  if (!thread) return res.error('Thread not found', 404, 'THREAD_NOT_FOUND');

  if (thread.clientId !== user.id && thread.providerId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const now = new Date();

  const message = await ChatMessage.create({
    threadId,
    senderId: user.id,
    text: trimmed,
    attachments: hasAttachments ? attachments : null,
    sentAt: now,
    status: 'sent',
  });

  const preview = trimmed.length > 0
    ? trimmed.length > 80
      ? `${trimmed.slice(0, 77)}…`
      : trimmed
    : hasAttachments
    ? attachments.length === 1
      ? '📎 Attachment'
      : `📎 ${attachments.length} attachments`
    : '';

  await thread.update({ lastMessageAt: now, lastMessagePreview: preview });

  // Fire notification to the other party
  const recipientId =
    thread.clientId === user.id ? thread.providerId : thread.clientId;
  const recipientRole =
    thread.clientId === user.id ? 'PROVIDER' : 'CLIENT';
  const senderName = displayNameOf(user);
  const snippet = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;

  if (recipientId && recipientId !== user.id) {
    fireNotification({
      userId: recipientId,
      type: 'chat_message',
      priority: 'normal',
      title: `New message from ${senderName}`,
      message: snippet || 'Sent an attachment',
      linkTo:
        recipientRole === 'CLIENT'
          ? `/client/dashboard?tab=messages&thread=${threadId}`
          : `/provider/dashboard?tab=messages&thread=${threadId}`,
      actorId: user.id,
      actorDisplayName: senderName,
      threadId,
    });
  }

  logger.info(`Chat message ${message.id} in thread ${threadId} from ${user.email}`);

  res.status(201).success({ message: toMessageApi(message) }, 'Message sent');
});

// ============================================================
// POST /api/chat/threads/:id/read — mark thread read
// ============================================================

export const markThreadRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.id;
  const threadId = Array.isArray(idParam) ? idParam[0] : idParam;

  const thread = await ChatThread.findByPk(threadId);
  if (!thread) return res.error('Thread not found', 404, 'THREAD_NOT_FOUND');

  if (thread.clientId !== user.id && thread.providerId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const now = new Date();
  const [updated] = await ChatMessage.update(
    { status: 'read', readAt: now },
    {
      where: {
        threadId,
        senderId: { [Op.ne]: user.id },
        status: { [Op.ne]: 'read' },
      },
    }
  );

  res.success({ updated }, 'Thread marked read');
});

// ============================================================
// STAFF OBSERVER — mounted under /api/admin
// ============================================================

export const getAllThreadsForStaff = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
    if (user.role !== 'ADMIN' && user.role !== 'EMPLOYEE') {
      return res.error('Staff only', 403, 'FORBIDDEN');
    }

    const threads = await ChatThread.findAll({
      order: [['lastMessageAt', 'DESC']],
      limit: 200,
    });

    // viewerId = null → unreadCount 0 for every thread (observer has no inbox)
    const env = await enrichThreads(threads, null);
    res.success(
      { threads: threads.map((t) => toThreadApi(t, env)) },
      'Threads retrieved'
    );
  }
);

export const getThreadMessagesForStaff = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
    if (user.role !== 'ADMIN' && user.role !== 'EMPLOYEE') {
      return res.error('Staff only', 403, 'FORBIDDEN');
    }

    const idParam = req.params.id;
    const threadId = Array.isArray(idParam) ? idParam[0] : idParam;

    const thread = await ChatThread.findByPk(threadId);
    if (!thread) return res.error('Thread not found', 404, 'THREAD_NOT_FOUND');

    const messages = await ChatMessage.findAll({
      where: { threadId },
      order: [['sentAt', 'ASC']],
      limit: 200,
    });

    res.success({ messages: messages.map(toMessageApi) }, 'Messages retrieved');
  }
);