// src/routes/workSessions.routes.ts
import { Router } from 'express';
import {
  arriveAtSite,
  getProviderWorkSession,
  getClientWorkSession,
  proceedAnyway,
  retroactiveResponse,
  denyGate,
  confirmGate,
  completeSession,
  clockOut,
  clockIn,
  deleteProgressStage,
  upsertProgressStage,
  deleteFinalPhoto,
  setFinalPhotos,
  deleteBeforePhoto,
  setBeforePhotos,
  reopenSession,
} from '../controllers/workSessions.controller';
import { verifyUserToken, requireRole } from '../services/auth.service';

// Mounted at /api/provider/work-sessions
export const providerWorkSessionsRouter = Router();
providerWorkSessionsRouter.use(verifyUserToken);
providerWorkSessionsRouter.use(requireRole('PROVIDER'));
providerWorkSessionsRouter.post('/:id/work-session/arrive', arriveAtSite);
providerWorkSessionsRouter.get('/:id/work-session', getProviderWorkSession);
providerWorkSessionsRouter.post('/:id/work-session/proceed-anyway', proceedAnyway);
providerWorkSessionsRouter.post('/:id/work-session/clock-in', clockIn);
providerWorkSessionsRouter.post('/:id/work-session/clock-out', clockOut);
providerWorkSessionsRouter.post('/:id/work-session/complete', completeSession);
providerWorkSessionsRouter.put('/:id/work-session/before-photos', setBeforePhotos);
providerWorkSessionsRouter.delete('/:id/work-session/before-photos/:photoId', deleteBeforePhoto);
providerWorkSessionsRouter.put('/:id/work-session/final-photos', setFinalPhotos);
providerWorkSessionsRouter.delete('/:id/work-session/final-photos/:photoId', deleteFinalPhoto);
providerWorkSessionsRouter.post('/:id/work-session/progress-stages', upsertProgressStage);
providerWorkSessionsRouter.delete('/:id/work-session/progress-stages/:stageId', deleteProgressStage);
providerWorkSessionsRouter.post('/:id/work-session/reopen', reopenSession);

// Mounted at /api/client/work-sessions
export const clientWorkSessionsRouter = Router();
clientWorkSessionsRouter.use(verifyUserToken);
clientWorkSessionsRouter.use(requireRole('CLIENT'));
clientWorkSessionsRouter.get('/:id/work-session', getClientWorkSession);
clientWorkSessionsRouter.post('/:id/work-session/confirm-gate', confirmGate);
clientWorkSessionsRouter.post('/:id/work-session/deny-gate', denyGate);
clientWorkSessionsRouter.post('/:id/work-session/retroactive', retroactiveResponse);
