import { z } from 'zod';

export const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // CORS
  WHITE_LIST_URLS: z
    .string()
    .transform(value => value.split(',').map(url => url.trim()))
    .refine(urls => urls.every(url => z.string().url().safeParse(url).success), {
      message: 'Each value in WHITE_LIST_URLS must be a valid URL',
    })
    .optional(),

  // Redis (optional)
  REDIS_URL: z.string().url().optional(),

  // Encryption
  MASTER_ENCRYPTION_KEY: z.string().min(32, 'MASTER_ENCRYPTION_KEY must be at least 32 characters'),

  // Auth (Clerk)
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // Legacy Auth (optional for migration)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  WEBHOOK_SECRET: z.string().optional(),

  // Vocode Server
  VOCODE_BASE_URL: z.string().url().default('http://localhost:3001'),

  // Exotel (Indian telephony)
  EXOTEL_ACCOUNT_SID: z.string().optional(),
  EXOTEL_API_KEY: z.string().optional(),
  EXOTEL_API_TOKEN: z.string().optional(),
  EXOTEL_SUBDOMAIN: z.string().default('api'),

  // Plivo (global telephony)
  PLIVO_AUTH_ID: z.string().optional(),
  PLIVO_AUTH_TOKEN: z.string().optional(),

  // Sarvam AI (Indian STT/TTS)
  SARVAM_API_KEY: z.string().optional(),

  // Deepgram (STT)
  DEEPGRAM_API_KEY: z.string().optional(),

  // OpenAI (LLM)
  OPENAI_API_KEY: z.string().optional(),

  // ElevenLabs (TTS)
  ELEVENLABS_API_KEY: z.string().optional(),

  // Groq (Fast LLM)
  GROQ_API_KEY: z.string().optional(),
});

export type EnvVars = z.infer<typeof envSchema>;
