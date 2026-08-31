import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Event from '../models/event.model';
import { uploadEventImageBuffer } from '../utils/eventImageUpload';

dotenv.config();

const parseDataUrl = (value?: string) => {
  if (!value?.startsWith('data:image')) return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
};

const saveImage = async (value?: string) => {
  const parsed = parseDataUrl(value);
  if (!parsed) return value;

  const uploadedImage = await uploadEventImageBuffer(parsed.buffer, parsed.mime);
  return uploadedImage.url;
};

const main = async () => {
  if (!process.env.URI) {
    throw new Error('Missing URI in .env');
  }

  await mongoose.connect(process.env.URI);
  const events = await Event.find({
    $or: [
      { poster_url: /^data:image/ },
      { banner_url: /^data:image/ },
    ],
  });

  console.log(`Found ${events.length} event(s) with base64 images.`);

  for (const event of events) {
    const eventId = String(event._id);
    const nextPosterUrl = await saveImage(event.poster_url);
    const nextBannerUrl = await saveImage(event.banner_url);

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
