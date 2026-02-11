# AI Voice Platform - Implementation Plan

## Project Overview

A multi-tenant SaaS platform where businesses (doctors, restaurants, service companies) deploy AI voice agents that answer calls, remember callers, extract actionable data, and operate with business-specific knowledge.

**Target Cost:** ₹1-2 per call infrastructure cost
**Market:** India-first with native language support

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VOICE PLATFORM                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │   EXOTEL    │───▶│   VOCODE    │───▶│   EXPRESS   │───▶│  POSTGRES   │   │
│  │  Telephony  │◀───│  Voice AI   │◀───│  BACKEND    │◀───│  + PRISMA   │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘   │
│        │                  │                   │                  │           │
│   SIP/WebRTC         STT + TTS            Business Logic    Persistence     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

External Services:
├── Exotel (Indian Telephony)
├── Sarvam AI (Indian STT/TTS - 22 languages)
├── Deepgram (Speech-to-Text)
├── ElevenLabs / Google TTS (Text-to-Speech)
├── OpenAI GPT-4 / Groq (LLM)
├── Clerk (Authentication)
└── Supabase (PostgreSQL + pgvector)
```

---

## Database Schema (Prisma)

### Core Models

```prisma
// ============================================
// TENANT & AUTHENTICATION
// ============================================

model Tenant {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  industry    Industry
  status      TenantStatus @default(ACTIVE)
  plan        Plan     @default(STARTER)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Data retention settings
  dataRetentionDays Int      @default(15)  // Auto-delete caller data after X days
  saveCallRecordings Boolean @default(false) // Store recordings or not

  // Relations
  users        User[]
  phoneNumbers PhoneNumber[]
  callers      Caller[]
  calls        Call[]
  agentConfig  AgentConfig?
  knowledge    KnowledgeItem[]

  @@index([slug])
}

enum Industry {
  HEALTHCARE
  RESTAURANT
  SERVICES
  RETAIL
  OTHER
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  TRIAL
}

enum Plan {
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

model User {
  id        String   @id @default(uuid())
  clerkId   String   @unique // Clerk user ID
  email     String
  name      String?
  role      UserRole @default(MEMBER)
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, email])
  @@index([tenantId])
}

enum UserRole {
  OWNER
  ADMIN
  MEMBER
}

// ============================================
// PHONE NUMBERS
// ============================================

model PhoneNumber {
  id           String   @id @default(uuid())
  number       String   @unique
  provider     Provider @default(EXOTEL)
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  label        String?  // e.g., "Main Line", "Support"
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  calls        Call[]

  @@index([tenantId])
  @@index([number])
}

enum Provider {
  EXOTEL
  PLIVO
  TWILIO
}

// ============================================
// CALLERS (Customers)
// ============================================

model Caller {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  phoneNumber String
  name        String?
  email       String?
  preferences Json?    // Stored preferences
  metadata    Json?    // Custom fields
  firstCallAt DateTime @default(now())
  lastCallAt  DateTime @default(now())
  totalCalls  Int      @default(1)
  
  // Data retention
  isSaved     Boolean  @default(false)  // Business saved this caller
  expiresAt   DateTime?                 // Auto-delete after this date

  calls       Call[]

  @@unique([tenantId, phoneNumber])
  @@index([tenantId])
  @@index([phoneNumber])
  @@index([expiresAt])
}

// ============================================
// CALLS & TRANSCRIPTS
// ============================================

model Call {
  id            String     @id @default(uuid())
  externalId    String?    @unique // Exotel/Plivo call SID
  tenantId      String
  tenant        Tenant     @relation(fields: [tenantId], references: [id])
  phoneNumberId String
  phoneNumber   PhoneNumber @relation(fields: [phoneNumberId], references: [id])
  callerId      String
  caller        Caller     @relation(fields: [callerId], references: [id])
  
  direction     CallDirection @default(INBOUND)
  status        CallStatus    @default(RINGING)
  
  startedAt     DateTime   @default(now())
  answeredAt    DateTime?
  endedAt       DateTime?
  durationSecs  Int?
  
  summary       String?    @db.Text  // AI-generated summary
  sentiment     Sentiment?
  
  transcripts   Transcript[]
  extractions   Extraction[]
  recordings    Recording[]

  @@index([tenantId])
  @@index([callerId])
  @@index([startedAt])
}

enum CallDirection {
  INBOUND
  OUTBOUND
}

enum CallStatus {
  RINGING
  CONNECTING
  IN_PROGRESS
  COMPLETED
  FAILED
  NO_ANSWER
  TRANSFERRED
}

enum Sentiment {
  POSITIVE
  NEUTRAL
  NEGATIVE
}

model Transcript {
  id        String   @id @default(uuid())
  callId    String
  call      Call     @relation(fields: [callId], references: [id])
  role      Speaker
  content   String   @db.Text
  timestamp DateTime @default(now())
  confidence Float?  // STT confidence score

  @@index([callId])
}

enum Speaker {
  CALLER
  AGENT
}

model Recording {
  id        String   @id @default(uuid())
  callId    String
  call      Call     @relation(fields: [callId], references: [id])
  url       String   // Local file path
  format    String   @default("wav")
  sizeBytes Int?
  createdAt DateTime @default(now())

  @@index([callId])
}

// ============================================
// EXTRACTIONS (Structured Data)
// ============================================

model Extraction {
  id         String   @id @default(uuid())
  callId     String
  call       Call     @relation(fields: [callId], references: [id])
  type       String   // e.g., "appointment", "order", "symptom"
  data       Json     // The extracted structured data
  confidence Float?   // Extraction confidence
  createdAt  DateTime @default(now())

  @@index([callId])
  @@index([type])
}

// ============================================
// AGENT CONFIGURATION
// ============================================

model AgentConfig {
  id              String   @id @default(uuid())
  tenantId        String   @unique
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  
  // AI Agent Settings
  systemPrompt    String   @db.Text
  voiceId         String?  // ElevenLabs/Sarvam voice ID
  language        String   @default("en-IN")
  
  // Provider Selection (NEW - for multi-tenant flexibility)
  sttProvider     String   @default("deepgram")    // deepgram | sarvam
  ttsProvider     String   @default("elevenlabs")  // elevenlabs | sarvam | google
  llmProvider     String   @default("openai")      // openai | groq | anthropic
  telephonyProvider String @default("exotel")      // exotel | plivo | twilio
  
  // Provider API Keys (Encrypted - NEW)
  providerApiKeys String?  @db.Text  // JSON encrypted with AES
  
  // Behavior
  maxCallDuration Int      @default(300) // seconds
  greeting        String?
  fallbackMessage String?
  
  // Feature Flags
  enableMemory    Boolean  @default(true)
  enableExtraction Boolean @default(true)
  enableRecording Boolean  @default(false)
  
  // Extraction Schemas
  extractionSchemas Json?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// ============================================
// KNOWLEDGE BASE
// ============================================

model KnowledgeItem {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  title     String
  content   String   @db.Text
  category  String?
  embedding Unsupported("vector")? // pgvector for semantic search
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}

// ============================================
// WEBHOOK LOGS (for debugging)
// ============================================

model WebhookLog {
  id           String   @id @default(uuid())
  provider     String   // exotel | plivo | twilio
  endpoint     String
  payload      Json
  signature    String?  // For validation
  responseStatus Int?
  responseBody String?  @db.Text
  createdAt    DateTime @default(now())

  @@index([provider])
  @@index([createdAt])
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Authentication, Tenant Management, Agent Configuration

#### Tasks:

**1.1 Setup Supabase & Prisma**
- [ ] Create Supabase project
- [ ] Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Update `prisma/schema.prisma` with new AgentConfig fields
- [ ] Add WebhookLog model
- [ ] Run migration: `npx prisma migrate dev --name add_agent_config_providers`

**1.2 Encryption Service**
- [ ] Create `src/utils/encryption.util.ts`
- [ ] Implement AES-256 encryption/decryption
- [ ] Use `MASTER_ENCRYPTION_KEY` from env

```typescript
// src/utils/encryption.util.ts
export class EncryptionService {
  encrypt(data: string): string;
  decrypt(encryptedData: string): string;
}
```

**1.3 Clerk Authentication Setup**
- [ ] Install Clerk SDK: `npm install @clerk/clerk-sdk-node`
- [ ] Create `src/middleware/clerk-auth.middleware.ts`
- [ ] Configure Clerk webhook for user sync
- [ ] Add Clerk session middleware to app

**APIs:**
```
POST   /v1/auth/webhook/clerk       → Handle Clerk user events
GET    /v1/auth/me                  → Get current user (Clerk)
```

**1.4 Tenant Module**
- [ ] Create `src/features/tenant/`
- [ ] Tenant controller (CRUD)
- [ ] Tenant service
- [ ] Tenant repository
- [ ] Tenant routes
- [ ] Zod schemas for validation

**APIs:**
```
POST   /v1/tenants              → Create business
GET    /v1/tenants/:id          → Get business details
PUT    /v1/tenants/:id          → Update business
DELETE /v1/tenants/:id          → Deactivate
```

**1.4 User Management Module**
- [ ] Create `src/features/tenant-users/`
- [ ] Add dashboard user APIs
- [ ] Role-based access (Owner, Admin, Member)

**APIs:**
```
POST   /v1/tenants/:id/users    → Add dashboard user
GET    /v1/tenants/:id/users    → List team members
PUT    /v1/tenants/:id/users/:uid → Update user role
DELETE /v1/tenants/:id/users/:uid → Remove user
```

**1.5 Agent Config Module**
- [ ] Create `src/features/agent-config/`
- [ ] Agent config controller
- [ ] Service with encryption for API keys
- [ ] Routes

**APIs:**
```
GET    /v1/tenants/:id/agent-config         → Current config
PUT    /v1/tenants/:id/agent-config         → Update config
POST   /v1/tenants/:id/agent-config/validate → Test API keys
```

**1.6 Phone Numbers Module**
- [ ] Create `src/features/phone-numbers/`
- [ ] CRUD for phone numbers
- [ ] Validation (check if number is available)

**APIs:**
```
POST   /v1/tenants/:id/phone-numbers     → Assign number
GET    /v1/tenants/:id/phone-numbers     → List numbers
DELETE /v1/tenants/:id/phone-numbers/:nid → Remove number
```

**Deliverables:**
- Tenant CRUD working
- Agent configuration with provider selection
- API keys encrypted in DB
- Phone number management

---

### Phase 2: Call Pipeline (Week 3-4)

**Goal:** Webhooks, Vocode Integration, Context Building

#### Tasks:

**2.1 Webhook Security Middleware**
- [ ] Create `src/middleware/webhook-auth.middleware.ts`
- [ ] Exotel signature validation
- [ ] Plivo signature validation
- [ ] Webhook deduplication (idempotency)

**2.2 Exotel Webhooks**
- [ ] Create `src/features/webhooks/exotel/`
- [ ] Incoming call webhook
- [ ] Status callback webhook
- [ ] Webhook logging

**APIs:**
```
POST   /webhooks/exotel/incoming     → New inbound call
POST   /webhooks/exotel/status       → Call status change
POST   /webhooks/exotel/recording    → Recording available
```

**2.3 Plivo Webhooks**
- [ ] Create `src/features/webhooks/plivo/`
- [ ] Incoming call webhook
- [ ] Status callback
- [ ] Hangup notification

**APIs:**
```
POST   /webhooks/plivo/incoming      → Plivo inbound
POST   /webhooks/plivo/status        → Plivo status
POST   /webhooks/plivo/recording     → Recording available
```

**2.4 Vocode Service**
- [ ] Create `src/services/vocode.service.ts`
- [ ] HTTP client for Vocode Python service
- [ ] Build agent config from DB
- [ ] Send context to Vocode

```typescript
interface VocodeAgentConfig {
  transcriber: TranscriberConfig;
  synthesizer: SynthesizerConfig;
  agent: AgentConfig;
  context: CallerContext;  // Injected memory
}
```

**2.5 Context Service**
- [ ] Create `src/services/context.service.ts`
- [ ] Build caller context from history
- [ ] Fetch previous calls
- [ ] Fetch extractions
- [ ] Format for LLM injection

```typescript
interface CallerContext {
  callerName?: string;
  isReturning: boolean;
  previousAppointments: any[];
  preferences: any;
  lastSummary?: string;
  totalCalls: number;
}
```

**2.6 Redis Setup**
- [ ] Add Redis client
- [ ] Store active call sessions
- [ ] Cache caller context (TTL: 1 hour)

**Deliverables:**
- Webhooks receiving calls
- Vocode service creating agents
- Context injection working
- Call routing active

---

### Phase 3: Intelligence (Week 5-6)

**Goal:** Calls, Callers, Transcripts, Extractions, Memory

#### Tasks:

**3.1 Callers Module**
- [ ] Create `src/features/callers/`
- [ ] Auto-create caller on first call
- [ ] Update caller profile
- [ ] Caller history

**APIs:**
```
GET    /v1/tenants/:id/callers              → All callers
GET    /v1/tenants/:id/callers/:cid         → Profile + history
PUT    /v1/tenants/:id/callers/:cid         → Update profile
```

**3.2 Calls Module**
- [ ] Create `src/features/calls/`
- [ ] Store call metadata
- [ ] Update call status
- [ ] Call completion handling

**APIs:**
```
GET    /v1/tenants/:id/calls                → List calls
GET    /v1/tenants/:id/calls/:cid           → Call detail
POST   /v1/tenants/:id/calls/outbound       → Trigger outbound
```

**3.3 Internal APIs (Vocode → Backend)**
- [ ] Create `src/features/calls/internal/`
- [ ] Save transcript chunks
- [ ] Save extractions
- [ ] Call completion webhook

**APIs:**
```
POST   /api/internal/calls/:callId/transcript     → Save transcript
POST   /api/internal/calls/:callId/extraction     → Save extraction
POST   /api/internal/calls/:callId/complete       → Call ended
POST   /api/internal/calls/:callId/action         → Agent action (transfer, etc.)
```

**3.4 Extraction Service**
- [ ] Create `src/services/extraction.service.ts`
- [ ] Process structured data
- [ ] Validate against schema
- [ ] Store in DB

**3.5 Transfer Action**
- [ ] Implement call transfer logic
- [ ] Exotel transfer API
- [ ] Plivo transfer API

**API:**
```
POST   /api/internal/calls/:callId/actions/transfer
Body: { transferTo: "+919876543210" }
```

**3.6 Call Recording (Local Storage)**
- [ ] Save recordings locally
- [ ] Store path in DB
- [ ] Download API
- [ ] Auto-cleanup after 30 days

**APIs:**
```
GET    /v1/tenants/:id/calls/:cid/recording     → Download recording
DELETE /v1/tenants/:id/calls/:cid/recording     → Delete recording
```

**Deliverables:**
- Full call lifecycle
- Transcript storage
- Extraction working
- Transfer action functional
- Recording saved locally

---

### Phase 4: Multi-Tenancy Polish (Week 7)

**Goal:** Knowledge Base, Provider Switching, Testing

#### Tasks:

**4.1 Knowledge Base Module**
- [ ] Create `src/features/knowledge/`
- [ ] CRUD for knowledge items
- [ ] Feed to Vocode agent

**APIs:**
```
POST   /v1/tenants/:id/knowledge            → Add knowledge
GET    /v1/tenants/:id/knowledge            → List all
PUT    /v1/tenants/:id/knowledge/:kid       → Update
DELETE /v1/tenants/:id/knowledge/:kid       → Remove
```

**4.2 Provider Validation**
- [ ] Test API keys on save
- [ ] Show provider status
- [ ] Fallback logic (future)

**4.3 Testing**
- [ ] Unit tests for services
- [ ] Integration tests for webhooks
- [ ] End-to-end call flow test

**4.4 Error Handling**
- [ ] Global error middleware
- [ ] Prisma error handling
- [ ] Webhook retry logic

**Deliverables:**
- Knowledge base working
- Provider switching smooth
- Good test coverage

---

### Phase 5: Dashboard & Admin (Week 8-9)

**Goal:** Dashboard APIs, Analytics, Super Admin

#### Tasks:

**5.1 Dashboard APIs**
- [ ] Call history with filters
- [ ] Call detail view
- [ ] Caller profiles

**APIs:**
```
GET    /v1/tenants/:id/calls?from=&to=&status=&page=&limit
GET    /v1/tenants/:id/calls/:cid
GET    /v1/tenants/:id/callers
```

**5.2 Analytics**
- [ ] Create `src/services/analytics.service.ts`
- [ ] Total calls
- [ ] Average duration
- [ ] Sentiment distribution
- [ ] Extraction counts

**API:**
```
GET    /v1/tenants/:id/analytics?period=last_30_days
Response: {
  totalCalls: 500,
  avgDuration: 145,
  completedCalls: 480,
  extractions: { appointments: 120, orders: 0 },
  sentimentBreakdown: { positive: 300, neutral: 150, negative: 50 }
}
```

**5.3 Super Admin Panel**
- [ ] Admin middleware (check super admin role)
- [ ] List all tenants
- [ ] Platform-wide analytics
- [ ] Tenant status management

**APIs:**
```
GET    /v1/admin/tenants                 → All tenants
GET    /v1/admin/analytics               → Platform stats
PUT    /v1/admin/tenants/:id/status      → Activate/suspend
PUT    /v1/admin/tenants/:id/plan        → Change plan
```

**5.4 Search & Filters**
- [ ] Search calls by caller phone
- [ ] Filter by date range
- [ ] Filter by status
- [ ] Filter by extraction type

**Deliverables:**
- Dashboard fully functional
- Analytics working
- Admin panel ready

---

### Phase 6: Production Hardening (Week 10)

**Goal:** Security, Monitoring, Documentation

#### Tasks:

**6.1 Security**
- [ ] Rate limiting per tenant
- [ ] CORS configuration
- [ ] Helmet security headers
- [ ] JWT expiration (1 hour)
- [ ] Refresh token mechanism (optional)

**6.2 Monitoring**
- [ ] Health check endpoint
- [ ] Error tracking (Sentry integration)
- [ ] Request logging
- [ ] Webhook failure alerts

**6.3 Documentation**
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Postman collection
- [ ] Deployment guide

**6.4 Data Retention & Cleanup**
- [ ] Create `src/jobs/data-cleanup.job.ts`
- [ ] Scheduled job to delete expired caller data (runs daily)
- [ ] Delete unsaved callers after `dataRetentionDays`
- [ ] Delete call transcripts and extractions
- [ ] Optional: Archive before delete
- [ ] Add `isSaved` logic to prevent deletion

```typescript
// Cleanup job logic
- Find all callers where expiresAt < NOW() AND isSaved = false
- Delete associated calls, transcripts, extractions
- Delete caller record
- Log cleanup statistics
```

**6.5 Deployment**
- [ ] Docker setup
- [ ] Environment configuration
- [ ] Database migration strategy

**Deliverables:**
- Production ready
- Fully documented
- Monitored
- GDPR/privacy compliant

---

## API Summary

### Public APIs
```
POST   /v1/auth/register              → User registration
POST   /v1/auth/login                 → User login
```

### Tenant APIs (Authenticated)
```
# Tenant Management
POST   /v1/tenants
GET    /v1/tenants/:id
PUT    /v1/tenants/:id
DELETE /v1/tenants/:id

# Users
POST   /v1/tenants/:id/users
GET    /v1/tenants/:id/users
PUT    /v1/tenants/:id/users/:uid
DELETE /v1/tenants/:id/users/:uid

# Agent Config
GET    /v1/tenants/:id/agent-config
PUT    /v1/tenants/:id/agent-config

# Phone Numbers
POST   /v1/tenants/:id/phone-numbers
GET    /v1/tenants/:id/phone-numbers
DELETE /v1/tenants/:id/phone-numbers/:nid

# Callers
GET    /v1/tenants/:id/callers
GET    /v1/tenants/:id/callers/:cid
PUT    /v1/tenants/:id/callers/:cid
POST   /v1/tenants/:id/callers/:cid/save      → Save caller (prevent deletion)
POST   /v1/tenants/:id/callers/:cid/unsave    → Unsave caller (allow deletion)

# Calls
GET    /v1/tenants/:id/calls
GET    /v1/tenants/:id/calls/:cid
POST   /v1/tenants/:id/calls/outbound
GET    /v1/tenants/:id/calls/:cid/recording

# Knowledge Base
POST   /v1/tenants/:id/knowledge
GET    /v1/tenants/:id/knowledge
PUT    /v1/tenants/:id/knowledge/:kid
DELETE /v1/tenants/:id/knowledge/:kid

# Analytics
GET    /v1/tenants/:id/analytics
```

### Webhooks (Telephony)
```
POST   /webhooks/exotel/incoming
POST   /webhooks/exotel/status
POST   /webhooks/plivo/incoming
POST   /webhooks/plivo/status
```

### Internal APIs (Vocode → Backend)
```
POST   /api/internal/calls/:callId/transcript
POST   /api/internal/calls/:callId/extraction
POST   /api/internal/calls/:callId/complete
POST   /api/internal/calls/:callId/actions/transfer
```

### Admin APIs
```
GET    /v1/admin/tenants
GET    /v1/admin/analytics
PUT    /v1/admin/tenants/:id/status
PUT    /v1/admin/tenants/:id/plan
```

### Testing APIs (No Validation)
For rapid testing without Clerk authentication or validation:
```
# Tenant Testing
POST   /test/tenants                    → Create tenant (no auth)
GET    /test/tenants                    → List all tenants
DELETE /test/tenants/:id                → Delete tenant

# User Testing  
POST   /test/tenants/:id/users          → Add user (no auth)
GET    /test/tenants/:id/users          → List users

# Agent Config Testing
POST   /test/tenants/:id/agent-config   → Set config (no validation)
GET    /test/tenants/:id/agent-config   → Get config

# Phone Number Testing
POST   /test/tenants/:id/phone-numbers  → Add number

# Caller Testing
POST   /test/tenants/:id/callers        → Create caller
GET    /test/tenants/:id/callers        → List callers

# Call Testing
POST   /test/calls                      → Create test call
POST   /test/calls/:id/transcript       → Add transcript (no validation)
POST   /test/calls/:id/extraction       → Add extraction (no validation)
PUT    /test/calls/:id/status           → Update call status

# Webhook Testing
POST   /test/webhooks/exotel            → Simulate Exotel webhook
POST   /test/webhooks/plivo             → Simulate Plivo webhook

# Database Testing
DELETE /test/db/reset                   → Reset all test data
```

---

## Environment Variables

```env
# Server
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[password]@[host]:5432/postgres

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# CORS
WHITE_LIST_URLS=http://localhost:3000,http://localhost:5173

# Encryption
MASTER_ENCRYPTION_KEY=your-32-char-encryption-key

# Redis (optional - for caching)
REDIS_URL=redis://localhost:6379

# Exotel
EXOTEL_ACCOUNT_SID=your_exotel_sid
EXOTEL_API_KEY=your_exotel_key
EXOTEL_API_TOKEN=your_exotel_token
EXOTEL_WEBHOOK_SECRET=your_webhook_secret

# Plivo
PLIVO_AUTH_ID=your_plivo_auth_id
PLIVO_AUTH_TOKEN=your_plivo_auth_token
PLIVO_WEBHOOK_SECRET=your_webhook_secret

# Vocode Service
VOCODE_BASE_URL=http://localhost:3001
VOCODE_API_KEY=your_vocode_key

# Optional (for testing)
SARVAM_API_KEY=your_sarvam_key
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
```

---

## File Structure

```
src/
├── app.ts
├── server.ts
├── config/
│   ├── env-config.ts
│   ├── env-schema.ts
│   └── prisma.config.ts
├── constants/
│   └── messages.ts
├── features/
│   ├── auth/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── schemas/
│   ├── tenant/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── routes/
│   │   └── schemas/
│   ├── tenant-users/
│   ├── agent-config/
│   ├── phone-numbers/
│   ├── callers/
│   ├── calls/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── routes/
│   │   └── internal/          # Vocode callbacks
│   ├── knowledge/
│   ├── webhooks/
│   │   ├── exotel/
│   │   └── plivo/
│   └── admin/
├── middleware/
│   ├── clerk-auth.middleware.ts
│   ├── webhook-auth.middleware.ts
│   ├── validation.middleware.ts
│   ├── security.middleware.ts
│   ├── api-error.middleware.ts
│   └── pino-logger.ts
├── services/
│   ├── vocode.service.ts
│   ├── context.service.ts
│   ├── extraction.service.ts
│   ├── analytics.service.ts
│   └── recording.service.ts
├── utils/
│   ├── encryption.util.ts
│   └── generate-token.util.ts
└── types/
    └── express.d.ts
```

---

## Key Decisions

1. **No Real-Time Dashboard** → User sees calls after completion
2. **No Usage Tracking** → Skip billing for MVP
3. **Local Recording Storage** → User downloads, auto-delete after 30 days
4. **AES Encryption** → Simple, no external services
5. **Provider Config in AgentConfig** → Single table, simpler
6. **Data Retention** → Auto-delete caller data after 15 days (configurable per tenant)
7. **Save/Pin Callers** → Business can "save" important callers to prevent deletion
8. **No SMS** → Focus on voice calls only for MVP

---

## Success Metrics

- [ ] Create tenant with all config
- [ ] Receive inbound call via Exotel
- [ ] AI answers with context injection
- [ ] Transcript saved to DB
- [ ] Extraction data stored
- [ ] Dashboard shows call history
- [ ] Recording downloadable
- [ ] Transfer call works

---

**Last Updated:** February 2026
**Status:** Ready for Phase 1 Implementation
