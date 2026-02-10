# AI Voice Platform

A comprehensive multi-tenant SaaS platform that enables businesses (doctors, restaurants, service providers) to handle customer calls using AI voice agents with memory and contextual understanding.

## Overview

This platform combines a robust **Express.js backend** with **Vocode voice AI** to create intelligent call handling systems. Businesses can deploy AI agents that:

- Answer inbound calls in real-time
- Maintain conversation memory across interactions  
- Extract structured data (appointments, orders, symptoms)
- Operate with tenant-specific knowledge and personas
- Handle Indian telephony via Exotel integration

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
├── Deepgram (Speech-to-Text)
├── ElevenLabs / Google TTS (Text-to-Speech)
├── OpenAI GPT-4 (LLM)
└── Redis (Session Cache)
```

## Project Structure

```
.
├── src/                              # Express Backend (TypeScript)
│   ├── app.ts                        # Express app setup
│   ├── server.ts                     # Server with graceful shutdown
│   ├── config/                       # Configuration
│   │   ├── env-config.ts             # Environment variables
│   │   ├── env-schema.ts             # Zod validation schema
│   │   └── prisma.config.ts          # Prisma client singleton
│   ├── features/                     # Feature-based architecture
│   │   └── user/                     # User module
│   │       ├── controllers/          # HTTP request handlers
│   │       ├── services/             # Business logic
│   │       ├── repositories/         # Database access
│   │       ├── routes/               # API routes
│   │       ├── schemas/              # Zod validation schemas
│   │       ├── types/                # TypeScript types
│   │       └── __tests__/            # Unit tests (Vitest)
│   ├── middleware/                   # Global middleware
│   │   ├── auth.middleware.ts        # JWT authentication
│   │   ├── validation.middleware.ts  # Request validation
│   │   ├── security.middleware.ts    # Helmet, rate limiting
│   │   ├── api-error.middleware.ts   # Error handling
│   │   └── pino-logger.ts            # Request logging
│   ├── utils/                        # Utilities
│   │   └── generate-token.util.ts    # JWT token generation
│   └── constants/                    # App constants
│       └── messages.ts               # Response messages
├── vocode-core/                      # Vocode Voice AI Library
│   ├── vocode/                       # Core library
│   │   ├── streaming/                # Real-time conversations
│   │   │   ├── agent/                # LLM agents (GPT, Claude)
│   │   │   ├── transcriber/          # STT engines (Deepgram)
│   │   │   ├── synthesizer/          # TTS engines (ElevenLabs)
│   │   │   ├── telephony/            # Phone integrations
│   │   │   ├── action/               # Agent actions
│   │   │   └── models/               # Configuration models
│   │   └── turn_based/               # Sequential conversations
│   ├── apps/                         # Sample applications
│   ├── tests/                        # Test suite
│   └── quickstarts/                  # Getting started examples
├── docs/
│   └── VOICE_PLATFORM_SPEC.md        # Detailed product specification
├── prisma/                           # Database schema (if exists)
├── package.json                      # Node.js dependencies
└── README.md                         # This file
```

## Backend Features

### 1. Authentication System
- **JWT-based authentication** with access tokens
- **User registration** with email/password
- **Secure login** with bcrypt password hashing
- **Protected routes** via auth middleware
- **Role-based access control** (RBAC)

```typescript
// JWT payload structure
{
  userId: string;
  role: string;
  dealerId: string;
}
```

### 2. API Endpoints

#### Public Endpoints
```
GET    /api/users/              - Health check
POST   /api/users/register      - User registration
POST   /api/users/login         - User login
```

#### Protected Endpoints
```
GET    /api/users/profile       - Get user profile (requires auth)
```

### 3. Request Validation
All incoming requests are validated using **Zod schemas**:
- Register: email, password validation
- Login: credentials validation
- Automatic error responses for invalid data

### 4. Security Features
- **Helmet** - Security headers
- **Rate limiting** - Prevent abuse
- **CORS** - Cross-origin configuration
- **JWT secret** - Minimum 32 characters required
- **Environment validation** - All env vars validated at startup

### 5. Graceful Shutdown
The server handles shutdown signals properly:
- Closes database connections (Prisma)
- Closes WebSocket connections
- Terminates child processes
- 10-second timeout for forced shutdown
- Handles uncaught exceptions and unhandled rejections

### 6. Database
- **PostgreSQL** with **Prisma ORM**
- **Multi-tenant architecture** support
- **Connection pooling** via Prisma singleton
- **Schema validation** with Zod

### 7. Testing
- **Vitest** for unit and integration testing
- **Supertest** for API endpoint testing
- Tests for controllers, services, repositories, and routes

### 8. Code Quality
- **TypeScript** - Full type safety
- **ESLint** - Linting with security plugins
- **Prettier** - Code formatting
- **Husky** - Pre-commit hooks

## Voice AI Features (Vocode)

### Real-Time Streaming
- **WebSocket-based** bidirectional audio streaming
- **Low-latency** conversation handling
- **Continuous listening** and response generation

### Supported Integrations

#### Speech-to-Text (STT)
- Deepgram (Primary)
- AssemblyAI
- Azure Speech
- Google Cloud Speech
- Whisper
- Gladia

#### Text-to-Speech (TTS)
- ElevenLabs (Primary)
- Azure TTS
- Google Cloud TTS
- Cartesia
- Play.ht
- Coqui (Open source)
- Bark (Open source)

#### Language Models
- OpenAI GPT-4 / GPT-4o-mini
- Anthropic Claude
- Groq (Fast inference)
- LangChain integration

#### Telephony
- **Exotel** (Indian telephony - custom integration)
- Twilio
- Vonage
- Plivo

### Conversation Memory
- **Short-term memory** (Redis) - Current call context
- **Long-term memory** (PostgreSQL) - Full transcripts, caller profiles
- **Semantic memory** (Vector DB) - Knowledge bases for RAG

### Agent Actions
- End conversation
- Transfer call
- Send DTMF tones
- Record email
- Wait/pause

### Multi-Tenancy
- Complete data isolation per business
- Dedicated phone numbers per tenant
- Custom agent configurations per tenant
- Tenant-specific knowledge bases

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis (optional, for caching)
- Python 3.9+ (for Vocode)
- Exotel account (for telephony)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd voice-platform
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.dev.example .env.dev
```

Edit `.env.dev`:
```env
# Server
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/voiceplatform
SHADOW_DATABASE_URL=postgresql://user:password@localhost:5432/voiceplatform_shadow

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# CORS
WHITE_LIST_URLS=http://localhost:3000,http://localhost:5173

# Exotel (Telephony)
EXOTEL_ACCOUNT_SID=your_exotel_sid
EXOTEL_API_KEY=your_exotel_key
EXOTEL_API_TOKEN=your_exotel_token

# Voice AI
DEEPGRAM_API_KEY=your_deepgram_key
ELEVENLABS_API_KEY=your_elevenlabs_key
OPENAI_API_KEY=your_openai_key

# Vocode Service
VOCODE_BASE_URL=http://localhost:3001
```

4. **Set up the database**
```bash
npx prisma migrate dev --name init
npx prisma generate
```

5. **Run the backend**
```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start
```

### Vocode Setup

1. **Install Vocode dependencies**
```bash
cd vocode-core
pip install -e .
```

2. **Run a quickstart example**
```bash
python quickstarts/streaming_conversation.py
```

## API Usage Examples

### Register User
```bash
curl -X POST http://localhost:5000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "John Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

### Get Profile (Protected)
```bash
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

## Development

### Available Scripts
```bash
npm run dev           # Start development server
npm run build         # Build for production
npm start             # Start production server
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint errors
npm run format        # Format with Prettier
npm run test          # Run tests (Vitest)
npm run test:ci       # Run tests in CI mode
```

### Project Architecture

#### Feature-Based Structure
```
src/features/user/
├── controllers/user.controller.ts    # HTTP layer
├── services/user.service.ts          # Business logic
├── repositories/user.repository.ts   # Data access
├── routes/user.routes.ts             # Route definitions
├── schemas/user.schema.ts            # Validation schemas
├── types/user.types.ts               # TypeScript types
└── __tests__/                        # Unit tests
```

**Benefits:**
- Each feature is self-contained
- Easy to add/remove features
- Clear separation of concerns
- Better code organization

#### Dependency Injection
Services and repositories are instantiated in routes:
```typescript
const userRepository = new UserRepository(prisma);
const userService = new UserService(userRepository);
const userController = new UserController(userService);
```

### Testing

Run the test suite:
```bash
# Run all tests
npm run test

# Run with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- src/features/user/__tests__/user.controller.spec.ts
```

## Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (64+ characters)
- [ ] Configure `WHITE_LIST_URLS` properly
- [ ] Set up PostgreSQL with SSL
- [ ] Configure Redis for session storage
- [ ] Set up Exotel webhooks
- [ ] Enable rate limiting
- [ ] Configure logging (Pino)
- [ ] Set up monitoring (health checks)

### Docker Deployment
```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

Build and run:
```bash
docker build -t voice-platform .
docker run -p 5000:5000 --env-file .env voice-platform
```

## Cost Analysis (India-Focused)

**Target: ₹2 per call total infrastructure cost**

| Component | Cost Strategy | Est. Cost/Call |
|-----------|---------------|----------------|
| **Exotel** | Pay-per-minute telephony | ₹0.50 - 1.00 |
| **Vocode** | Self-hosted (FREE) | ₹0.00 |
| **Deepgram STT** | Pay-per-second | ₹0.30 - 0.50 |
| **OpenAI GPT-4o-mini** | Token-based | ₹0.20 - 0.40 |
| **TTS (Google)** | Free tier or ₹0.10/call | ₹0.00 - 0.10 |
| **Server** | Self-hosted/VPS | Amortized |
| **TOTAL** | | **~₹1.00 - 2.00** |

## Use Cases

### Healthcare / Doctors
- Appointment booking
- Symptom intake
- Prescription refills
- Follow-up reminders

### Restaurants
- Order taking
- Table reservations
- Menu inquiries
- Delivery tracking

### Service Businesses
- Lead capture
- Appointment scheduling
- Quote generation
- Service inquiries

## Documentation

- **Product Specification**: See `docs/VOICE_PLATFORM_SPEC.md`
- **Vocode Docs**: [docs.vocode.dev](https://docs.vocode.dev/open-source)
- **API Documentation**: Available at `/api-docs` (when configured)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open a GitHub issue
- Check the product specification in `docs/`
- Review Vocode documentation at docs.vocode.dev

---

**Built with:** Node.js, Express, TypeScript, Prisma, PostgreSQL, Vocode, and ❤️
