// src/routes/services.routes.ts
import { Router } from 'express';
import {
  createService,
  getProviderServices,
  getProviderStats,
  deleteService,
  getAllActiveServices,
  getServiceById,
} from '../controllers/services.controller';
import { verifyUserToken, requireRole } from '../services/auth.service';

// ============================================================
// PROVIDER-SCOPED ROUTER (mounted at /api/provider)
// ============================================================
export const providerRouter = Router();

providerRouter.use(verifyUserToken);
providerRouter.use(requireRole('PROVIDER'));

providerRouter.get('/services', getProviderServices);
providerRouter.get('/services/stats', getProviderStats);

// ============================================================
// PUBLIC/SERVICE ROUTER (mounted at /api/services)
// ============================================================
export const servicesRouter = Router();

servicesRouter.get('/', getAllActiveServices);
servicesRouter.get('/:id', getServiceById);

// authenticated provider-only below
servicesRouter.post('/', verifyUserToken, requireRole('PROVIDER'), createService);
servicesRouter.delete('/:id', verifyUserToken, requireRole('PROVIDER'), deleteService);