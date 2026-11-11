import { Request, Response } from 'express';
import RegistrationRequest from '../models/RegistrationRequest';
import catchAsync from '../utils/catchAsync';
import { emitStaffEvent } from '../services/sse.services';

export const submitRegistrationRequest = catchAsync(async (req: Request, res: Response) => {
  const { role, firstName, lastName, email, phone, documents } = req.body;

  if (!role || !firstName || !lastName || !email || !documents) {
    return res.error('Missing required fields', 400, 'MISSING_FIELDS');
  }

  // Check if they already submitted
  const existing = await RegistrationRequest.findOne({ where: { email } });
  if (existing) {
    return res.error('A registration request already exists for this email.', 409, 'REQUEST_EXISTS');
  }

  const request = await RegistrationRequest.create({
    role,
    firstName,
    lastName,
    email,
    phone,
    documents,
    status: 'pending',
  });

  void emitStaffEvent('registration:updated', { requestId: request.id, status: 'pending' });

  res.status(201).success({ request }, 'Registration request submitted successfully');
});