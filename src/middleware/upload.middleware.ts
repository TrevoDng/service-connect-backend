// src/middleware/upload.middleware.ts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Ensure the base uploads directory exists
const baseUploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(baseUploadDir)) {
  fs.mkdirSync(baseUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    // We expect the frontend to send these in the body
    const { entityType, entityId, category } = req.body;

    // Validate required fields
    if (!entityType || !entityId || !category) {
      return cb(new Error('Missing entityType, entityId, or category in request body'), '');
    }

    // Sanitize strings to prevent directory traversal
    const safeEntity = String(entityType).replace(/[^a-zA-Z0-9_-]/g, '');
    const safeId = String(entityId).replace(/[^a-zA-Z0-9_-]/g, '');
    const safeCategory = String(category).replace(/[^a-zA-Z0-9_-]/g, '');

    // Build the path: uploads/bookings/b-123/consultation/
    const targetDir = path.join(baseUploadDir, safeEntity, safeId, safeCategory);

    // Create the directories if they don't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    cb(null, targetDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate a unique filename: timestamp-random.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// File filter (only images)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow images AND PDFs for registration documents
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image files and PDFs are allowed!'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Public upload storage for registration documents
const publicStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    const { entityId } = req.body;
    if (!entityId) {
      return cb(new Error('Missing entityId in request body'), '');
    }
    const safeId = String(entityId).replace(/[^a-zA-Z0-9_-]/g, '');
    // Force it to save in registrations folder
    const targetDir = path.join(baseUploadDir, 'registrations', safeId, 'documents');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const publicUpload = multer({
  storage: publicStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});