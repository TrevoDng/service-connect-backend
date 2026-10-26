// src/controllers/workSessions.controller.ts
import { Request, Response } from 'express';
import Booking from '../models/Booking';
import WorkSession from '../models/WorkSession';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';

// ============================================================
// MAPPER: WorkSession model → frontend WorkSession shape
// ============================================================
function sessionToApi(s: WorkSession) {
  return {
    id: s.id,
    bookingId: s.bookingId,
    providerId: s.providerId,
    clientId: s.clientId,
    status: s.status,
    currentReferenceCode: s.currentReferenceCode ?? undefined,
    referenceCodeExpiresAt: s.referenceCodeExpiresAt?.toISOString(),
    clockEvents: s.clockEvents ?? [],
    beforePhotos: s.beforePhotos ?? [],
    progressStages: s.progressStages ?? [],
    finalPhotos: s.finalPhotos ?? [],
    daysWorked: s.daysWorked ?? 0,
    totalHours: Number(s.totalHours ?? 0),
    completedAt: s.completedAt?.toISOString(),
    arrivedAt: s.arrivedAt?.toISOString(),
    gateConfirmedByClient: s.gateConfirmedByClient ?? false,
    gateConfirmedAt: s.gateConfirmedAt?.toISOString(),
    gateEvent: s.gateEvent ?? undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// ==================== PROVIDER ARRIVES → CREATE SESSION ====================
export const arriveAtSite = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can arrive at a site', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;
  const { referenceCode, expiresAt } = req.body;

  if (!referenceCode || !expiresAt) {
    return res.error('referenceCode and expiresAt are required', 400, 'MISSING_FIELDS');
  }

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('You can only start work on your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'price_agreed' && booking.status !== 'in_progress') {
    return res.error(
      `Cannot start work session for booking with status ${booking.status}`,
      400,
      'INVALID_STATUS'
    );
  }

  // Only one session per booking
  const existing = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (existing) {
    return res.error('A work session already exists for this booking', 409, 'SESSION_EXISTS');
  }

  const session = await WorkSession.create({
    bookingId: booking.id,
    providerId: booking.providerId,
    clientId: booking.clientId,
    status: 'arrived',
    currentReferenceCode: String(referenceCode),
    referenceCodeExpiresAt: new Date(expiresAt),
    arrivedAt: new Date(),
    gateConfirmedByClient: false,
  });

  // Link booking to session
  await booking.update({ workSessionId: session.id });

  logger.info(`Work session ${session.id} created for ${booking.requestRef} by ${user.email}`);

  res.status(201).success({ session: sessionToApi(session) }, 'Arrived on site');
});

// ==================== GET SESSION BY BOOKING (provider) ====================
export const getProviderWorkSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) return res.error('No work session for this booking', 404, 'SESSION_NOT_FOUND');

  res.success({ session: sessionToApi(session) }, 'Work session retrieved');
});

// ==================== GET SESSION BY BOOKING (client) ====================
export const getClientWorkSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.clientId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) return res.error('No work session for this booking', 404, 'SESSION_NOT_FOUND');

  res.success({ session: sessionToApi(session) }, 'Work session retrieved');
});

// ==================== CLIENT CONFIRMS GATE (opens clock-in) ====================
export const confirmGate = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT') {
    return res.error('Only clients can confirm gate access', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.clientId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) return res.error('No work session for this booking', 404, 'SESSION_NOT_FOUND');
  if (session.status === 'completed') {
    return res.error('Session already completed', 400, 'SESSION_COMPLETED');
  }
  if (session.gateConfirmedByClient) {
    return res.error('Gate already confirmed', 400, 'ALREADY_CONFIRMED');
  }
  if (!session.currentReferenceCode) {
    return res.error('No active reference code to confirm', 400, 'NO_ACTIVE_CODE');
  }

  const now = new Date();
  await session.update({
    gateConfirmedByClient: true,
    gateConfirmedAt: now,
    status: 'confirmed',
  });

  logger.info(`Client ${user.email} confirmed gate for session ${session.id}`);

  res.success({ session: sessionToApi(session) }, 'Gate access confirmed');
});

// ==================== CLIENT DENIES GATE (invalidates code) ====================
export const denyGate = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT') {
    return res.error('Only clients can deny gate access', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.clientId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) return res.error('No work session for this booking', 404, 'SESSION_NOT_FOUND');
  if (session.gateConfirmedByClient) {
    return res.error('Gate already confirmed — cannot deny', 400, 'ALREADY_CONFIRMED');
  }

  await session.update({
    currentReferenceCode: null,
    referenceCodeExpiresAt: null,
  });

  logger.info(`Client ${user.email} denied gate for session ${session.id}`);

  res.success({ session: sessionToApi(session) }, 'Gate access denied');
});

// ==================== PROVIDER PROCEEDS WITHOUT CONFIRMATION ====================
export const proceedAnyway = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can proceed without confirmation', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;
  const { note } = req.body;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) return res.error('No work session for this booking', 404, 'SESSION_NOT_FOUND');
  if (session.gateConfirmedByClient) {
    return res.error('Gate already confirmed — no need to proceed anyway', 400, 'ALREADY_CONFIRMED');
  }
  if (session.gateEvent?.status === 'auto_proceeded') {
    return res.error('Already proceeded without confirmation', 400, 'ALREADY_PROCEEDED');
  }

  const now = new Date().toISOString();

  await session.update({
    status: 'in_progress',
    currentReferenceCode: null,
    referenceCodeExpiresAt: null,
    gateEvent: {
      status: 'auto_proceeded',
      attemptedAt: session.arrivedAt?.toISOString(),
      resolvedAt: now,
      resolvedByUserId: user.id,
      resolvedByDisplayName: `${user.firstName} ${user.lastName}`,
      note: note ? String(note).trim() : undefined,
    },
  });

  logger.info(`Provider ${user.email} proceeded without confirmation on session ${session.id}`);

  res.success({ session: sessionToApi(session) }, 'Proceeded without confirmation');
});

// ==================== CLIENT RETROACTIVELY CONFIRMS OR DISPUTES ====================
export const retroactiveResponse = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT') {
    return res.error('Only clients can respond retroactively', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;
  const { action } = req.body; // 'confirm' | 'dispute'

  if (action !== 'confirm' && action !== 'dispute') {
    return res.error('action must be "confirm" or "dispute"', 400, 'INVALID_ACTION');
  }

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.clientId !== user.id) {
    return res.error('Forbidden', 403, 'FORBIDDEN');
  }

  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) return res.error('No work session for this booking', 404, 'SESSION_NOT_FOUND');
  if (session.gateEvent?.status !== 'auto_proceeded') {
    return res.error('Nothing to respond to — provider did not proceed without confirmation', 400, 'INVALID_STATE');
  }

  const now = new Date().toISOString();

  if (action === 'confirm') {
    await session.update({
      gateConfirmedByClient: true,
      gateConfirmedAt: new Date(),
      gateEvent: {
        ...(session.gateEvent ?? { status: 'confirmed_late' }),
        status: 'confirmed_late',
        resolvedAt: now,
        resolvedByUserId: user.id,
        resolvedByDisplayName: `${user.firstName} ${user.lastName}`,
      },
    });
    logger.info(`Client ${user.email} retro-confirmed gate for session ${session.id}`);
    return res.success({ session: sessionToApi(session) }, 'Retroactively confirmed');
  }

  // dispute
  await session.update({
    gateEvent: {
      ...(session.gateEvent ?? { status: 'contested' }),
      status: 'contested',
      resolvedAt: now,
      resolvedByUserId: user.id,
      resolvedByDisplayName: `${user.firstName} ${user.lastName}`,
    },
  });
  logger.info(`Client ${user.email} disputed gate for session ${session.id}`);
  res.success({ session: sessionToApi(session) }, 'Gate disputed — support will review');
});

// ==================== CLOCK IN ====================
export const clockIn = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') return res.error('Only providers can clock in', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) return res.error('Forbidden', 403, 'FORBIDDEN');

  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) return res.error('No work session', 404, 'SESSION_NOT_FOUND');
  if (session.status === 'completed') return res.error('Session completed', 400, 'SESSION_COMPLETED');
  if (session.status === 'arrived') {
    return res.error('Confirm gate before clocking in', 400, 'GATE_NOT_CONFIRMED');
  }
  if (session.gateEvent?.status === 'auto_proceeded' && !session.gateConfirmedByClient) {
    // Provider already proceeded without confirmation — allow clock in
  } else if (!session.gateConfirmedByClient) {
    return res.error('Gate not confirmed', 400, 'GATE_NOT_CONFIRMED');
  }

  // Guard: not already clocked in (last event is 'in')
  const lastEvent = session.clockEvents[session.clockEvents.length - 1];
  if (lastEvent?.type === 'in') {
    return res.error('Already clocked in', 400, 'ALREADY_CLOCKED_IN');
  }

  const now = new Date();
  const newEvent = {
    id: crypto.randomUUID(),
    type: 'in' as const,
    at: now.toISOString(),
    confirmedByClient: session.gateConfirmedByClient === true,
  };

  const isFirstClockIn = !session.clockEvents.some((e) => e.type === 'in');

  await session.update({
    status: 'in_progress',
    clockEvents: [...session.clockEvents, newEvent],
    currentReferenceCode: null,
    referenceCodeExpiresAt: null,
  });

  if (isFirstClockIn) {
    await booking.update({ status: 'in_progress' });
  }

  logger.info(`Clock in on session ${session.id} by ${user.email}`);

  res.success({ session: sessionToApi(session) }, 'Clocked in');
});

// ==================== CLOCK OUT ====================
export const clockOut = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') return res.error('Only providers can clock out', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) return res.error('Forbidden', 403, 'FORBIDDEN');

  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) return res.error('No work session', 404, 'SESSION_NOT_FOUND');
  if (session.status !== 'in_progress') {
    return res.error('Session not in progress', 400, 'INVALID_STATUS');
  }

  // Must have an active 'in' event to close
  const lastEvent = session.clockEvents[session.clockEvents.length - 1];
  if (lastEvent?.type !== 'in') {
    return res.error('Not currently clocked in', 400, 'NOT_CLOCKED_IN');
  }

  const now = new Date();
  const addedHours = lastEvent
    ? (now.getTime() - new Date(lastEvent.at).getTime()) / 3_600_000
    : 0;

  await session.update({
    clockEvents: [
      ...session.clockEvents,
      { id: crypto.randomUUID(), type: 'out' as const, at: now.toISOString(), confirmedByClient: false },
    ],
    daysWorked: session.daysWorked + 1,
    totalHours: Number(session.totalHours) + addedHours,
  });

  logger.info(`Clock out on session ${session.id} by ${user.email} (${addedHours.toFixed(2)}h)`);

  res.success({ session: sessionToApi(session) }, 'Clocked out');
});

// ==================== COMPLETE SESSION ====================
export const completeSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') return res.error('Only providers can complete sessions', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) return res.error('Forbidden', 403, 'FORBIDDEN');

  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) return res.error('No work session', 404, 'SESSION_NOT_FOUND');
  if (session.status === 'completed') {
    return res.error('Session already completed', 400, 'ALREADY_COMPLETED');
  }

  // Must be clocked out before completing
  const lastEvent = session.clockEvents[session.clockEvents.length - 1];
  if (lastEvent?.type === 'in') {
    return res.error('Clock out before completing', 400, 'STILL_CLOCKED_IN');
  }
  if (session.clockEvents.length === 0) {
    return res.error('Cannot complete with no clock events', 400, 'NO_WORK_LOGGED');
  }

  const now = new Date();

  await session.update({
    status: 'completed',
    completedAt: now,
    currentReferenceCode: null,
    referenceCodeExpiresAt: null,
  });

  await booking.update({ status: 'completed' });

  logger.info(`Session ${session.id} completed by ${user.email}`);

  res.success({ session: sessionToApi(session) }, 'Session completed');
});

// ============================================================
// Helper: guard against modifying completed sessions
// ============================================================
async function getSessionForWrite(bookingId: string, userId: string, role: 'CLIENT' | 'PROVIDER') {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw { code: 'BOOKING_NOT_FOUND', message: 'Booking not found', status: 404 };
  if (role === 'CLIENT' && booking.clientId !== userId) {
    throw { code: 'FORBIDDEN', message: 'Forbidden', status: 403 };
  }
  if (role === 'PROVIDER' && booking.providerId !== userId) {
    throw { code: 'FORBIDDEN', message: 'Forbidden', status: 403 };
  }
  const session = await WorkSession.findOne({ where: { bookingId: booking.id } });
  if (!session) throw { code: 'SESSION_NOT_FOUND', message: 'No work session', status: 404 };
  if (session.status === 'completed') {
    throw { code: 'SESSION_COMPLETED', message: 'Session already completed', status: 400 };
  }
  return { booking, session };
}

// ==================== PUT BEFORE PHOTOS (full array replace) ====================
export const setBeforePhotos = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') return res.error('Only providers can upload before photos', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;
  const { photos } = req.body;

  if (!Array.isArray(photos)) {
    return res.error('photos must be an array', 400, 'INVALID_PAYLOAD');
  }
  if (photos.length > 5) {
    return res.error('Maximum 5 before photos', 400, 'TOO_MANY_PHOTOS');
  }

  let session, booking;
  try {
    ({ session, booking } = await getSessionForWrite(bookingId, user.id, 'PROVIDER'));
  } catch (e: any) {
    return res.error(e.message, e.status ?? 400, e.code ?? 'ERROR');
  }

  await session.update({ beforePhotos: photos });

  logger.info(`Before photos set (${photos.length}) on session ${session.id}`);

  res.success({ session: sessionToApi(session) }, 'Before photos saved');
});

// ==================== DELETE ONE BEFORE PHOTO ====================
export const deleteBeforePhoto = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') return res.error('Only providers can delete before photos', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;
  const photoIdParam = req.params.photoId;
  const photoId = Array.isArray(photoIdParam) ? photoIdParam[0] : photoIdParam;

  let session;
  try {
    ({ session } = await getSessionForWrite(bookingId, user.id, 'PROVIDER'));
  } catch (e: any) {
    return res.error(e.message, e.status ?? 400, e.code ?? 'ERROR');
  }

  await session.update({
    beforePhotos: session.beforePhotos.filter((p) => p.id !== photoId),
  });

  res.success({ session: sessionToApi(session) }, 'Photo deleted');
});

// ==================== PUT FINAL PHOTOS ====================
export const setFinalPhotos = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') return res.error('Only providers can upload final photos', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;
  const { photos } = req.body;

  if (!Array.isArray(photos)) {
    return res.error('photos must be an array', 400, 'INVALID_PAYLOAD');
  }
  if (photos.length > 5) {
    return res.error('Maximum 5 final photos', 400, 'TOO_MANY_PHOTOS');
  }

  let session;
  try {
    ({ session } = await getSessionForWrite(bookingId, user.id, 'PROVIDER'));
  } catch (e: any) {
    return res.error(e.message, e.status ?? 400, e.code ?? 'ERROR');
  }

  await session.update({ finalPhotos: photos });

  logger.info(`Final photos set (${photos.length}) on session ${session.id}`);

  res.success({ session: sessionToApi(session) }, 'Final photos saved');
});

// ==================== DELETE ONE FINAL PHOTO ====================
export const deleteFinalPhoto = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') return res.error('Only providers can delete final photos', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;
  const photoIdParam = req.params.photoId;
  const photoId = Array.isArray(photoIdParam) ? photoIdParam[0] : photoIdParam;

  let session;
  try {
    ({ session } = await getSessionForWrite(bookingId, user.id, 'PROVIDER'));
  } catch (e: any) {
    return res.error(e.message, e.status ?? 400, e.code ?? 'ERROR');
  }

  await session.update({
    finalPhotos: session.finalPhotos.filter((p) => p.id !== photoId),
  });

  res.success({ session: sessionToApi(session) }, 'Photo deleted');
});

// ==================== UPSERT PROGRESS STAGE ====================
export const upsertProgressStage = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') return res.error('Only providers can save stages', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;
  const { stage } = req.body;

  if (!stage || !stage.id || !stage.label || !Array.isArray(stage.photos)) {
    return res.error('stage with id, label, and photos is required', 400, 'INVALID_PAYLOAD');
  }

  let session;
  try {
    ({ session } = await getSessionForWrite(bookingId, user.id, 'PROVIDER'));
  } catch (e: any) {
    return res.error(e.message, e.status ?? 400, e.code ?? 'ERROR');
  }

  const existing = session.progressStages.findIndex((s) => s.id === stage.id);
  const nextStages =
    existing >= 0
      ? session.progressStages.map((s) => (s.id === stage.id ? stage : s))
      : [...session.progressStages, stage];

  await session.update({ progressStages: nextStages });

  logger.info(`Progress stage ${existing >= 0 ? 'updated' : 'added'} on session ${session.id}`);

  res.success({ session: sessionToApi(session) }, 'Progress stage saved');
});

// ==================== DELETE PROGRESS STAGE ====================
export const deleteProgressStage = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') return res.error('Only providers can delete stages', 403, 'FORBIDDEN');

  const idParam = req.params.id;
  const bookingId = Array.isArray(idParam) ? idParam[0] : idParam;
  const stageIdParam = req.params.stageId;
  const stageId = Array.isArray(stageIdParam) ? stageIdParam[0] : stageIdParam;

  let session;
  try {
    ({ session } = await getSessionForWrite(bookingId, user.id, 'PROVIDER'));
  } catch (e: any) {
    return res.error(e.message, e.status ?? 400, e.code ?? 'ERROR');
  }

  await session.update({
    progressStages: session.progressStages.filter((s) => s.id !== stageId),
  });

  res.success({ session: sessionToApi(session) }, 'Progress stage deleted');
});