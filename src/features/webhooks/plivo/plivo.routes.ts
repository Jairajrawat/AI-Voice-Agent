import { Router } from 'express';

import { plivoWebhookMiddleware } from '../../../middleware/webhook-auth.middleware';
import { PlivoWebhookController } from './plivo-webhook.controller';

const router = Router();
const plivoWebhookController = new PlivoWebhookController();

// Plivo incoming call webhook
router.post('/incoming', ...plivoWebhookMiddleware, plivoWebhookController.handleIncomingCall);

// Plivo status callback webhook
router.post('/status', ...plivoWebhookMiddleware, plivoWebhookController.handleStatusCallback);

export default router;
