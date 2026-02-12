import { z } from 'zod';

export const saveTranscriptSchema = z.object({
  role: z.enum(['CALLER', 'AGENT']),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export const saveExtractionSchema = z.object({
  type: z.string().min(1),
  data: z.record(z.any()),
  confidence: z.number().min(0).max(1).optional(),
});

export const completeCallSchema = z.object({
  summary: z.string().optional(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
});

export const transferCallSchema = z.object({
  transferTo: z.string().min(1),
});

export type SaveTranscriptInput = z.infer<typeof saveTranscriptSchema>;
export type SaveExtractionInput = z.infer<typeof saveExtractionSchema>;
export type CompleteCallInput = z.infer<typeof completeCallSchema>;
export type TransferCallInput = z.infer<typeof transferCallSchema>;
