// Vercel serverless function — wraps the Express app.
// All /api/* requests are routed here by vercel.json rewrites.
const app = require('../backend/src/app');
module.exports = app;
