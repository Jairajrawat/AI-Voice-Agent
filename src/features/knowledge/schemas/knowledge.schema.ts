import { z } from 'zod';

export const createKnowledgeItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  category: z.string().optional(),
});

export const updateKnowledgeItemSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(10).optional(),
  category: z.string().optional(),
});

export const searchKnowledgeSchema = z.object({
  query: z.string().min(1),
  limit: z.string().optional().transform(Number).default('5'),
});

export type CreateKnowledgeItemInput = z.infer<typeof createKnowledgeItemSchema>;
export type UpdateKnowledgeItemInput = z.infer<typeof updateKnowledgeItemSchema>;
export type SearchKnowledgeInput = z.infer<typeof searchKnowledgeSchema>;
