// src/controllers/bookings.controller.ts
import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import Booking from '../models/Booking';
import sequelize from '../config/database.config';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';
import { BookingPriceHistory } from '../models';

// ============================================================
// MAPPER: Sequelize model → frontend Booking shape (Phase 1 only)
// ============================================================
// Fields NOT in Phase 1 (priceHistory, clientSharedFields, etc.)
// are filled with safe defaults so the frontend type still validates.
function toApi(b: Booking) {
  return {
    id: b.id,
    requestRef: b.requestRef,
    clientId: b.clientId,
    clientDisplayName: b.clientDisplayName,
    providerId: b.providerId,
    providerDisplayName: b.providerDisplayName,
    serviceTitle: b.serviceTitle,
    serviceCategory: b.serviceCategory,
    description: b.description,
    requestPhotos: b.requestPhotos ?? [],
    requestedDate: b.requestedDate.toISOString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    status: b.status,
    declineReason: b.declineReason ?? undefined,
    suggestedPrice: Number(b.suggestedPrice),
    consultationFee: Number(b.consultationFee),
    consultationPaidAt: b.consultationPaidAt?.toISOString(),
    consultationClockIn: b.consultationClockIn?.toISOString(),
    consultationClockOut: b.consultationClockOut?.toISOString(),
    consultationReferenceCode: b.consultationReferenceCode ?? undefined,
    consultationReferenceExpiresAt: b.consultationReferenceExpiresAt?.toISOString(),
    consultationNotes: b.consultationNotes ?? undefined,
    consultationPhotos: b.consultationPhotos ?? [],
    siteVisited: b.siteVisited ?? false,
    // ---------- Phase 3 placeholders (still undefined) ----------
    finalPrice: b.finalPrice !== null && b.finalPrice !== undefined ? Number(b.finalPrice) : undefined,
    priceHistory: ((b as any).priceHistory ?? []).map((h: any) => ({
      stage: h.stage,
      amount: Number(h.amount),
      at: h.createdAt instanceof Date ? h.createdAt.toISOString() : String(h.createdAt),
      byUserId: h.byUserId,
      note: h.note ?? undefined,
})),
    pendingCounterParty: b.pendingCounterParty ?? undefined,
    holdFirm: b.holdFirm ?? false,
    clientCounterCount: b.clientCounterCount ?? 0,
    providerCounterCount: b.providerCounterCount ?? 0,
    clientSharedFields: {
      displayName: true,
      phone: false,
      address: false,
      gateCode: false,
      specialInstructions: false,
    },
    workSessionId: undefined,
    consultationClockConfirmedByClient: undefined,
  };
}

// Helper to include price history relation
const withHistory = {
  model: BookingPriceHistory,
  as: 'priceHistory',
  order: [['createdAt', 'ASC']] as any,
};

// ============================================================
// GENERATE requestRef via Postgres sequence
// ============================================================
async function generateRequestRef(): Promise<string> {
  const rows = await sequelize.query<{ nextval: string }>(
    "SELECT nextval('booking_ref_seq')::int AS nextval",
    { type: QueryTypes.SELECT }
  );
  const seq = Number(rows[0]?.nextval || 1);
  const year = new Date().getFullYear();
  return `REQ-${year}-${String(seq).padStart(4, '0')}`;
}

// ==================== CREATE BOOKING (CLIENT) ====================
export const createBooking = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT') {
    return res.error('Only clients can create bookings', 403, 'FORBIDDEN');
  }

  const {
    providerId,
    providerDisplayName,
    serviceTitle,
    serviceCategory,
    description,
    requestPhotos,
    requestedDate,
    suggestedPrice,
    clientDisplayName,
  } = req.body;

  if (!providerId || !serviceTitle || !serviceCategory || !requestedDate) {
    return res.error(
      'providerId, serviceTitle, serviceCategory, and requestedDate are required',
      400,
      'MISSING_FIELDS'
    );
  }

  const price = Number(suggestedPrice);
  if (!Number.isFinite(price) || price <= 0) {
    return res.error('suggestedPrice must be a positive number', 400, 'INVALID_PRICE');
  }

  const requestRef = await generateRequestRef();

  const booking = await Booking.create({
    requestRef,
    clientId: user.id,
    clientDisplayName: clientDisplayName || `${user.firstName} ${user.lastName}`,
    providerId,
    providerDisplayName: providerDisplayName || 'Service Provider',
    serviceTitle,
    serviceCategory,
    description: description || `Request for ${serviceTitle}`,
    requestPhotos: Array.isArray(requestPhotos) ? requestPhotos : [],
    requestedDate: new Date(requestedDate),
    status: 'requested',
    suggestedPrice: price,
    consultationFee: 0,
  });

  logger.info(`Booking ${booking.requestRef} created by client ${user.email}`);

  res.status(201).success({ booking: toApi(booking) }, 'Booking created successfully');
});

// ==================== GET PROVIDER'S BOOKINGS ====================
export const getProviderBookings = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

    const bookings = await Booking.findAll({
      where: { providerId: user.id },
      include: [withHistory],
      order: [['updatedAt', 'DESC']],
    });

  res.success({ bookings: bookings.map(toApi) }, 'Bookings retrieved successfully');
});

// ==================== GET CLIENT'S BOOKINGS ====================
export const getClientBookings = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

    const bookings = await Booking.findAll({
      where: { clientId: user.id },
      include: [withHistory],
      order: [['updatedAt', 'DESC']],
    });

  res.success({ bookings: bookings.map(toApi) }, 'Bookings retrieved successfully');
});

// ==================== GET PROVIDER'S SINGLE BOOKING ====================
export const getProviderBookingById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

    const booking = await Booking.findByPk(id, { include: [withHistory] });
      if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
      if (booking.providerId !== user.id) {
      return res.error('Forbidden', 403, 'FORBIDDEN');
  }
  res.success({ booking: toApi(booking) }, 'Booking retrieved');
});

// ==================== ACCEPT BOOKING (PROVIDER) ====================
export const acceptBooking = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can accept bookings', 403, 'FORBIDDEN');
  }

  const bookingIdParam = req.params.id;
  const bookingId = Array.isArray(bookingIdParam) ? bookingIdParam[0] : bookingIdParam;
  const { consultationFee } = req.body;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('You can only accept your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'requested') {
    return res.error(`Cannot accept booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }

  const fee = Number(consultationFee);
  if (!Number.isFinite(fee) || fee < 0) {
    return res.error('consultationFee must be a non-negative number', 400, 'INVALID_FEE');
  }

  await booking.update({ status: 'accepted', consultationFee: fee });

  logger.info(`Booking ${booking.requestRef} accepted by provider ${user.email}`);

  res.success({ booking: toApi(booking) }, 'Booking accepted');
});

// ==================== DECLINE BOOKING (PROVIDER) ====================
export const declineBooking = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can decline bookings', 403, 'FORBIDDEN');
  }

  const bookingIdParam = req.params.id;
  const bookingId = Array.isArray(bookingIdParam) ? bookingIdParam[0] : bookingIdParam;
  const { reason } = req.body;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('You can only decline your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'requested') {
    return res.error(`Cannot decline booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }

  const trimmed =
    (reason && String(reason).trim()) ||
    'Unable to take this job at the moment. Best of luck finding another provider.';

  await booking.update({ status: 'declined', declineReason: trimmed });

  logger.info(`Booking ${booking.requestRef} declined by provider ${user.email}`);

  res.success({ booking: toApi(booking) }, 'Booking declined');
});

// ==================== PAY CONSULTATION FEE (CLIENT) ====================
export const payConsultation = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT') {
    return res.error('Only clients can pay consultation fees', 403, 'FORBIDDEN');
  }

  const bookingIdParam = req.params.id;
  const bookingId = Array.isArray(bookingIdParam) ? bookingIdParam[0] : bookingIdParam;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.clientId !== user.id) {
    return res.error('You can only pay for your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'accepted') {
    return res.error(
      `Cannot pay consultation fee for booking with status ${booking.status}`,
      400,
      'INVALID_STATUS'
    );
  }
  if (booking.consultationPaidAt) {
    return res.error('Consultation fee already paid', 400, 'ALREADY_PAID');
  }

  await booking.update({
    status: 'consultation_paid',
    consultationPaidAt: new Date(),
  });

  logger.info(`Consultation fee paid for booking ${booking.requestRef} by client ${user.email}`);

  res.success({ booking: toApi(booking) }, 'Consultation fee paid');
});

// ==================== START CONSULTATION (clock in) ====================
export const clockInConsultation = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can clock in for consultations', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { referenceCode, expiresAt } = req.body;

  if (!referenceCode || !expiresAt) {
    return res.error('referenceCode and expiresAt are required', 400, 'MISSING_FIELDS');
  }

  const booking = await Booking.findByPk(id);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('You can only clock in to your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'consultation_paid') {
    return res.error(`Cannot start consultation for booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }
  if (booking.consultationClockIn) {
    return res.error('Consultation already started', 400, 'ALREADY_CLOCKED_IN');
  }

  await booking.update({
    consultationClockIn: new Date(),
    consultationReferenceCode: String(referenceCode),
    consultationReferenceExpiresAt: new Date(expiresAt),
  });

  logger.info(`Consultation clocked in for ${booking.requestRef} by provider ${user.email}`);

  res.success({ booking: toApi(booking) }, 'Clocked in successfully');
});

// ==================== END CONSULTATION (clock out) ====================
export const clockOutConsultation = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can clock out of consultations', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(id);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('You can only clock out of your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'consultation_paid') {
    return res.error(`Cannot clock out for booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }
  if (!booking.consultationClockIn) {
    return res.error('Consultation was never started', 400, 'NOT_CLOCKED_IN');
  }
  if (booking.consultationClockOut) {
    return res.error('Consultation already ended', 400, 'ALREADY_CLOCKED_OUT');
  }

  await booking.update({
    consultationClockOut: new Date(),
    consultationReferenceCode: null,
    consultationReferenceExpiresAt: null,
  });

  logger.info(`Consultation clocked out for ${booking.requestRef} by provider ${user.email}`);

  res.success({ booking: toApi(booking) }, 'Clocked out successfully');
});

// ==================== SUBMIT CONSULTATION FINDINGS ====================
export const submitConsultation = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can submit consultations', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { notes, photos } = req.body;

  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    return res.error('notes is required', 400, 'MISSING_NOTES');
  }
  if (!Array.isArray(photos) || photos.length === 0) {
    return res.error('At least one photo is required', 400, 'MISSING_PHOTOS');
  }

  const booking = await Booking.findByPk(id);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('You can only submit your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'consultation_paid') {
    return res.error(`Cannot submit consultation for booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }
  if (!booking.consultationClockIn || !booking.consultationClockOut) {
    return res.error('Must clock in and out before submitting', 400, 'INCOMPLETE_VISIT');
  }

  await booking.update({
    status: 'evaluated',
    siteVisited: true,
    consultationNotes: notes.trim(),
    consultationPhotos: photos,
  });

  logger.info(`Consultation submitted for ${booking.requestRef} by provider ${user.email}`);

  res.success({ booking: toApi(booking) }, 'Consultation submitted successfully');
});

// ==================== PROPOSE / RE-PROPOSE FINAL PRICE (PROVIDER) ====================
export const proposeFinalPrice = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can propose a final price', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { amount, note } = req.body;

  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    return res.error('amount must be a positive number', 400, 'INVALID_AMOUNT');
  }

  const booking = await Booking.findByPk(id);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('You can only propose prices on your own bookings', 403, 'FORBIDDEN');
  }

  // Allowed in two cases:
  //  1. First proposal (status 'evaluated')
  //  2. Re-proposal (status 'price_proposed' AND it's the provider's turn)
  const isFirstProposal = booking.status === 'evaluated';
  const isReProposal =
    booking.status === 'price_proposed' && booking.pendingCounterParty === 'PROVIDER';

  if (!isFirstProposal && !isReProposal) {
    return res.error(
      `Cannot propose price for booking with status ${booking.status}`,
      400,
      'INVALID_STATUS'
    );
  }

  if (booking.holdFirm === true) {
    return res.error('Hold firm is active — no further counters allowed', 400, 'HOLD_FIRM_ACTIVE');
  }

  // Counter limit — only re-proposals count as counters
  if (isReProposal && booking.providerCounterCount >= 3) {
    return res.error('Counter limit reached (3/3)', 400, 'COUNTER_LIMIT_REACHED');
  }

  const newProviderCounterCount = isReProposal
    ? booking.providerCounterCount + 1
    : booking.providerCounterCount;

  const transaction = await sequelize.transaction();
  try {
    await booking.update(
      {
        status: 'price_proposed',
        finalPrice: num,
        pendingCounterParty: 'CLIENT',
        holdFirm: false,
        providerCounterCount: newProviderCounterCount,
      },
      { transaction }
    );

    await BookingPriceHistory.create(
      {
        bookingId: booking.id,
        stage: 'final_proposed',
        amount: num,
        byUserId: user.id,
        note: note ? String(note).trim() : undefined,
      },
      { transaction }
    );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  const fresh = await Booking.findByPk(id, { include: [withHistory] });
  logger.info(
    `Provider ${user.email} ${isReProposal ? 're-proposed' : 'proposed'} R${num} on ${booking.requestRef}`
  );
  res.success({ booking: toApi(fresh!) }, 'Final price proposed');
});

// ==================== ACCEPT FINAL PRICE (CLIENT) ====================
export const acceptFinalPrice = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT') {
    return res.error('Only clients can accept final prices', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(id);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.clientId !== user.id) {
    return res.error('You can only accept prices on your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'price_proposed') {
    return res.error(`Cannot accept price for booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }
  if (booking.pendingCounterParty !== 'CLIENT') {
    return res.error('Not your turn to respond', 400, 'NOT_YOUR_TURN');
  }

  const transaction = await sequelize.transaction();
    try {
        booking.set('status', 'price_agreed');
        booking.set('pendingCounterParty', null);
        booking.set('holdFirm', false);
    await booking.save({ transaction });

    await BookingPriceHistory.create({
      bookingId: booking.id,
      stage: 'final_agreed',
      amount: Number(booking.finalPrice ?? 0),
      byUserId: user.id,
      note: 'Client accepted the final price.',
    }, { transaction });

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  const fresh = await Booking.findByPk(id, { include: [withHistory] });
  logger.info(`Client ${user.email} accepted price on ${booking.requestRef}`);
  res.success({ booking: toApi(fresh!) }, 'Price agreed');
});

// ==================== COUNTER PRICE (CLIENT) ====================
export const counterPrice = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT') {
    return res.error('Only clients can counter prices', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { amount, note } = req.body;

  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    return res.error('amount must be a positive number', 400, 'INVALID_AMOUNT');
  }

  const booking = await Booking.findByPk(id);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.clientId !== user.id) {
    return res.error('You can only counter prices on your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'price_proposed') {
    return res.error(`Cannot counter price for booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }
  if (booking.pendingCounterParty !== 'CLIENT') {
    return res.error('Not your turn to respond', 400, 'NOT_YOUR_TURN');
  }
  if (booking.holdFirm === true) {
    return res.error('Hold firm is active — no further counters allowed', 400, 'HOLD_FIRM_ACTIVE');
  }
  if (booking.clientCounterCount >= 3) {
    return res.error('Counter limit reached (3/3)', 400, 'COUNTER_LIMIT_REACHED');
  }

  const transaction = await sequelize.transaction();
  try {
    await booking.update(
      {
        finalPrice: num,
        pendingCounterParty: 'PROVIDER',
        holdFirm: false,
        clientCounterCount: booking.clientCounterCount + 1,
      },
      { transaction }
    );

    await BookingPriceHistory.create(
      {
        bookingId: booking.id,
        stage: 'final_proposed',
        amount: num,
        byUserId: user.id,
        note: note ? `Client counter: ${String(note).trim()}` : 'Client counter.',
      },
      { transaction }
    );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  const fresh = await Booking.findByPk(id, { include: [withHistory] });
  logger.info(`Client ${user.email} countered with R${num} on ${booking.requestRef}`);
  res.success({ booking: toApi(fresh!) }, 'Counter sent');
});

// ==================== ACCEPT COUNTER (PROVIDER) ====================
export const acceptCounter = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'PROVIDER') {
    return res.error('Only providers can accept counters', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(id);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.providerId !== user.id) {
    return res.error('You can only accept counters on your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'price_proposed') {
    return res.error(`Cannot accept counter for booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }
  if (booking.pendingCounterParty !== 'PROVIDER') {
    return res.error('Not your turn to respond', 400, 'NOT_YOUR_TURN');
  }

  const transaction = await sequelize.transaction();
  try {
      booking.set('status', 'price_agreed');
      booking.set('pendingCounterParty', null);
      booking.set('holdFirm', false);
      await booking.save({ transaction });

    await BookingPriceHistory.create({
      bookingId: booking.id,
      stage: 'final_agreed',
      amount: Number(booking.finalPrice ?? 0),
      byUserId: user.id,
      note: 'Provider accepted the client counter.',
    }, { transaction });

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  const fresh = await Booking.findByPk(id, { include: [withHistory] });
  logger.info(`Provider ${user.email} accepted counter on ${booking.requestRef}`);
  res.success({ booking: toApi(fresh!) }, 'Counter accepted');
});

// ==================== HOLD FIRM (EITHER PARTY) ====================
export const holdFirm = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT' && user.role !== 'PROVIDER') {
    return res.error('Only clients and providers can hold firm', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const booking = await Booking.findByPk(id);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const isClient = user.role === 'CLIENT';
  if (isClient && booking.clientId !== user.id) {
    return res.error('You can only hold firm on your own bookings', 403, 'FORBIDDEN');
  }
  if (!isClient && booking.providerId !== user.id) {
    return res.error('You can only hold firm on your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'price_proposed') {
    return res.error(`Cannot hold firm for booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }

  const currentTurn = booking.pendingCounterParty;
  if ((isClient && currentTurn !== 'CLIENT') || (!isClient && currentTurn !== 'PROVIDER')) {
    return res.error('Not your turn to respond', 400, 'NOT_YOUR_TURN');
  }
  if (booking.holdFirm === true) {
    return res.error('Hold firm is already active', 400, 'ALREADY_HOLDING');
  }

  // Find the holder's most recent proposal in price history
  const holderId = isClient ? booking.clientId : booking.providerId;
  const lastProposal = await BookingPriceHistory.findOne({
    where: { bookingId: booking.id, byUserId: holderId, stage: 'final_proposed' },
    order: [['createdAt', 'DESC']],
  });

  if (!lastProposal) {
    return res.error(
      'You must propose a price before holding firm',
      400,
      'NO_PROPOSAL_TO_HOLD'
    );
  }

  const firmAmount = Number(lastProposal.amount);

  await booking.update({
    pendingCounterParty: isClient ? 'PROVIDER' : 'CLIENT',
    holdFirm: true,
    finalPrice: firmAmount,
  });

  const fresh = await Booking.findByPk(id, { include: [withHistory] });
  logger.info(
    `${user.role} ${user.email} held firm at R${firmAmount} on ${booking.requestRef}`
  );
  res.success({ booking: toApi(fresh!) }, 'Held firm');
});

// ==================== DISPUTE PRICE (EITHER PARTY) ====================
export const disputePrice = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');
  if (user.role !== 'CLIENT' && user.role !== 'PROVIDER') {
    return res.error('Only clients and providers can dispute prices', 403, 'FORBIDDEN');
  }

  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.error('reason is required', 400, 'MISSING_REASON');
  }

  const booking = await Booking.findByPk(id);
  if (!booking) return res.error('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.clientId !== user.id && booking.providerId !== user.id) {
    return res.error('You can only dispute prices on your own bookings', 403, 'FORBIDDEN');
  }
  if (booking.status !== 'price_proposed') {
    return res.error(`Cannot dispute price for booking with status ${booking.status}`, 400, 'INVALID_STATUS');
  }

    booking.set('status', 'price_disputed');
    booking.set('pendingCounterParty', null);
    booking.set('holdFirm', false);
    await booking.save();

  const fresh = await Booking.findByPk(id, { include: [withHistory] });
  logger.info(`${user.role} ${user.email} disputed price on ${booking.requestRef}: ${reason}`);
  res.success({ booking: toApi(fresh!) }, 'Price disputed');
});