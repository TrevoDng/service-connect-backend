import express from 'express'; // <-- Add this
import { createPayFastPayment, payfastNotify } from '../controllers/payfast.controller';
import { verifyUserToken } from '../services/auth.service';

const router = express.Router(); // <-- Change to express.Router()

// Endpoint to generate payment payload (requires login)
router.post('/create-payment', verifyUserToken, createPayFastPayment);

// ITN Webhook (NO login required, PayFast hits this directly)
// Parse form data specifically for this route
router.post('/notify', express.urlencoded({ extended: false }), payfastNotify);

export default router;