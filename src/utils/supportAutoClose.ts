// src/utils/supportAutoClose.ts
import { Op } from 'sequelize';
import SupportTicket from '../models/SupportTicket';
import logger from './logger';

/**
 * Closes every `open`/`claimed` ticket whose `autoCloseAt` has passed.
 * Idempotent — safe to call on every list request AND from a scheduler.
 *
 * Bulk `update()` bypasses the model's `beforeValidate` hook, so we set
 * `closedAt` explicitly here.
 */
export async function closeStaleSupportTickets(): Promise<number> {
  const now = new Date();
  const [count] = await SupportTicket.update(
    { status: 'closed', closedAt: now },
    {
      where: {
        status: { [Op.in]: ['open', 'claimed'] },
        autoCloseAt: { [Op.lt]: now },
      },
    }
  );

  if (count > 0) {
    logger.info(`[support] auto-closed ${count} stale ticket(s)`);
  }
  return count;
}