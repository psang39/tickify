import { S3Client } from '@aws-sdk/client-s3';

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
};

let r2Client: S3Client | undefined;
let clientConfigFingerprint: string | undefined;

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Cloudflare R2 environment variable: ${name}`);
  }
  return value;
};

export const getR2Config = (): R2Config => {
  const accountId = getRequiredEnv('R2_ACCOUNT_ID');
  const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');
  const bucketName = getRequiredEnv('R2_BUCKET_NAME');
  const publicBaseUrl = getRequiredEnv('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');

  let parsedPublicUrl: URL;
  try {
    parsedPublicUrl = new URL(publicBaseUrl);
  } catch {
    throw new Error('R2_PUBLIC_BASE_URL must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsedPublicUrl.protocol)) {
    throw new Error('R2_PUBLIC_BASE_URL must use http or https.');
  }
  if (parsedPublicUrl.search || parsedPublicUrl.hash) {
    throw new Error('R2_PUBLIC_BASE_URL must not include a query string or fragment.');
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl,
  };
};

export const getR2Client = () => {
  const config = getR2Config();
  const fingerprint = [config.accountId, config.accessKeyId, config.secretAccessKey].join(':');

  if (!r2Client || fingerprint !== clientConfigFingerprint) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    clientConfigFingerprint = fingerprint;
  }

  return r2Client;
};
