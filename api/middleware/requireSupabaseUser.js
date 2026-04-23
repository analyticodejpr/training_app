const { getUserFromToken } = require('../db/supabase');

/**
 * Express middleware that validates a Supabase user JWT from the
 * X-Supabase-Token request header. Attaches the verified user to
 * req.supabaseUser. Returns 401 if the token is missing or invalid.
 *
 * Usage:
 *   router.post('/my-endpoint', requireSupabaseUser, handler)
 */
async function requireSupabaseUser(req, res, next) {
  const token = req.headers['x-supabase-token'];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.supabaseUser = user;
  next();
}

module.exports = { requireSupabaseUser };
