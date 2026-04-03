// Response cache — in-memory per server instance.
// Token storage has moved to encrypted cookie sessions (req.session).
// See app.js for the cookie-session middleware setup.

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

module.exports = { setCache, getCache, clearCache };
