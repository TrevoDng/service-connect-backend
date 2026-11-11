// src/controllers/support.controller.ts
import { Request, Response } from 'express';
import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database.config';
import SupportTicket from '../models/SupportTicket';
import SupportMessage from '../models/SupportMessage';
import User from '../models/User';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';
import { createNotification, notifyStaff } from './notifications.controller';
import { closeStaleSupportTickets } from '../utils/supportAutoClose';
import type { ChatAttachment } from '../models/ChatMessage';
import { emit } from '../utils/sseRegistry';
import { emitStaffEvent } from '../services/sse.services';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const SUPPORT_DISPLAY_NAME = 'ServiceConnect Support';

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

function previewOf(
  text: string,
  attachments?: ChatAttachment[] | null
): string {
  const trimmed = (text ?? '').trim();
  if (trimmed) {
    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
  }
  const count = attachments?.length ?? 0;
  if (count === 1) return '📎 Attachment';
  if (count > 1) return `📎 ${count} attachments`;
  return '';
}

function linkForRequester(ticketId: string, role: 'CLIENT' | 'PROVIDER'): string {
  return role === 'CLIENT'
    ? `/client/dashboard?tab=help&ticket=${ticketId}`
    : `/provider/dashboard?tab=help&ticket=${ticketId}`;
}

// replace the helper
const linkForStaff = (ticketId: string, role: 'ADMIN' | 'EMPLOYEE') =>
  role === 'ADMIN'
    ? `/admin-dashboard?tab=support-tickets&ticket=${ticketId}`
    : `/employee-dashboard?tab=support-tickets&ticket=${ticketId}`;

function isStaffRole(role: string): boolean {
  return role === 'ADMIN' || role === 'EMPLOYEE';
}

function toMessageApi(m: SupportMessage) {
  return {
    id: m.id,
    ticketId: m.ticketId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    text: m.text,
    attachments: m.attachments ?? undefined,
    sentAt: m.sentAt.toISOString(),
    status: m.status,
    readAt: m.readAt?.toISOString(),
  };
}

// --------------------------------------------
// API mappers
// --------------------------------------------

interface TicketRequesterView {
  id: string;
  status: string;
  subject?: string;
  lastActivityAt: string;
  lastMessagePreview: string;
  autoCloseAt: string;
  closedAt?: string;
  assignedAt?: string;
  assigned: boolean; // true → someone is handling it
  unreadCount: number;
  createdAt: string;
}

interface TicketStaffView extends TicketRequesterView {
  requester: {
    id: string;
    displayName: string;
    email: string;
    role: 'CLIENT' | 'PROVIDER';
    avatarGradient: string;
  };
  assignedStaffId?: string;
  assignedStaffDisplayName?: string;
  isMine: boolean;
  canReply: boolean;
}

function toRequesterView(
  t: SupportTicket,
  unreadCount: number
): TicketRequesterView {
  return {
    id: t.id,
    status: t.status,
    subject: t.subject ?? undefined,
    lastActivityAt: t.lastActivityAt.toISOString(),
    lastMessagePreview: t.lastMessagePreview ?? '',
    autoCloseAt: t.autoCloseAt.toISOString(),
    closedAt: t.closedAt?.toISOString(),
    assignedAt: t.assignedAt?.toISOString(),
    assigned: !!t.assignedStaffId,
    unreadCount,
    createdAt: t.createdAt.toISOString(),
  };
}

function toStaffView(
  t: SupportTicket,
  requesterUser: User | undefined,
  assignedUser: User | undefined,
  unreadCount: number,
  viewerId: string
): TicketStaffView {
  const requesterRole: 'CLIENT' | 'PROVIDER' =
    t.requesterRole === 'PROVIDER' ? 'PROVIDER' : 'CLIENT';
  return {
    ...toRequesterView(t, unreadCount),
    requester: {
      id: t.requesterId,
      displayName: requesterUser ? displayNameOf(requesterUser) : 'Unknown',
      email: requesterUser?.email ?? '',
      role: requesterRole,
      avatarGradient: avatarGradientForRole(requesterRole),
    },
    assignedStaffId: t.assignedStaffId ?? undefined,
    assignedStaffDisplayName: assignedUser
      ? displayNameOf(assignedUser)
      : undefined,
    isMine: t.assignedStaffId === viewerId,
    canReply: t.status !== 'closed' && t.assignedStaffId === viewerId,
  };
}

// --------------------------------------------
// Batch helpers
// --------------------------------------------

async function unreadCountsForRequester(
  ticketIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ticketIds.length === 0) return map;

  const rows = await SupportMessage.findAll({
    attributes: [
      'ticketId',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: {
      ticketId: { [Op.in]: ticketIds },
      senderRole: { [Op.in]: ['ADMIN', 'EMPLOYEE'] },
      status: { [Op.ne]: 'read' },
    },
    group: ['ticketId'],
    raw: true,
  });

  for (const r of rows as unknown as Array<{ ticketId: string; count: string }>) {
    map.set(r.ticketId, Number(r.count));
  }
  ticketIds.forEach((id) => {
    if (!map.has(id)) map.set(id, 0);
  });
  return map;
}

async function unreadCountsForStaff(
  ticketIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ticketIds.length === 0) return map;

  const rows = await SupportMessage.findAll({
    attributes: [
      'ticketId',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: {
      ticketId: { [Op.in]: ticketIds },
      senderRole: { [Op.in]: ['CLIENT', 'PROVIDER'] },
      status: { [Op.ne]: 'read' },
    },
    group: ['ticketId'],
    raw: true,
  });

  for (const r of rows as unknown as Array<{ ticketId: string; count: string }>) {
    map.set(r.ticketId, Number(r.count));
  }
  ticketIds.forEach((id) => {
    if (!map.has(id)) map.set(id, 0);
  });
  return map;
}

async function loadUsersById(ids: string[]): Promise<Map<string, User>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const users = await User.findAll({ where: { id: { [Op.in]: unique } } });
  return new Map(users.map((u) => [u.id, u]));
}

async function findTicketOr404(
  rawId: string | string[] | undefined,
  res: Response
): Promise<SupportTicket | null> {
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) {
    res.error('Ticket id is required', 400, 'MISSING_TICKET_ID');
    return null;
  }
  const ticket = await SupportTicket.findByPk(id);
  if (!ticket) {
    res.error('Support ticket not found', 404, 'TICKET_NOT_FOUND');
    return null;
  }
  return ticket;
}

// ============================================================
// REQUESTER ENDPOINTS
// ============================================================

export const createTicket = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT' && user.role !== 'PROVIDER') {
    return res.error(
      'Only clients and providers can open support tickets',
      403,
      'FORBIDDEN'
    );
  }

  const { subject, text, attachments } = req.body as {
    subject?: string;
    text?: string;
    attachments?: ChatAttachment[];
  };

  const trimmed = typeof text === 'string' ? text.trim() : '';
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if (!trimmed && !hasAttachments) {
    return res.error(
      'First message must include text or attachments',
      400,
      'EMPTY_MESSAGE'
    );
  }

  const now = new Date();
  const autoCloseAt = new Date(now.getTime() + TWELVE_HOURS_MS);

  const { ticket, message } = await sequelize.transaction(
    async (tx: Transaction) => {
      const t = await SupportTicket.create(
        {
          requesterId: user.id,
          requesterRole: user.role as 'CLIENT' | 'PROVIDER',
          subject: subject?.toString().slice(0, 200) ?? null,
          status: 'open',
          lastActivityAt: now,
          lastMessagePreview: previewOf(trimmed, attachments),
          autoCloseAt,
          closedAt: null,
        },
        { transaction: tx }
      );

      const m = await SupportMessage.create(
        {
          ticketId: t.id,
          senderId: user.id,
          senderRole: user.role as 'CLIENT' | 'PROVIDER',
          text: trimmed,
          attachments: hasAttachments ? attachments! : null,
          sentAt: now,
          status: 'sent',
        },
        { transaction: tx }
      );

      return { ticket: t, message: m };
    }
  );

  // New tickets start unassigned → notify every active staff member
  const requesterName = displayNameOf(user);
  notifyStaff({
    type: 'support_ticket_new',
    title: `New support ticket from ${requesterName}`,
    message: previewOf(trimmed, attachments) || 'New ticket opened',
    linkTo: linkForStaff(ticket.id, 'ADMIN'),
    linkToByRole: {
      ADMIN: linkForStaff(ticket.id, 'ADMIN'),
      EMPLOYEE: linkForStaff(ticket.id, 'EMPLOYEE'),
    },
    actorId: user.id,
    actorDisplayName: requesterName,
    threadId: ticket.id,
  }).catch((err) =>
    logger.error('Failed to notify staff of new support ticket', err)
  );

    void emitStaffEvent('support:ticket:new', {
        ticketId: ticket.id,
        requesterName,
        preview: previewOf(trimmed, attachments),
        subject: ticket.subject ?? null,
    });

  logger.info(`Support ticket ${ticket.id} created by ${user.email}`);

  res.status(201).success(
    {
      ticket: toRequesterView(ticket, 0),
      message: toMessageApi(message),
    },
    'Support ticket created'
  );
});

export const getMyTickets = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT' && user.role !== 'PROVIDER') {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  await closeStaleSupportTickets();

  const tickets = await SupportTicket.findAll({
    where: { requesterId: user.id },
    order: [['lastActivityAt', 'DESC']],
    limit: 200,
  });

  const ids = tickets.map((t) => t.id);
  const unread = await unreadCountsForRequester(ids);

  res.success(
    {
      tickets: tickets.map((t) =>
        toRequesterView(t, unread.get(t.id) ?? 0)
      ),
    },
    'Tickets retrieved'
  );
});

export const getMyTicket = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const ticket = await findTicketOr404(req.params.id, res);
  if (!ticket) return;

  if (ticket.requesterId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const unread = await unreadCountsForRequester([ticket.id]);
  res.success(
    { ticket: toRequesterView(ticket, unread.get(ticket.id) ?? 0) },
    'Ticket retrieved'
  );
});

export const getMyTicketMessages = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

    const ticket = await findTicketOr404(req.params.id, res);
    if (!ticket) return;

    if (ticket.requesterId !== user.id) {
      return res.error('Forbidden', 403, 'FORBIDDEN');
    }

    const messages = await SupportMessage.findAll({
      where: { ticketId: ticket.id },
      order: [['sentAt', 'ASC']],
      limit: 500,
    });

    res.success(
      { messages: messages.map(toMessageApi) },
      'Messages retrieved'
    );
  }
);

export const postRequesterMessage = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
    if (user.role !== 'CLIENT' && user.role !== 'PROVIDER') {
      return res.error('Forbidden', 403, 'FORBIDDEN');
    }

    const ticket = await findTicketOr404(req.params.id, res);
    if (!ticket) return;

    if (ticket.requesterId !== user.id) {
      return res.error('Forbidden', 403, 'FORBIDDEN');
    }

    const { text, attachments } = req.body as {
      text?: string;
      attachments?: ChatAttachment[];
    };
    const trimmed = typeof text === 'string' ? text.trim() : '';
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!trimmed && !hasAttachments) {
      return res.error(
        'Message must have text or attachments',
        400,
        'EMPTY_MESSAGE'
      );
    }

    const now = new Date();
    const autoCloseAt = new Date(now.getTime() + TWELVE_HOURS_MS);

    const message = await sequelize.transaction(async (tx) => {
      const m = await SupportMessage.create(
        {
          ticketId: ticket.id,
          senderId: user.id,
          senderRole: user.role as 'CLIENT' | 'PROVIDER',
          text: trimmed,
          attachments: hasAttachments ? attachments! : null,
          sentAt: now,
          status: 'sent',
        },
        { transaction: tx }
      );

      // Reset the auto-close clock and auto-reopen if needed.
      const updates: Partial<SupportTicket> = {
        lastActivityAt: now,
        lastMessagePreview: previewOf(trimmed, attachments),
        autoCloseAt,
      } as Partial<SupportTicket>;

      if (ticket.status === 'closed') {
        // Keep the assigned staff member if any; else back into the pool.
        (updates as any).status = ticket.assignedStaffId ? 'claimed' : 'open';
        (updates as any).closedAt = null;
      }

      await ticket.update(updates, { transaction: tx });
      return m;
    });

    // Notify the assigned staff (if any), else broadcast to all staff.
    const snippet = previewOf(trimmed, attachments) || 'New message';
    const requesterName = displayNameOf(user);
    

    if (ticket.assignedStaffId) {
        const assignedStaff = await User.findByPk(ticket.assignedStaffId);
        const staffRole: 'ADMIN' | 'EMPLOYEE' =
    assignedStaff?.role === 'EMPLOYEE' ? 'EMPLOYEE' : 'ADMIN';

      fireNotification({
        userId: ticket.assignedStaffId,
        type: 'support_message',
        priority: 'normal',
        title: `New message from ${requesterName}`,
        message: snippet,
        linkTo: linkForStaff(ticket.id, staffRole),
        actorId: user.id,
        actorDisplayName: requesterName,
        threadId: ticket.id,
      });

      emit(ticket.assignedStaffId, 'support:message:new', {
        ticketId: ticket.id,
        senderRole: user.role,
        senderName: requesterName,
        preview: snippet,
      });
    } else {
      notifyStaff({
        type: 'support_message',
        title: `Unassigned ticket — new message from ${requesterName}`,
        message: snippet,
        linkTo: linkForStaff(ticket.id, 'ADMIN'),
        linkToByRole: {
          ADMIN: linkForStaff(ticket.id, 'ADMIN'),
          EMPLOYEE: linkForStaff(ticket.id, 'EMPLOYEE'),
        },  
        actorId: user.id,
        actorDisplayName: requesterName,
        threadId: ticket.id,
      }).catch((err) =>
        logger.error('Failed to notify staff of support message', err)
      );

      void emitStaffEvent('support:message:new', {
        ticketId: ticket.id,
        senderRole: user.role,
        senderName: requesterName,
        preview: snippet,
        });
    }

    res.status(201).success(
      { message: toMessageApi(message) },
      'Message sent'
    );
  }
);

export const markMyTicketRead = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

    const ticket = await findTicketOr404(req.params.id, res);
    if (!ticket) return;

    if (ticket.requesterId !== user.id) {
      return res.error('Forbidden', 403, 'FORBIDDEN');
    }

    const [updated] = await SupportMessage.update(
      { status: 'read', readAt: new Date() },
      {
        where: {
          ticketId: ticket.id,
          senderRole: { [Op.in]: ['ADMIN', 'EMPLOYEE'] },
          status: { [Op.ne]: 'read' },
        },
      }
    );

    res.success({ updated }, 'Marked as read');
  }
);

// ============================================================
// STAFF ENDPOINTS
// ============================================================

export const getStaffTickets = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (!isStaffRole(user.role)) {
    return res.error('Staff only', 403, 'FORBIDDEN');
  }

  await closeStaleSupportTickets();

  const statusFilter = (req.query.status as string | undefined) ?? 'active';
  const assignedToMe = req.query.assignedToMe === 'true';
  const unassigned = req.query.unassigned === 'true';

  const where: Record<string, unknown> = {};
  if (statusFilter === 'active') {
    where.status = { [Op.in]: ['open', 'claimed'] };
  } else if (statusFilter !== 'all') {
    where.status = statusFilter;
  }
  if (assignedToMe) where.assignedStaffId = user.id;
  if (unassigned) where.assignedStaffId = { [Op.is]: null };

  const tickets = await SupportTicket.findAll({
    where,
    order: [['lastActivityAt', 'DESC']],
    limit: 200,
  });

  const ids = tickets.map((t) => t.id);
  const userIds: string[] = [];
  tickets.forEach((t) => {
    userIds.push(t.requesterId);
    if (t.assignedStaffId) userIds.push(t.assignedStaffId);
  });

  const [unread, usersById] = await Promise.all([
    unreadCountsForStaff(ids),
    loadUsersById(userIds),
  ]);

  res.success(
    {
      tickets: tickets.map((t) =>
        toStaffView(
          t,
          usersById.get(t.requesterId),
          t.assignedStaffId ? usersById.get(t.assignedStaffId) : undefined,
          unread.get(t.id) ?? 0,
          user.id
        )
      ),
    },
    'Tickets retrieved'
  );
});

export const getStaffTicketMessages = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
    if (!isStaffRole(user.role)) {
      return res.error('Staff only', 403, 'FORBIDDEN');
    }

    const ticket = await findTicketOr404(req.params.id, res);
    if (!ticket) return;

    const messages = await SupportMessage.findAll({
      where: { ticketId: ticket.id },
      order: [['sentAt', 'ASC']],
      limit: 500,
    });

    res.success(
      { messages: messages.map(toMessageApi) },
      'Messages retrieved'
    );
  }
);

export const claimTicket = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (!isStaffRole(user.role)) {
    return res.error('Staff only', 403, 'FORBIDDEN');
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  // Atomic claim — SELECT ... FOR UPDATE prevents double-claim races.
  type Outcome = { ticket?: SupportTicket; reason?: string };
  const outcome = await sequelize.transaction<Outcome>(async (tx) => {
    const ticket = await SupportTicket.findByPk(id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!ticket) return { reason: 'NOT_FOUND' };
    if (ticket.status === 'closed') return { reason: 'TICKET_CLOSED' };
    if (ticket.assignedStaffId === user.id) return { ticket }; // idempotent
    if (ticket.assignedStaffId) return { reason: 'ALREADY_CLAIMED' };

    await ticket.update(
      {
        status: 'claimed',
        assignedStaffId: user.id,
        assignedAt: new Date(),
      },
      { transaction: tx }
    );
    return { ticket };
  });

  if (outcome.reason === 'NOT_FOUND') {
    return res.error('Support ticket not found', 404, 'TICKET_NOT_FOUND');
  }
  if (outcome.reason === 'TICKET_CLOSED') {
    return res.error('Cannot claim a closed ticket', 400, 'TICKET_CLOSED');
  }
  if (outcome.reason === 'ALREADY_CLAIMED') {
    return res.error(
      'Ticket is already claimed by another staff member',
      409,
      'ALREADY_CLAIMED'
    );
  }

  const ticket = outcome.ticket!;
  logger.info(`Support ticket ${ticket.id} claimed by ${user.email}`);

  const requester = await User.findByPk(ticket.requesterId);

    void emitStaffEvent('support:ticket:updated', {
        ticketId: ticket.id,
        status: 'claimed',
        assignedStaffId: user.id,
        assignedStaffDisplayName: displayNameOf(user),
    });

  res.success(
    { ticket: toStaffView(ticket, requester ?? undefined, user, 0, user.id) },
    'Ticket claimed'
  );
});

export const releaseTicket = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (!isStaffRole(user.role)) {
    return res.error('Staff only', 403, 'FORBIDDEN');
  }

  const ticket = await findTicketOr404(req.params.id, res);
  if (!ticket) return;

  if (ticket.assignedStaffId !== user.id) {
    return res.error(
      'Only the assigned staff member can release this ticket',
      403,
      'NOT_ASSIGNED'
    );
  }

  await ticket.update({
    status: 'open',
    assignedStaffId: null,
    assignedAt: null,
  });

  logger.info(`Support ticket ${ticket.id} released by ${user.email}`);

  const requester = await User.findByPk(ticket.requesterId);

   void emitStaffEvent('support:ticket:updated', {
    ticketId: ticket.id,
    status: 'open',
    assignedStaffId: null,
    assignedStaffDisplayName: null,
    });

  res.success(
    {
      ticket: toStaffView(
        ticket,
        requester ?? undefined,
        undefined,
        0,
        user.id
      ),
    },
    'Ticket released'
  );
});

export const postStaffMessage = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
    if (!isStaffRole(user.role)) {
      return res.error('Staff only', 403, 'FORBIDDEN');
    }

    const ticket = await findTicketOr404(req.params.id, res);
    if (!ticket) return;

    if (ticket.status === 'closed') {
      return res.error(
        'Ticket is closed — reopen it before replying',
        400,
        'TICKET_CLOSED'
      );
    }
    if (ticket.assignedStaffId !== user.id) {
      return res.error(
        'Only the assigned staff member can reply',
        403,
        'NOT_ASSIGNED'
      );
    }

    const { text, attachments } = req.body as {
      text?: string;
      attachments?: ChatAttachment[];
    };
    const trimmed = typeof text === 'string' ? text.trim() : '';
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!trimmed && !hasAttachments) {
      return res.error(
        'Message must have text or attachments',
        400,
        'EMPTY_MESSAGE'
      );
    }

    const now = new Date();
    const autoCloseAt = new Date(now.getTime() + TWELVE_HOURS_MS);

    const message = await sequelize.transaction(async (tx) => {
      const m = await SupportMessage.create(
        {
          ticketId: ticket.id,
          senderId: user.id,
          senderRole: user.role as 'ADMIN' | 'EMPLOYEE',
          text: trimmed,
          attachments: hasAttachments ? attachments! : null,
          sentAt: now,
          status: 'sent',
        },
        { transaction: tx }
      );

      await ticket.update(
        {
          lastActivityAt: now,
          lastMessagePreview: previewOf(trimmed, attachments),
          autoCloseAt,
        },
        { transaction: tx }
      );
      return m;
    });

    // Requester sees "ServiceConnect Support", never the individual staff name.
    fireNotification({
      userId: ticket.requesterId,
      type: 'support_message',
      priority: 'normal',
      title: 'New reply from ServiceConnect Support',
      message: previewOf(trimmed, attachments) || 'New message',
      linkTo: linkForRequester(
        ticket.id,
        ticket.requesterRole === 'PROVIDER' ? 'PROVIDER' : 'CLIENT'
      ),
      actorId: user.id,
      actorDisplayName: SUPPORT_DISPLAY_NAME,
      threadId: ticket.id,
    });

    emit(ticket.requesterId, 'support:message:new', {
        ticketId: ticket.id,
        senderRole: user.role,
        senderName: SUPPORT_DISPLAY_NAME,
        preview: previewOf(trimmed, attachments) || 'New message',
    });

    res.status(201).success(
      { message: toMessageApi(message) },
      'Message sent'
    );
  }
);

export const closeTicket = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (!isStaffRole(user.role)) {
    return res.error('Staff only', 403, 'FORBIDDEN');
  }

  const ticket = await findTicketOr404(req.params.id, res);
  if (!ticket) return;

  if (ticket.status !== 'closed') {
    await ticket.update({ status: 'closed', closedAt: new Date() });
    logger.info(`Support ticket ${ticket.id} closed by ${user.email}`);
  }

  const requester = await User.findByPk(ticket.requesterId);

    void emitStaffEvent('support:ticket:updated', {
        ticketId: ticket.id,
        status: 'closed',
        assignedStaffId: ticket.assignedStaffId ?? null,
        assignedStaffDisplayName: null,
    });

  res.success(
    {
      ticket: toStaffView(ticket, requester ?? undefined, undefined, 0, user.id),
    },
    'Ticket closed'
  );
});

export const reopenTicket = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (!isStaffRole(user.role)) {
    return res.error('Staff only', 403, 'FORBIDDEN');
  }

  const ticket = await findTicketOr404(req.params.id, res);
  if (!ticket) return;

  const autoCloseAt = new Date(Date.now() + TWELVE_HOURS_MS);

  // Reopen goes back to the pool — any staff member can claim it next.
  await ticket.update({
    status: 'open',
    assignedStaffId: null,
    assignedAt: null,
    closedAt: null,
    autoCloseAt,
  });

  logger.info(`Support ticket ${ticket.id} reopened by ${user.email}`);

  const requester = await User.findByPk(ticket.requesterId);

    void emitStaffEvent('support:ticket:updated', {
        ticketId: ticket.id,
        status: 'open',
        assignedStaffId: null,
        assignedStaffDisplayName: null,
        });
  res.success(
    {
      ticket: toStaffView(ticket, requester ?? undefined, undefined, 0, user.id),
    },
    'Ticket reopened'
  );
});

export const markStaffTicketRead = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
    if (!isStaffRole(user.role)) {
      return res.error('Staff only', 403, 'FORBIDDEN');
    }

    const ticket = await findTicketOr404(req.params.id, res);
    if (!ticket) return;

    const [updated] = await SupportMessage.update(
      { status: 'read', readAt: new Date() },
      {
        where: {
          ticketId: ticket.id,
          senderRole: { [Op.in]: ['CLIENT', 'PROVIDER'] },
          status: { [Op.ne]: 'read' },
        },
      }
    );

    res.success({ updated }, 'Marked as read');
  }
);