/**
 * Local development server entry point.
 * Starts the Express app on PORT (default 8080).
 *
 * Usage:
 *   node api/server.js
 *   PORT=8080 node api/server.js
 *
 * This file is NOT used by Vercel — Vercel uses api/[...path].js instead.
 * The .env file is loaded from the backend/ directory to reuse existing credentials.
 */

// Load env from backend/.env if no env is already set
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const app  = require('./app');
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`[api/server] listening on http://localhost:${PORT}`);
  console.log(`[api/server] Supabase URL: ${process.env.SUPABASE_URL ? '✓ set' : '✗ missing'}`);
});
