import { getAuth } from '@clerk/express';
import { Request, Response } from 'express';
import { Router } from 'express';

import cleanupTestRoutes from './test-cleanup.routes';
import tenantTestRoutes from './test-tenant.routes';
import userTestRoutes from './test-user.routes';

const router = Router();

// Mount test routes
router.use('/', tenantTestRoutes);
router.use('/', userTestRoutes);
router.use('/', cleanupTestRoutes);

/**
 * Testing routes - No validation, for development only
 * These routes bypass normal validation for quick testing
 */

// Test Clerk authentication
router.get('/auth-test', (req: Request, res: Response) => {
  const auth = getAuth(req);

  res.json({
    success: true,
    message: 'Auth test endpoint',
    authenticated: !!auth?.userId,
    userId: auth?.userId || null,
    hasAuthObject: !!auth,
  });
});

// Test with required auth (will return 401 if not authenticated)
router.get('/auth-required', (req: Request, res: Response) => {
  const auth = getAuth(req);

  if (!auth?.userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  res.json({
    success: true,
    message: 'Protected endpoint',
    userId: auth.userId,
  });
});

export default router;
