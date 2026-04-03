// Pure-JS file-based store — no native compilation required.
// Tokens → data/tokens.json  |  Cache → in-memory Map (cleared on restart)
const path = require('path');
const fs   = require('fs');

const DATA_DIR    = path.join(__dirname, '../../data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── token store (persisted to disk) ──────────────────────────────────────────

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

// ── response cache (in-memory, resets on server restart) ─────────────────────

const _cache = new Map(); // key → { data, cachedAt, ttlSeconds }

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
