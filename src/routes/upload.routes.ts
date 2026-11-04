import { Router } from 'express';
import { upload, publicUpload } from '../middleware/upload.middleware'; // <-- Add publicUpload
import { uploadImage, uploadPublicDocument } from '../controllers/upload.controller'; // <-- Add uploadPublicDocument
import { verifyUserToken } from '../services/auth.service';

const router = Router();

// Public route for registration documents (no auth required)
router.post(
  '/public',
  publicUpload.single('file'),
  uploadPublicDocument
);

// Protected route for all other uploads
router.post(
  '/',
  verifyUserToken,
  upload.single('file'),
  uploadImage
);

export default router;