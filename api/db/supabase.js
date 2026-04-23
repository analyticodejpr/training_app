const { createClient } = require('@supabase/supabase-js')

const supabaseUrl  = process.env.SUPABASE_URL
const anonKey      = process.env.SUPABASE_ANON_KEY
// Supabase new-format secret key (sb_secret_...) or legacy service role JWT — both bypass RLS.
const serviceKey   = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey) {
  console.warn(
    '[supabase] SUPABASE_URL or SUPABASE_ANON_KEY is not set in backend/.env. ' +
    'Supabase persistence will be unavailable.'
  )
}

// Service-role client — used for all server-side DB writes.
// Bypasses RLS; all writes must still be scoped to the verified user_id from JWT verification.
const supabase = supabaseUrl && (serviceKey || anonKey)
  ? createClient(supabaseUrl, serviceKey || anonKey, {
      auth: { persistSession: false },
    })
  : null

// Separate anon client used exclusively to verify user JWTs.
// Do not use this for DB writes; use the service-role client above.
const _supabaseAnon = supabaseUrl && anonKey
  ? createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    })
  : null

/**
 * Verify a Supabase access token and return the user, or null on failure.
 * Makes a single HTTP call to Supabase Auth to confirm token validity.
 */
async function getUserFromToken(accessToken) {
  if (!_supabaseAnon || !accessToken) return null
  const { data: { user }, error } = await _supabaseAnon.auth.getUser(accessToken)
  if (error) return null
  return user
}

module.exports = { supabase, getUserFromToken }
