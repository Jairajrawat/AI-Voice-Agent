import { clerkMiddleware, getAuth, requireAuth } from '@clerk/express';
import { NextFunction, Request, Response } from 'express';

import { env } from '../config/env-config';
import { PrismaService } from '../config/prisma.config';

// Re-export clerkMiddleware for global use
export { clerkMiddleware, requireAuth };

/**
 * Custom API authentication middleware
 * Returns 401 JSON response for unauthenticated API requests
 * Use this for API routes (not for full-stack routes)
 */
export const requireApiAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = getAuth(req);

    if (!auth?.userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid authentication',
    });
  }
};

/**
 * Middleware to attach user and tenant info to request
 * Must be used after clerkMiddleware
 */
export const attachUserContext = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = getAuth(req);
    const clerkId = auth?.userId;

    if (!clerkId) {
      // No auth, skip attaching user context
      next();
      return;
    }

    // Find user by clerkId and attach tenant info
    const prisma = PrismaService.getInstance().client;
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { tenant: true },
    });

    if (!user) {
      // User authenticated with Clerk but not in our DB yet
      // This can happen after first signup before webhook sync
      (req as any).auth = {
        userId: clerkId,
        user: null,
        tenantId: null,
        role: null,
      };
      next();
      return;
    }

    // Attach user context to request
    (req as any).auth = {
      userId: clerkId,
      user: user,
      tenantId: user.tenantId,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Error attaching user context:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Middleware to check if user has required role
 * Must be used after attachUserContext middleware
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as any).auth?.role;

    if (!role) {
      res.status(403).json({
        success: false,
        message: 'User role not found',
      });
      return;
    }

    if (!allowedRoles.includes(role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to require tenant membership
 * Must be used after attachUserContext middleware
 */
export const requireTenant = (req: Request, res: Response, next: NextFunction): void => {
  const tenantId = (req as any).auth?.tenantId;

  if (!tenantId) {
    res.status(403).json({
      success: false,
      message: 'User not associated with any tenant',
    });
    return;
  }

  next();
};

/**
 * Enforce tenant scope from route params.
 * SUPER_ADMIN can access any tenant.
 */
export const requireTenantScope = (
  paramName: 'tenantId' | 'id' = 'tenantId',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authContext = (req as any).auth as
      | { tenantId?: string | null; role?: string | null }
      | undefined;
    const routeTenantId = req.params[paramName];

    if (!routeTenantId) {
      res.status(400).json({
        success: false,
        message: 'Tenant route parameter missing',
      });
      return;
    }

    if (authContext?.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    if (!authContext?.tenantId || authContext.tenantId !== routeTenantId) {
      res.status(403).json({
        success: false,
        message: "Forbidden: cannot access another tenant's data",
      });
      return;
    }

    next();
  };
};

/**
 * Combined middleware for protected API routes with full context
 * Usage: app.get('/api/protected', requireAuthWithContext, handler)
 */
export const requireAuthWithContext = [requireApiAuth, attachUserContext, requireTenant];

/**
 * Get current auth context from request
 * Returns null if not authenticated
 */
export const getAuthContext = (
  req: Request,
): {
  userId: string | null;
  user: any | null;
  tenantId: string | null;
  role: string | null;
} => {
  return (
    (req as any).auth || {
      userId: null,
      user: null,
      tenantId: null,
      role: null,
    }
  );
};
