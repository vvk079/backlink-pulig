import express, { type Application, type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { registerRoutes } from './routes/index.js';

export function createApp(): Application {
  const app = express();
  app.disable('x-powered-by');

  // CORS - allow all origins for WordPress plugins
  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-API-Key'],
    })
  );

  // JSON body parsing - 10MB limit for index payloads
  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Register API routes
  registerRoutes(app);

  // Error handler
  const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  };

  app.use(errorHandler);

  return app;
}

export default createApp();