require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const healthRoutes = require('../routes/health.routes');
const localize = require('../middleware/localize');

// Builds one of the split services: the same middleware stack as the
// single-process server, but only the routers that service owns.
//
//   name       label used in logs and the root route
//   beforeJson (app) => void   mount anything that needs the raw body
//   mount      (app) => void   mount the service's routers
//   onListen   (server) => void   start background work once listening
function runService({ name, beforeJson, mount, onListen }) {
  if (!process.env.JWT_SECRET) {
    console.error(`[${name}] JWT_SECRET is not set`);
    process.exit(1);
  }
  const app = express();
  const PORT = process.env.PORT || 4000;

  app.use(helmet());
  app.use(cors());
  if (beforeJson) beforeJson(app);
  app.use(express.json());
  app.use(localize);

  app.use('/', healthRoutes);
  mount(app);
  app.get('/', (req, res) => res.json({ service: name }));

  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`[${name}] service running on port ${PORT}`);
    if (onListen) onListen(server, app);
  });
  return { app, server };
}

module.exports = { runService };
