import { randomUUID } from 'crypto';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import { getR2Client, getR2Config } from '../config/r2Client';

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export type UploadedEventImage = {
  key: string;
  url: string;
};

export const eventImageUpload = multer({
  storage: multer.memoryStorage(),
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

const buildEventImageKey = (mimeType: string) => {
  const extension = extensionByMimeType[mimeType];
  if (!extension) {
    throw new Error(`Unsupported event image type: ${mimeType}`);
  }

  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `events/${now.getUTCFullYear()}/${month}/${randomUUID()}.${extension}`;
};

const buildPublicUrl = (key: string) => {
  const { publicBaseUrl } = getR2Config();
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${publicBaseUrl}/${encodedKey}`;
};

export const uploadEventImageBuffer = async (
  buffer: Buffer,
  mimeType: string,
): Promise<UploadedEventImage> => {
  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error(`Unsupported event image type: ${mimeType}`);
  }

  const { bucketName } = getR2Config();
  const key = buildEventImageKey(mimeType);

  await getR2Client().send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { key, url: buildPublicUrl(key) };
};

export const uploadEventImage = async (file?: Express.Multer.File) => {
  if (!file) return undefined;
  return uploadEventImageBuffer(file.buffer, file.mimetype);
};

export const deleteEventImageByKey = async (key?: string | null) => {
  if (!key || !key.startsWith('events/') || key.includes('..')) return;

  const { bucketName } = getR2Config();
  await getR2Client().send(new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  }));
};

export const getEventImageKeyFromUrl = (imageUrl?: string | null) => {
  if (!imageUrl) return undefined;

  let publicUrl: URL;
  let candidateUrl: URL;
  try {
    publicUrl = new URL(getR2Config().publicBaseUrl);
    candidateUrl = new URL(imageUrl);
  } catch {
    return undefined;
  }

  if (candidateUrl.origin !== publicUrl.origin) return undefined;

  const basePath = publicUrl.pathname.replace(/\/+$/, '');
  const keyPrefix = `${basePath}/`;
  if (!candidateUrl.pathname.startsWith(keyPrefix)) return undefined;

  let key: string;
  try {
    key = decodeURIComponent(candidateUrl.pathname.slice(keyPrefix.length));
  } catch {
    return undefined;
  }

  return key.startsWith('events/') && !key.includes('..') ? key : undefined;
};

export const deleteEventImage = async (imageUrl?: string | null) => {
  const key = getEventImageKeyFromUrl(imageUrl);
  if (key) await deleteEventImageByKey(key);
};
