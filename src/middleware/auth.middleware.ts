import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { unifiedResponse } from 'uni-response';

import { env } from '../config/env-config';

const secret: Secret = env.JWT_SECRET as string;

// JWT payload for voice platform
interface AuthPayload {
  userId: string;
  tenantId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'SUPER_ADMIN';
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      tenantId?: string;
      userRole?: string;
    }
  }
}

/**
 * Multi-tenant authentication middleware.
 * Extracts userId, tenantId, and role from JWT.
 */
export function auth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json(unifiedResponse(false, 'No token provided'));
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json(unifiedResponse(false, 'Invalid or expired token'));
    return;
  }
}

/**
 * Role-based access control.
 * Checks if user has one of the allowed roles.
 *
 * Usage: router.get('/admin', auth, requireRole(['OWNER', 'ADMIN']), handler)
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      res.status(403).json(unifiedResponse(false, 'Forbidden: Insufficient permissions'));
      return;
    }
    next();
  };
}

/**
 * Super admin guard. Only SUPER_ADMIN role can access.
 * SUPER_ADMIN is platform-level, not tenant-scoped.
 *
 * Usage: router.get('/admin/tenants', auth, superAdminOnly, handler)
 */
export function superAdminOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== 'SUPER_ADMIN') {
    res.status(403).json(unifiedResponse(false, 'Forbidden: Super admin access required'));
    return;
  }
  next();
}

/**
 * Tenant scope enforcer.
 * Ensures the tenant in the URL param matches the user's tenantId.
 * SUPER_ADMIN bypasses this check (can access any tenant).
 *
 * Usage: router.get('/tenants/:tenantId/calls', auth, tenantScope, handler)
 */
export function tenantScope(req: Request, res: Response, next: NextFunction): void {
  const paramTenantId = req.params.tenantId || req.params.id;

  // Super admins can access any tenant
  if (req.userRole === 'SUPER_ADMIN') {
    next();
    return;
  }

  if (!paramTenantId || paramTenantId !== req.tenantId) {
    res.status(403).json(unifiedResponse(false, 'Forbidden: Cannot access another tenant\'s data'));
    return;
  }
  next();
}

/**
 * Webhook authentication middleware.
 * Verifies webhook signatures from Exotel/Plivo.
 * Falls back to WEBHOOK_SECRET header check if no provider-specific signature.
 */
export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  const webhookSecret = env.WEBHOOK_SECRET;

  // If no webhook secret configured, allow all (development mode)
  if (!webhookSecret) {
    next();
    return;
  }

  // Check X-Webhook-Secret header
  const providedSecret = req.headers['x-webhook-secret'] as string;
  if (providedSecret === webhookSecret) {
    next();
    return;
  }

  const payload = JSON.stringify(req.body);

  const exotelSignature = req.headers['x-exotel-signature'] as string | undefined;
  if (exotelSignature && env.EXOTEL_WEBHOOK_SECRET) {
    const expected = crypto.createHmac('sha1', env.EXOTEL_WEBHOOK_SECRET).update(payload).digest('base64');
    if (expected === exotelSignature) {
      next();
      return;
    }
  }

  const plivoSignature = req.headers['x-plivo-signature'] as string | undefined;
  const plivoNonce = req.headers['x-plivo-signature-nonce'] as string | undefined;
  if (plivoSignature && plivoNonce && env.PLIVO_WEBHOOK_SECRET) {
    const expected = crypto
      .createHmac('sha256', env.PLIVO_WEBHOOK_SECRET)
      .update(plivoNonce + payload)
      .digest('base64');
    if (expected === plivoSignature) {
      next();
      return;
    }
  }

  const twilioSignature = req.headers['x-twilio-signature'] as string | undefined;
  if (twilioSignature && env.TWILIO_AUTH_TOKEN) {
    const configuredBase = env.PUBLIC_WEBHOOK_BASE_URL;
    const fullUrl = configuredBase
      ? `${configuredBase}${req.originalUrl}`
      : `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    const params = req.body as Record<string, unknown>;
    const payloadString = Object.keys(params)
      .sort()
      .map(key => `${key}${Array.isArray(params[key]) ? params[key].join('') : String(params[key] ?? '')}`)
      .join('');

    const expected = crypto.createHmac('sha1', env.TWILIO_AUTH_TOKEN).update(fullUrl + payloadString).digest('base64');
    if (expected === twilioSignature) {
      next();
      return;
    }
  }

  res.status(401).json(unifiedResponse(false, 'Webhook signature verification failed'));
  return;
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(userId: string, tenantId: string, role: string): string {
  return jwt.sign({ userId, tenantId, role }, secret, { expiresIn: '24h' });
}
