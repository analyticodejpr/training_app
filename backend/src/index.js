// Local development entry point — not used by Vercel.
// Source of truth is api/app.js; this just starts the server locally.
const app  = require('../../api/app');
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
