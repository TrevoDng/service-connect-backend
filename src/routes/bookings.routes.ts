// src/routes/bookings.routes.ts
import { Router } from 'express';
import {
  createBooking,
  getProviderBookings,
  getClientBookings,
  acceptBooking,
  declineBooking,
  payConsultation,
  getProviderBookingById,
  submitConsultation,
  clockOutConsultation,
  clockInConsultation,
  disputePrice,
  holdFirm,
  proposeFinalPrice,
  acceptCounter,
  counterPrice,
  acceptFinalPrice,
  confirmComplete,
  complainOnBooking,
  getProviderComplaints,
} from '../controllers/bookings.controller';
import { verifyUserToken, requireRole } from '../services/auth.service';

// ============================================================
// PROVIDER ROUTER (mounted at /api/provider)
// ============================================================
// Merged into the existing provider router in services.routes.ts
// OR exposed as a second router mounted at the same base.

export const providerBookingsRouter = Router();
providerBookingsRouter.use(verifyUserToken);
providerBookingsRouter.use(requireRole('PROVIDER'));

providerBookingsRouter.get('/bookings', getProviderBookings);
providerBookingsRouter.patch('/bookings/:id/accept', acceptBooking);
providerBookingsRouter.patch('/bookings/:id/decline', declineBooking);
providerBookingsRouter.patch('/bookings/:id/consultation/clock-in', clockInConsultation);
providerBookingsRouter.patch('/bookings/:id/consultation/clock-out', clockOutConsultation);
providerBookingsRouter.patch('/bookings/:id/consultation/submit', submitConsultation);
providerBookingsRouter.get('/complaints', getProviderComplaints);  
providerBookingsRouter.get('/bookings/:id', getProviderBookingById);
providerBookingsRouter.patch('/bookings/:id/propose-price', proposeFinalPrice);
providerBookingsRouter.patch('/bookings/:id/accept-counter', acceptCounter);
providerBookingsRouter.patch('/bookings/:id/hold-firm', holdFirm);
providerBookingsRouter.patch('/bookings/:id/dispute-price', disputePrice);


// ============================================================
// CLIENT ROUTER (mounted at /api/bookings)
// ============================================================
export const clientBookingsRouter = Router();
clientBookingsRouter.use(verifyUserToken);
clientBookingsRouter.use(requireRole('CLIENT'));

clientBookingsRouter.post('/', createBooking);
clientBookingsRouter.get('/', getClientBookings);
clientBookingsRouter.patch('/:id/pay-consultation', payConsultation);
clientBookingsRouter.post('/:id/complain', complainOnBooking);
clientBookingsRouter.post('/:id/confirm-complete', confirmComplete);
clientBookingsRouter.patch('/:id/accept-price', acceptFinalPrice);
clientBookingsRouter.patch('/:id/counter-price', counterPrice);
clientBookingsRouter.patch('/:id/hold-firm', holdFirm);
clientBookingsRouter.patch('/:id/dispute-price', disputePrice);