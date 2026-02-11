import { z } from 'zod';

export const providerEnum = {
  stt: z.enum(['DEEPGRAM', 'SARVAM', 'ASSEMBLY_AI', 'AZURE', 'GOOGLE']),
  tts: z.enum(['ELEVEN_LABS', 'SARVAM', 'AZURE', 'GOOGLE', 'CARTESIA', 'PLAY_HT']),
  llm: z.enum(['OPENAI', 'GROQ', 'ANTHROPIC']),
  telephony: z.enum(['EXOTEL', 'PLIVO', 'TWILIO', 'VONAGE']),
};

export const createAgentConfigSchema = z.object({
  tenantId: z.string().uuid(),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters'),
  voiceId: z.string().optional(),
  language: z.string().default('en-IN'),

  // Provider selection
  sttProvider: providerEnum.stt.default('DEEPGRAM'),
  ttsProvider: providerEnum.tts.default('ELEVEN_LABS'),
  llmProvider: providerEnum.llm.default('OPENAI'),
  telephonyProvider: providerEnum.telephony.default('EXOTEL'),

  // API Keys (optional - can use global keys)
  sttApiKey: z.string().optional(),
  ttsApiKey: z.string().optional(),
  llmApiKey: z.string().optional(),

  // Behavior
  maxCallDuration: z.number().int().min(60).max(3600).default(300),
  greeting: z.string().optional(),
  fallbackMessage: z.string().optional(),

  // Feature flags
  enableMemory: z.boolean().default(true),
  enableExtraction: z.boolean().default(true),
  enableRecording: z.boolean().default(false),

  // Extraction schemas
  extractionSchemas: z.any().optional(),
});

export const updateAgentConfigSchema = createAgentConfigSchema.partial().omit({ tenantId: true });

export type CreateAgentConfigInput = z.infer<typeof createAgentConfigSchema>;
export type UpdateAgentConfigInput = z.infer<typeof updateAgentConfigSchema>;
