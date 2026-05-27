import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Request } from 'express';

const uploadRoot = path.resolve(process.cwd(), 'uploads');
const eventUploadDir = path.join(uploadRoot, 'events');

fs.mkdirSync(eventUploadDir, { recursive: true });

const safeFilename = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .slice(-80);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, eventUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'event-image', ext);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFilename(base)}${ext}`);
  },
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export const eventImageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP, GIF hoặc SVG.'));
    }
    cb(null, true);
  },
});

export const getUploadedEventImageUrl = (req: Request, file?: Express.Multer.File) => {
  if (!file) return undefined;

  const configuredBaseUrl = process.env.BACKEND_PUBLIC_URL?.replace(/\/$/, '');
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto || req.protocol;
  const host = req.get('host');
  const baseUrl = configuredBaseUrl || `${protocol}://${host}`;

  return `${baseUrl}/api/v1/uploads/events/${file.filename}`;
};

export const deleteLocalUploadedImage = (imageUrl?: string | null) => {
  if (!imageUrl) return;

  const marker = '/api/v1/uploads/events/';
  const markerIndex = imageUrl.indexOf(marker);
  if (markerIndex === -1) return;

  const filename = imageUrl.slice(markerIndex + marker.length).split(/[?#]/)[0];
  if (!filename || filename.includes('/') || filename.includes('..')) return;

  const filePath = path.join(eventUploadDir, filename);
  fs.promises.unlink(filePath).catch(() => undefined);
};
