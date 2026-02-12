import { clerkMiddleware } from '@clerk/express';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';

import agentConfigRoutes from './features/agent-config/routes/agent-config.routes';
import authRoutes from './features/auth/routes/auth.routes';
import callRoutes from './features/calls/routes/call.routes';
import internalCallRoutes from './features/calls/internal/routes/internal.routes';
import callerRoutes from './features/callers/routes/caller.routes';
import knowledgeRoutes from './features/knowledge/routes/knowledge.routes';
import phoneNumberRoutes from './features/phone-numbers/routes/phone-number.routes';
import tenantRoutes from './features/tenant/routes/tenant.routes';
import userRoutes from './features/tenant-users/routes/user.routes';
import exotelWebhookRoutes from './features/webhooks/exotel/exotel.routes';
import plivoWebhookRoutes from './features/webhooks/plivo/plivo.routes';
import testRoutes from './features/test/routes/test.routes';
import { apiErrorHandler, unmatchedRoutes } from './middleware/api-error.middleware';
import { attachUserContext } from './middleware/clerk-auth.middleware';
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

// Clerk Authentication Middleware (attaches auth to request)
app.use(clerkMiddleware());

// Logging
app.use(loggerMiddleware);
app.use(pinoLogger);

// Health check
app.get('/heartbeat', (req: Request, res: Response): void => {
  req.log.info('Heartbeat ok');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
  return;
});

// ─── Public Routes ───
app.use('/v1/auth', authRoutes);
app.use('/v1/tenants', tenantRoutes);
app.use('/v1/tenants/:tenantId/users', userRoutes);
app.use('/v1/tenants/:tenantId/agent-config', agentConfigRoutes);
app.use('/v1/tenants/:tenantId/phone-numbers', phoneNumberRoutes);
app.use('/v1/tenants/:tenantId/calls', callRoutes);
app.use('/v1/tenants/:tenantId/callers', callerRoutes);
app.use('/v1/tenants/:tenantId/knowledge', knowledgeRoutes);

// ─── Testing Routes (development only) ───
app.use('/test', testRoutes);

// ─── API Routes (protected by Clerk auth) ───
app.use(attachUserContext);
// app.use('/v1/tenants', requireApiAuth, tenantRoutes);
// app.use('/v1/admin', requireApiAuth, superAdminRoutes);

// ─── Webhook Routes (no auth — verified by signature) ───
app.use('/webhooks/exotel', exotelWebhookRoutes);
app.use('/webhooks/plivo', plivoWebhookRoutes);

// ─── Internal API Routes (Vocode → Backend) ───
app.use('/api/internal/calls/:callId', internalCallRoutes);

// Error Handling
app.use(apiErrorHandler);
app.use(unmatchedRoutes);

export { app };
