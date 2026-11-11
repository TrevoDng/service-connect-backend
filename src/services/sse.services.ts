import { emit, emitMany } from '../utils/sseRegistry';
import User from '../models/User';
import { Op } from 'sequelize';
import logger from '../utils/logger';

export function emitBookingUpdate(b: { id: string; clientId: string; providerId: string; status: string }) {
  const payload = { bookingId: b.id, status: b.status };
  emit(b.clientId, 'booking:updated', payload);
  emit(b.providerId, 'booking:updated', payload);
}

export function emitSessionUpdate(s: { id: string; bookingId: string; clientId: string; providerId: string; status: string }) {
  const payload = { workSessionId: s.id, bookingId: s.bookingId, status: s.status };
  emit(s.clientId, 'worksession:updated', payload);
  emit(s.providerId, 'worksession:updated', payload);
}

/** Broadcast an event to every active ADMIN + EMPLOYEE. */
export async function emitStaffEvent(event: string, data: unknown): Promise<void> {
  try {
    const staff = await User.findAll({
      where: { role: { [Op.in]: ['ADMIN', 'EMPLOYEE'] }, status: 'active' },
      attributes: ['id'],
    });
    emitMany(staff.map((s) => s.id), event, data);
  } catch (err) {
    logger.warn('[sse] emitStaffEvent failed', err);
  }
}