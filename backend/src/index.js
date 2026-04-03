// Local development entry point — not used by Vercel.
const app  = require('./app');
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
