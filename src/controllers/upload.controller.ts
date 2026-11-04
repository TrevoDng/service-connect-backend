// src/controllers/upload.controller.ts
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';

export const uploadImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.error('No file uploaded', 400, 'NO_FILE');
  }

  const { entityType, entityId, category } = req.body;

  // Construct the public URL. 
  // Assuming the backend serves static files from the root, 
  // the URL will be /uploads/{entityType}/{entityId}/{category}/{filename}
  const fileUrl = `/uploads/${entityType}/${entityId}/${category}/${req.file.filename}`;

  res.success({ url: fileUrl }, 'File uploaded successfully');
});

export const uploadPublicDocument = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.error('No file uploaded', 400, 'NO_FILE');
  }

  const { entityId } = req.body;
  const fileUrl = `/uploads/registrations/${entityId}/documents/${req.file.filename}`;

  res.success({ url: fileUrl }, 'Document uploaded successfully');
});