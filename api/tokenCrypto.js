// Encrypt/decrypt session data for URL-safe token passing.
// Used to move OAuth tokens from backend callback → frontend via URL hash.
const crypto = require('crypto');

const ALGO    = 'aes-256-gcm';
const KEY_LEN = 32;

function getKey() {
  const secret = process.env.SESSION_SECRET || 'dev-secret-change-in-prod';
  return crypto.scryptSync(secret, 'training-hub-v1', KEY_LEN);
}

function encrypt(obj) {
  const key    = getKey();
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc    = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

function decrypt(token) {
  try {
    const buf     = Buffer.from(token, 'base64url');
    const iv      = buf.subarray(0, 12);
    const tag     = buf.subarray(12, 28);
    const enc     = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };
