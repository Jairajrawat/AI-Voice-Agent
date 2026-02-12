import { z } from 'zod';

export const callStatusEnum = z.enum([
  'RINGING',
  'CONNECTING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'NO_ANSWER',
  'TRANSFERRED',
]);

export const callDirectionEnum = z.enum(['INBOUND', 'OUTBOUND']);

export const createCallSchema = z.object({
  externalId: z.string(),
  tenantId: z.string().uuid(),
  phoneNumberId: z.string().uuid(),
  callerId: z.string().uuid(),
  direction: callDirectionEnum.default('INBOUND'),
  status: callStatusEnum.default('RINGING'),
});

export const updateCallSchema = z.object({
  status: callStatusEnum.optional(),
  summary: z.string().optional(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
});

export const listCallsQuerySchema = z.object({
  page: z.string().optional().transform(Number).default('1'),
  limit: z.string().optional().transform(Number).default('10'),
  status: callStatusEnum.optional(),
  from: z.string().optional(), // date filter
  to: z.string().optional(), // date filter
});

export type CreateCallInput = z.infer<typeof createCallSchema>;
export type UpdateCallInput = z.infer<typeof updateCallSchema>;
export type ListCallsQuery = z.infer<typeof listCallsQuerySchema>;
