import { Router } from 'express';
import { submitRegistrationRequest } from '../controllers/registration.controller';

const router = Router();
router.post('/submit', submitRegistrationRequest);

export default router;