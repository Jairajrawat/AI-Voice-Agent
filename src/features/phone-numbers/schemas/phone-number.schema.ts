import { z } from 'zod';

export const providerEnum = z.enum(['EXOTEL', 'PLIVO', 'TWILIO', 'VONAGE']);

export const createPhoneNumberSchema = z.object({
  number: z.string().min(10, 'Phone number must be at least 10 digits'),
  provider: providerEnum.default('EXOTEL'),
  label: z.string().optional(), // e.g., "Main Line", "Support"
  tenantId: z.string().uuid(),
});

export const updatePhoneNumberSchema = z.object({
  label: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreatePhoneNumberInput = z.infer<typeof createPhoneNumberSchema>;
export type UpdatePhoneNumberInput = z.infer<typeof updatePhoneNumberSchema>;
