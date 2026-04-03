let app;
try {
  app = require('./app');
} catch (err) {
  // If Express fails to load, return the error as JSON so we can debug
  app = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ startup_error: err.message, stack: err.stack }));
  };
}
module.exports = app;
