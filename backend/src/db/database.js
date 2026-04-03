// Token store — file-based with /tmp fallback for serverless environments.
//
// On Vercel, the filesystem is read-only except for /tmp.
// On cold start, if no tokens.json exists in /tmp, we seed from env vars:
//   STRAVA_TOKENS — JSON string of the strava token object
//   WHOOP_TOKENS  — JSON string of the whoop token object
//
// The in-memory cache resets per function instance (expected behaviour).

const path = require('path');
const fs   = require('fs');

// Use /tmp when running on Vercel (or any read-only FS env), local data dir otherwise.
const IS_VERCEL  = !!process.env.VERCEL;
const DATA_DIR   = IS_VERCEL ? '/tmp' : path.join(__dirname, '../../data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

if (!IS_VERCEL && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Seed from env vars on cold start ─────────────────────────────────────────

function seedFromEnv() {
  if (!IS_VERCEL) return;
  if (fs.existsSync(TOKENS_FILE)) return; // already seeded this instance

  const store = {};
  try {
    if (process.env.STRAVA_TOKENS) store.strava = JSON.parse(process.env.STRAVA_TOKENS);
  } catch { /* invalid JSON — skip */ }
  try {
    if (process.env.WHOOP_TOKENS)  store.whoop  = JSON.parse(process.env.WHOOP_TOKENS);
  } catch { /* invalid JSON — skip */ }

  if (Object.keys(store).length) {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(store, null, 2));
  }
}

seedFromEnv();

// ── Token store (persisted to disk) ──────────────────────────────────────────

function readTokenStore() {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')); } catch { return {}; }
}

function writeTokenStore(store) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(store, null, 2));
}

function saveTokens(provider, { access_token, refresh_token, expires_at, athlete_id, scope }) {
  const store = readTokenStore();
  store[provider] = { provider, access_token, refresh_token, expires_at, athlete_id, scope };
  writeTokenStore(store);
}

function getTokens(provider) {
  return readTokenStore()[provider] || null;
}

function deleteTokens(provider) {
  const store = readTokenStore();
  delete store[provider];
  writeTokenStore(store);
}

// ── Response cache (in-memory, resets per instance) ──────────────────────────

const _cache = new Map();

function setCache(key, data, ttlSeconds = 300) {
  _cache.set(key, { data, cachedAt: Date.now(), ttlSeconds });
}

function getCache(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if ((Date.now() - entry.cachedAt) / 1000 > entry.ttlSeconds) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function clearCache(prefix) {
  for (const k of _cache.keys()) {
    if (k.startsWith(prefix)) _cache.delete(k);
  }
}

module.exports = { saveTokens, getTokens, deleteTokens, setCache, getCache, clearCache };
