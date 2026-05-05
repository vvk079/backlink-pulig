import crypto from 'node:crypto';

const API_KEY_PREFIX = 'bex_';
const API_KEY_LENGTH = 32;

export interface ApiKey {
  raw: string;
  hash: string;
}

export function generateApiKey(): ApiKey {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  const raw = API_KEY_PREFIX + randomBytes.toString('base64url');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length === API_KEY_PREFIX.length + 43;
}