import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { getEventImageKeyFromUrl } from '../../src/utils/eventImageUpload';

const r2EnvNames = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
] as const;

const originalEnv = Object.fromEntries(r2EnvNames.map(name => [name, process.env[name]]));

before(() => {
  process.env.R2_ACCOUNT_ID = 'test-account';
  process.env.R2_ACCESS_KEY_ID = 'test-access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.R2_BUCKET_NAME = 'test-bucket';
  process.env.R2_PUBLIC_BASE_URL = 'https://images.example.com/tickify/';
});

after(() => {
  for (const name of r2EnvNames) {
    const originalValue = originalEnv[name];
    if (originalValue === undefined) delete process.env[name];
    else process.env[name] = originalValue;
  }
});

describe('getEventImageKeyFromUrl', () => {
  it('extracts an event object key from the configured R2 public URL', () => {
    assert.equal(
      getEventImageKeyFromUrl('https://images.example.com/tickify/events/2026/08/image.webp'),
      'events/2026/08/image.webp',
    );
  });

  it('ignores external URLs and lookalike path prefixes', () => {
    assert.equal(
      getEventImageKeyFromUrl('https://other.example.com/tickify/events/2026/08/image.webp'),
      undefined,
    );
    assert.equal(
      getEventImageKeyFromUrl('https://images.example.com/tickify-copy/events/2026/08/image.webp'),
      undefined,
    );
  });

  it('rejects decoded path traversal', () => {
    assert.equal(
      getEventImageKeyFromUrl('https://images.example.com/tickify/events/%2E%2E/private.txt'),
      undefined,
    );
  });
});
