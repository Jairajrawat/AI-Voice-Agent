import { Router } from 'express';

import { exotelWebhookMiddleware } from '../../../middleware/webhook-auth.middleware';
import { ExotelWebhookController } from './exotel-webhook.controller';

const router = Router();
const exotelWebhookController = new ExotelWebhookController();

// Exotel incoming call webhook
router.post('/incoming', ...exotelWebhookMiddleware, exotelWebhookController.handleIncomingCall);

// Exotel status callback webhook
router.post('/status', ...exotelWebhookMiddleware, exotelWebhookController.handleStatusCallback);

export default router;
