import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Event from '../models/event.model';

dotenv.config();

const uploadRoot = path.resolve(process.cwd(), 'uploads');
const eventUploadDir = path.join(uploadRoot, 'events');
fs.mkdirSync(eventUploadDir, { recursive: true });

const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

const parseDataUrl = (value?: string) => {
  if (!value?.startsWith('data:image')) return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
};

const saveImage = async (eventId: string, field: 'poster' | 'banner', value?: string) => {
  const parsed = parseDataUrl(value);
  if (!parsed) return value;

  const ext = mimeToExt[parsed.mime] || '.jpg';
  const filename = `${Date.now()}-${eventId}-${field}${ext}`;
  const filePath = path.join(eventUploadDir, filename);
  await fs.promises.writeFile(filePath, parsed.buffer);

  const baseUrl = (process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  return `${baseUrl}/api/v1/uploads/events/${filename}`;
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('Missing MONGO_URI in .env');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const events = await Event.find({
    $or: [
      { poster_url: /^data:image/ },
      { banner_url: /^data:image/ },
    ],
  });

  console.log(`Found ${events.length} event(s) with base64 images.`);

  for (const event of events) {
    const eventId = String(event._id);
    const nextPosterUrl = await saveImage(eventId, 'poster', event.poster_url);
    const nextBannerUrl = await saveImage(eventId, 'banner', event.banner_url);

    event.poster_url = nextPosterUrl || '';
    event.banner_url = nextBannerUrl || '';
    await event.save();
    console.log(`Migrated event ${eventId}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
