import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Event from '../models/event.model';
import { getR2Config } from '../config/r2Client';
import {
  deleteEventImageByKey,
  uploadEventImageBuffer,
  UploadedEventImage,
} from '../utils/eventImageUpload';

dotenv.config();

const legacyUrlMarker = '/api/v1/uploads/events/';
const legacyUploadDirectory = process.env.LEGACY_EVENT_IMAGE_DIR
  ? path.resolve(process.env.LEGACY_EVENT_IMAGE_DIR)
  : path.resolve(__dirname, '../../uploads/events');
const isDryRun = process.argv.includes('--dry-run');

const mimeTypeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

type ImageField = 'poster_url' | 'banner_url';

type PlannedImage = {
  field: ImageField;
  legacyUrl: string;
  filename: string;
  filePath: string;
  mimeType: string;
};

type EventMigrationPlan = {
  eventId: string;
  eventName: string;
  images: PlannedImage[];
};

const getLegacyFilename = (imageUrl: string) => {
  const markerIndex = imageUrl.indexOf(legacyUrlMarker);
  if (markerIndex === -1) return undefined;

  const encodedFilename = imageUrl
    .slice(markerIndex + legacyUrlMarker.length)
    .split(/[?#]/, 1)[0];

  let filename: string;
  try {
    filename = decodeURIComponent(encodedFilename);
  } catch {
    return undefined;
  }

  if (
    !filename
    || filename.includes('/')
    || filename.includes('\\')
    || filename.includes('..')
    || path.basename(filename) !== filename
  ) {
    return undefined;
  }

  return filename;
};

const planImage = (field: ImageField, imageUrl: unknown): PlannedImage | undefined => {
  if (typeof imageUrl !== 'string' || !imageUrl.includes(legacyUrlMarker)) return undefined;

  const filename = getLegacyFilename(imageUrl);
  if (!filename) throw new Error(`Invalid legacy image URL for ${field}: ${imageUrl}`);

  const extension = path.extname(filename).toLowerCase();
  const mimeType = mimeTypeByExtension[extension];
  if (!mimeType) {
    throw new Error(`Unsupported image extension for ${filename}`);
  }

  const filePath = path.resolve(legacyUploadDirectory, filename);
  if (path.dirname(filePath) !== legacyUploadDirectory) {
    throw new Error(`Unsafe legacy image path for ${filename}`);
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Missing backup file for ${field}: ${filePath}`);
  }

  return { field, legacyUrl: imageUrl, filename, filePath, mimeType };
};

const cleanupUploads = async (images: UploadedEventImage[]) => {
  const results = await Promise.allSettled(images.map(image => deleteEventImageByKey(image.key)));
  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error('[R2 migration cleanup error]', result.reason);
    }
  });
};

const createMigrationPlans = async (): Promise<EventMigrationPlan[]> => {
  const events = await Event.find({
    $or: [
      { poster_url: { $regex: legacyUrlMarker } },
      { banner_url: { $regex: legacyUrlMarker } },
    ],
  }).select('_id name poster_url banner_url').lean();

  return events.map(event => {
    const images = [
      planImage('poster_url', event.poster_url),
      planImage('banner_url', event.banner_url),
    ].filter((image): image is PlannedImage => Boolean(image));

    return {
      eventId: String(event._id),
      eventName: event.name || String(event._id),
      images,
    };
  });
};

const migrateEvent = async (plan: EventMigrationPlan) => {
  const uploadedImages: UploadedEventImage[] = [];
  const originalUrls: Partial<Record<ImageField, string>> = {};
  const nextUrls: Partial<Record<ImageField, string>> = {};

  try {
    for (const image of plan.images) {
      const buffer = await fs.promises.readFile(image.filePath);
      const uploadedImage = await uploadEventImageBuffer(buffer, image.mimeType);
      uploadedImages.push(uploadedImage);
      originalUrls[image.field] = image.legacyUrl;
      nextUrls[image.field] = uploadedImage.url;
    }

    const result = await Event.updateOne(
      { _id: plan.eventId, ...originalUrls },
      { $set: { ...nextUrls, updated_at: new Date() } },
    );

    if (result.matchedCount !== 1) {
      throw new Error(`Event ${plan.eventId} changed while it was being migrated; no database update was applied.`);
    }
  } catch (error) {
    await cleanupUploads(uploadedImages);
    throw error;
  }
};

const main = async () => {
  if (!process.env.URI) throw new Error('Missing URI in .env');
  if (!fs.existsSync(legacyUploadDirectory)) {
    throw new Error(`Legacy upload directory does not exist: ${legacyUploadDirectory}`);
  }

  getR2Config();
  await mongoose.connect(process.env.URI);

  try {
    const plans = await createMigrationPlans();
    const imageCount = plans.reduce((total, plan) => total + plan.images.length, 0);

    console.log(`Preflight passed: ${imageCount} image(s) across ${plans.length} event(s).`);
    console.log(`Backup directory: ${legacyUploadDirectory}`);

    if (isDryRun) {
      console.log('Dry run complete. No R2 objects or database records were changed.');
      return;
    }

    for (const plan of plans) {
      await migrateEvent(plan);
      console.log(`Migrated ${plan.images.length} image(s) for event ${plan.eventId} (${plan.eventName.trim()}).`);
    }

    console.log(`Migration complete: ${imageCount} image(s) across ${plans.length} event(s).`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch(async error => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
