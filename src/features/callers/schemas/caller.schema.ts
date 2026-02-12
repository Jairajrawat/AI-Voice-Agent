import { z } from 'zod';

export const updateCallerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  preferences: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const listCallersQuerySchema = z.object({
  page: z.string().optional().transform(Number).default('1'),
  limit: z.string().optional().transform(Number).default('10'),
  isSaved: z
    .string()
    .optional()
    .transform(val => val === 'true'),
  search: z.string().optional(),
});

export type UpdateCallerInput = z.infer<typeof updateCallerSchema>;
export type ListCallersQuery = z.infer<typeof listCallersQuerySchema>;
