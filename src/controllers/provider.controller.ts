import { Request, Response } from 'express';
import User from '../models/User';
import catchAsync from '../utils/catchAsync';

export const getProviderPublicProfile = catchAsync(async (req: Request, res: Response) => {
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const provider = await User.findByPk(id, {
    attributes: [
      'id', 'firstName', 'lastName', 'email', 'phone', 
      'companyName', 'serviceType', 'registrationNumber', 
      'createdAt', 'status', 
      'role',
    ]
  });

  if (!provider || provider.role !== 'PROVIDER') {
    return res.error('Provider not found', 404, 'NOT_FOUND');
  }

  res.success({ provider }, 'Provider profile retrieved');
});