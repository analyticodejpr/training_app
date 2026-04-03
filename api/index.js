// Vercel Serverless Function — wraps the Express app.
// All /api/* requests are routed here by vercel.json.
const app = require('../backend/src/app');
module.exports = app;
