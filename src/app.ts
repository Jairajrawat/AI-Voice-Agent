import { clerkMiddleware } from '@clerk/express';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';

import { env } from './config/env-config';
import agentConfigRoutes from './features/agent-config/routes/agent-config.routes';
import authRoutes from './features/auth/routes/auth.routes';
import callerRoutes from './features/callers/routes/caller.routes';
import internalCallRoutes from './features/calls/internal/routes/internal.routes';
import callRoutes from './features/calls/routes/call.routes';
import knowledgeRoutes from './features/knowledge/routes/knowledge.routes';
import phoneNumberRoutes from './features/phone-numbers/routes/phone-number.routes';
import tenantRoutes from './features/tenant/routes/tenant.routes';
import userRoutes from './features/tenant-users/routes/user.routes';
import testRoutes from './features/test/routes/test.routes';
import exotelWebhookRoutes from './features/webhooks/exotel/exotel.routes';
import plivoWebhookRoutes from './features/webhooks/plivo/plivo.routes';
import twilioWebhookRoutes from './features/webhooks/twilio/twilio.routes';
import { apiErrorHandler, unmatchedRoutes } from './middleware/api-error.middleware';
import {
  attachUserContext,
  requireApiAuth,
  requireTenantScope,
} from './middleware/clerk-auth.middleware';
import { loggerMiddleware, pinoLogger } from './middleware/pino-logger';
import { rateLimiter } from './middleware/security.middleware';

const app: Application = express();

app.use(rateLimiter);
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(clerkMiddleware());
app.use(loggerMiddleware);
app.use(pinoLogger);

app.get('/heartbeat', (req: Request, res: Response): void => {
  req.log.info('Heartbeat ok');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/v1/auth', authRoutes);

if (env.NODE_ENV === 'production') {
  app.use('/v1/tenants', requireApiAuth, attachUserContext, tenantRoutes);
  app.use(
    '/v1/tenants/:tenantId/users',
    requireApiAuth,
    attachUserContext,
    requireTenantScope('tenantId'),
    userRoutes,
  );
  app.use(
    '/v1/tenants/:tenantId/agent-config',
    requireApiAuth,
    attachUserContext,
    requireTenantScope('tenantId'),
    agentConfigRoutes,
  );
  app.use(
    '/v1/tenants/:tenantId/phone-numbers',
    requireApiAuth,
    attachUserContext,
    requireTenantScope('tenantId'),
    phoneNumberRoutes,
  );
  app.use(
    '/v1/tenants/:tenantId/calls',
    requireApiAuth,
    attachUserContext,
    requireTenantScope('tenantId'),
    callRoutes,
  );
  app.use(
    '/v1/tenants/:tenantId/callers',
    requireApiAuth,
    attachUserContext,
    requireTenantScope('tenantId'),
    callerRoutes,
  );
  app.use(
    '/v1/tenants/:tenantId/knowledge',
    requireApiAuth,
    attachUserContext,
    requireTenantScope('tenantId'),
    knowledgeRoutes,
  );
} else {
  app.use('/v1/tenants', tenantRoutes);
  app.use('/v1/tenants/:tenantId/users', userRoutes);
  app.use('/v1/tenants/:tenantId/agent-config', agentConfigRoutes);
  app.use('/v1/tenants/:tenantId/phone-numbers', phoneNumberRoutes);
  app.use('/v1/tenants/:tenantId/calls', callRoutes);
  app.use('/v1/tenants/:tenantId/callers', callerRoutes);
  app.use('/v1/tenants/:tenantId/knowledge', knowledgeRoutes);
  app.use('/test', testRoutes);
}

app.use('/webhooks/exotel', exotelWebhookRoutes);
app.use('/webhooks/plivo', plivoWebhookRoutes);
app.use('/webhooks/twilio', twilioWebhookRoutes);
app.use('/api/internal/calls/:callId', internalCallRoutes);

app.use(apiErrorHandler);
app.use(unmatchedRoutes);

export { app };
