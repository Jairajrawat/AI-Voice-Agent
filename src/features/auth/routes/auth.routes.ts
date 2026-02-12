import { Router } from 'express';

import { ClerkWebhookController } from '../controllers/clerk-webhook.controller';

const router = Router();
const clerkWebhookController = new ClerkWebhookController();

// Clerk webhook endpoint (public, signature verified in controller)
router.post('/webhook/clerk', clerkWebhookController.handleWebhook);

// Get current authenticated user info
router.get('/me', (req, res) => {
  // This will be protected by middleware in app.ts
  res.json({
    success: true,
    message: 'User info endpoint',
  });
});

export default router;
