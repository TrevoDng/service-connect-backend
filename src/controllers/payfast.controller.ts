// src/controllers/payfast.controller.ts
import { Request, Response } from 'express';
import Booking from '../models/Booking';
import catchAsync from '../utils/catchAsync';
import { generatePayFastSignature } from '../utils/payfast.utils';
import logger from '../utils/logger';
import { sendPaymentSuccessClientEmail, sendPaymentSuccessProviderEmail } from '../services/email.service';
import { User } from '../models';
import { createNotification } from './notifications.controller';
import { emit } from '../utils/sseRegistry';

export const createPayFastPayment = catchAsync(async (req: Request, res: Response) => {
  const { bookingId } = req.body;
  const user = req.user;

  if (!user) return res.error('Not authenticated', 401, 'UNAUTHORIZED');

  const booking = await Booking.findByPk(bookingId);
  if (!booking) return res.error('Booking not found', 404, 'NOT_FOUND');

  // Base URL for ngrok or live server
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000/service-connect';

  // 1. Prepare the data payload
  // IMPORTANT: Do NOT include the signature in this object yet.
  // Inside createPayFastPayment
    const payfastData: Record<string, string> = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID || '',
    merchant_key: process.env.PAYFAST_MERCHANT_KEY || '',
    return_url: `${frontendUrl}/payment-success?bookingId=${booking.id}`,
    cancel_url: `${frontendUrl}/client/dashboard?tab=requests`,
    notify_url: `${backendUrl}/api/payfast/notify`,
    name_first: user.firstName || 'Client',
    email_address: user.email || '',
    m_payment_id: booking.id,
    amount: Number(booking.consultationFee).toFixed(2), // MUST be a string like "100.00"
    item_name: `Consultation for ${booking.serviceTitle}`,
    custom_str1: booking.id,
    };

    // Generate the signature using the data and passphrase
    const signature = generatePayFastSignature(payfastData, process.env.PAYFAST_PASSPHRASE);

    // Add the signature to the final payload
    const finalPayload = {
    ...payfastData,
    signature,
    };

    res.success({ payfastData: finalPayload }, 'PayFast payload generated');
});

// ==================== PAYFAST ITN (WEBHOOK) ====================
export const payfastNotify = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  console.log('[PayFast ITN] Received:', payload.payment_status);

  if (payload.payment_status !== 'COMPLETE') {
    return res.status(200).send('OK'); 
  }

  const bookingId = payload.m_payment_id;
  const booking = await Booking.findByPk(bookingId);

  if (!booking) {
    console.error(`[PayFast ITN] Booking ${bookingId} not found`);
    return res.status(200).send('OK');
  }

  // 1. Update Booking Status
  await booking.update({
    status: 'consultation_paid',
    consultationPaidAt: new Date(),
  });

  console.log(`[PayFast ITN] Booking ${bookingId} marked as paid!`);

  // 2. Fetch Users for Email Addresses
  const [client, provider] = await Promise.all([
    User.findByPk(booking.clientId),
    User.findByPk(booking.providerId)
  ]);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000/service-connect';
  const amountPaid = Number(payload.amount_gross);

  // In-app notification → provider (high priority, drives the bell)
  createNotification({
    userId: booking.providerId,
    type: 'consultation_paid',
    priority: 'high',
    title: 'Consultation fee paid',
    message: `${booking.clientDisplayName} paid R${amountPaid.toFixed(2)} for ${booking.serviceTitle}. You can now schedule the site visit.`,
    linkTo: `/provider/dashboard?tab=consultations`,
    actorId: booking.clientId,
    actorDisplayName: booking.clientDisplayName,
    bookingId: booking.id,
  }).catch(err => logger.error('Failed to notify provider of payment', err));

  // In-app notification → client (normal priority, confirms receipt)
  createNotification({
    userId: booking.clientId,
    type: 'consultation_paid',
    priority: 'normal',
    title: 'Payment received',
    message: `Your consultation fee for ${booking.serviceTitle} was received. ${booking.providerDisplayName} will be in touch to schedule the visit.`,
    linkTo: `/client/dashboard?tab=requests`,
    bookingId: booking.id,
  }).catch(err => logger.error('Failed to notify client of payment', err));

  // in payfastNotify, next to the createNotification calls
  emit(booking.providerId, 'booking:updated', { bookingId: booking.id, status: 'consultation_paid' });
  emit(booking.clientId,   'booking:updated', { bookingId: booking.id, status: 'consultation_paid' });
  // 3. Send Emails (fire-and-forget so it doesn't block the 200 OK)
  if (client && client.email) {
    sendPaymentSuccessClientEmail(
      client.email,
      `${client.firstName} ${client.lastName}`,
      booking.providerDisplayName,
      booking.serviceTitle,
      amountPaid,
      `${frontendUrl}/client/dashboard?tab=requests`
    ).catch(err => logger.error('Failed to send client payment email', err));
  }

  if (provider && provider.email) {
    sendPaymentSuccessProviderEmail(
      provider.email,
      `${provider.firstName} ${provider.lastName}`,
      booking.clientDisplayName,
      booking.serviceTitle,
      amountPaid,
      `${frontendUrl}/provider/dashboard?tab=consultations`
    ).catch(err => logger.error('Failed to send provider payment email', err));
  }

  res.status(200).send('OK');
});