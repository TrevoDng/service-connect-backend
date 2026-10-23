// src/controllers/bookings.controller.ts
import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import Booking from '../models/Booking';
import sequelize from '../config/database.config';
import catchAsync from '../utils/catchAsync';
import logger from '../utils/logger';

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
    finalPrice: undefined,
    priceHistory: [],
    pendingCounterParty: undefined,
    holdFirm: undefined,
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

  const booking = await Booking.findByPk(id);
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
    consultationReferenceCode: undefined,
    consultationReferenceExpiresAt: undefined,
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