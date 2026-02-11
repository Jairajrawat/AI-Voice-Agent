import { z } from 'zod';

export const industryEnum = z.enum(['HEALTHCARE', 'RESTAURANT', 'SERVICES', 'RETAIL', 'OTHER']);

export const planEnum = z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']);

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),
  industry: industryEnum,
  dataRetentionDays: z.number().int().min(1).max(365).default(15),
  saveCallRecordings: z.boolean().default(false),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  industry: industryEnum.optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL']).optional(),
  plan: planEnum.optional(),
  dataRetentionDays: z.number().int().min(1).max(365).optional(),
  saveCallRecordings: z.boolean().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
