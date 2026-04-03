// Zero-dependency diagnostic endpoint.
// If /api/ping returns JSON, Vercel routing works.
// If it shows blank/HTML, the API routes aren't being reached at all.
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ pong: true, ts: new Date().toISOString() }));
};
