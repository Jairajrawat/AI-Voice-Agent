import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';

import { env } from './config/env-config';
import { apiErrorHandler, unmatchedRoutes } from './middleware/api-error.middleware';
import { pinoLogger, loggerMiddleware } from './middleware/pino-logger';
import { hostWhitelist, rateLimiter } from './middleware/security.middleware';

const app: Application = express();

// Security middleware
app.use(rateLimiter);
app.use(helmet());

// Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For webhook form data
app.use(cors());

// Logging
app.use(loggerMiddleware);
app.use(pinoLogger);

// Health check
app.get('/heartbeat', (req: Request, res: Response): void => {
  req.log.info('Heartbeat ok');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
  return;
});

// ─── API Routes (added as feature modules are built) ───
// app.use('/v1/tenants', tenantRoutes);
// app.use('/v1/admin', superAdminRoutes);

// ─── Webhook Routes (no auth — verified by signature) ───
// app.use('/webhooks', webhookRoutes);

// ─── Internal API Routes (Vocode → Backend) ───
// app.use('/api/calls', callRoutes);

// Error Handling
app.use(apiErrorHandler);
app.use(unmatchedRoutes);

export { app };
