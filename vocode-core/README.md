# Vocode Core

A powerful open-source Python library for building voice-based LLM applications. Vocode enables you to create real-time streaming conversations with Large Language Models (LLMs) and deploy them to phone calls, Zoom meetings, and more.

## Overview

Vocode provides a complete framework for voice AI applications, handling the complex orchestration between:
- **Speech-to-Text (STT)** - Converting audio input to text
- **Language Models** - Processing conversations and generating responses
- **Text-to-Speech (TTS)** - Converting responses back to audio

## Features

### Core Capabilities
- 🎙️ **Real-time Streaming** - Low-latency voice conversations
- 📞 **Telephony Integration** - Inbound/outbound phone calls via Twilio, Vonage, Plivo
- 🤖 **Multiple LLM Support** - OpenAI GPT, Anthropic Claude, and more
- 🔊 **Text-to-Speech** - Azure, Google Cloud, ElevenLabs, Coqui, and others
- 📝 **Speech-to-Text** - Deepgram, AssemblyAI, Whisper, Google Cloud, and others
- 🎯 **Agent Actions** - End conversations, transfer calls, record emails, DTMF
- 💾 **Vector Database** - Pinecone integration for RAG applications

### Conversation Types
1. **Streaming Conversations** - Real-time, continuous voice interactions
2. **Turn-based Conversations** - Sequential request-response pattern

## Architecture

```
vocode-core/
├── vocode/
│   ├── streaming/           # Real-time conversation handling
│   │   ├── agent/          # LLM agents (ChatGPT, Anthropic, etc.)
│   │   ├── synthesizer/    # TTS engines (Azure, ElevenLabs, etc.)
│   │   ├── transcriber/    # STT engines (Deepgram, Whisper, etc.)
│   │   ├── telephony/      # Phone call handling (Twilio, Vonage)
│   │   ├── action/         # Agent actions (transfer, hangup, etc.)
│   │   ├── input_device/   # Audio input (microphone, file)
│   │   ├── output_device/  # Audio output (speaker, file)
│   │   └── models/         # Data models and configurations
│   └── turn_based/         # Turn-based conversation mode
├── apps/                    # Sample applications
├── tests/                   # Unit and integration tests
├── quickstarts/            # Quick start examples
└── playground/             # Development utilities
```

## Quick Start

### Installation

```bash
pip install vocode
```

### Basic Streaming Conversation

```python
import asyncio
import signal

from vocode.helpers import create_streaming_microphone_input_and_speaker_output
from vocode.logging import configure_pretty_logging
from vocode.streaming.agent.chat_gpt_agent import ChatGPTAgent
from vocode.streaming.models.agent import ChatGPTAgentConfig
from vocode.streaming.models.message import BaseMessage
from vocode.streaming.models.synthesizer import AzureSynthesizerConfig
from vocode.streaming.models.transcriber import (
    DeepgramTranscriberConfig,
    PunctuationEndpointingConfig,
)
from vocode.streaming.streaming_conversation import StreamingConversation
from vocode.streaming.synthesizer.azure_synthesizer import AzureSynthesizer
from vocode.streaming.transcriber.deepgram_transcriber import DeepgramTranscriber

configure_pretty_logging()

class Settings(BaseSettings):
    openai_api_key: str = "your-openai-key"
    azure_speech_key: str = "your-azure-key"
    deepgram_api_key: str = "your-deepgram-key"
    azure_speech_region: str = "eastus"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()

async def main():
    # Create input/output devices
    microphone_input, speaker_output = create_streaming_microphone_input_and_speaker_output(
        use_default_devices=False,
    )

    # Initialize conversation
    conversation = StreamingConversation(
        output_device=speaker_output,
        transcriber=DeepgramTranscriber(
            DeepgramTranscriberConfig.from_input_device(
                microphone_input,
                endpointing_config=PunctuationEndpointingConfig(),
                api_key=settings.deepgram_api_key,
            ),
        ),
        agent=ChatGPTAgent(
            ChatGPTAgentConfig(
                openai_api_key=settings.openai_api_key,
                initial_message=BaseMessage(text="Hello! How can I help you today?"),
                prompt_preamble="You are a helpful AI assistant.",
            )
        ),
        synthesizer=AzureSynthesizer(
            AzureSynthesizerConfig.from_output_device(speaker_output),
            azure_speech_key=settings.azure_speech_key,
            azure_speech_region=settings.azure_speech_region,
        ),
    )

    await conversation.start()
    print("Conversation started, press Ctrl+C to end")
    
    signal.signal(signal.SIGINT, lambda _0, _1: asyncio.create_task(conversation.terminate()))
    
    while conversation.is_active():
        chunk = await microphone_input.get_audio()
        conversation.receive_audio(chunk)

if __name__ == "__main__":
    asyncio.run(main())
```

## Project Structure

### Core Modules

#### 1. Streaming (`vocode/streaming/`)

Real-time conversation handling with continuous audio streaming.

**Agents** (`streaming/agent/`)
- `chat_gpt_agent.py` - OpenAI GPT integration
- `anthropic_agent.py` - Anthropic Claude integration
- `langchain_agent.py` - LangChain integration
- `restful_user_implemented_agent.py` - Custom REST API agents
- `websocket_user_implemented_agent.py` - Custom WebSocket agents

**Transcribers** (`streaming/transcriber/`)
- `deepgram_transcriber.py` - Deepgram STT
- `assembly_ai_transcriber.py` - AssemblyAI
- `azure_transcriber.py` - Microsoft Azure Speech
- `google_transcriber.py` - Google Cloud Speech
- `whisper_cpp_transcriber.py` - Whisper.cpp
- `gladia_transcriber.py` - Gladia

**Synthesizers** (`streaming/synthesizer/`)
- `azure_synthesizer.py` - Microsoft Azure TTS
- `eleven_labs_synthesizer.py` - ElevenLabs
- `google_synthesizer.py` - Google Cloud TTS
- `cartesia_synthesizer.py` - Cartesia
- `play_ht_synthesizer.py` - Play.ht
- `rime_synthesizer.py` - Rime.ai
- `bark_synthesizer.py` - Bark (open source)
- `coqui_synthesizer.py` - Coqui TTS

**Telephony** (`streaming/telephony/`)
- `client/` - Telephony client implementations (Twilio, Vonage, Plivo, Exotel)
- `conversation/` - Phone conversation management
- `server/` - Telephony server routes

**Actions** (`streaming/action/`)
- `end_conversation.py` - Hang up/end call
- `transfer_call.py` - Transfer to another number
- `dtmf.py` - Send DTMF tones
- `record_email.py` - Record email address
- `wait.py` - Pause/wait action

#### 2. Turn-Based (`vocode/turn_based/`)

Simpler sequential conversation pattern where each turn is processed independently.

**Components:**
- `turn_based_conversation.py` - Main conversation handler
- `agent/` - Agents for turn-based mode
- `synthesizer/` - TTS engines
- `transcriber/` - STT engines

#### 3. Models (`vocode/streaming/models/`)

Data models and configuration classes:
- `agent.py` - Agent configurations
- `transcriber.py` - Transcriber configurations
- `synthesizer.py` - Synthesizer configurations
- `telephony.py` - Telephony settings
- `actions.py` - Action definitions
- `message.py` - Message types
- `audio.py` - Audio configuration

### Sample Applications (`apps/`)

#### Telephony Server (`apps/telephony_app/`)
Self-hosted telephony server for handling phone calls.
- Inbound call handling
- Outbound call initiation
- Configurable agents per phone number

#### LangChain Agent (`apps/langchain_agent/`)
LangChain-powered voice agent with:
- Custom tools integration
- Memory and context management
- Call transcript storage

#### Client Backend (`apps/client_backend/`)
WebSocket backend for client applications.

#### LiveKit Integration (`apps/livekit/`)
WebRTC-based real-time communication using LiveKit.

#### Telegram Bot (`apps/telegram_bot/`)
Voice-enabled Telegram bot.

#### Voice RAG (`apps/voice_rag/`)
Retrieval-Augmented Generation with voice interface.

### Quickstarts (`quickstarts/`)

Simple examples to get started:
- `streaming_conversation.py` - Basic streaming setup
- `turn_based_conversation.py` - Turn-based example

### Playground (`playground/`)

Development and testing utilities:
- Agent chat interface
- Transcriber testing
- Synthesizer testing

## Configuration

### Environment Variables

Create a `.env` file:

```env
# OpenAI
OPENAI_API_KEY=your-openai-key

# Deepgram
DEEPGRAM_API_KEY=your-deepgram-key

# Azure Speech
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=eastus

# ElevenLabs (optional)
ELEVENLABS_API_KEY=your-elevenlabs-key

# Twilio (for telephony)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Pinecone (for RAG)
PINECONE_API_KEY=your-pinecone-key
PINECONE_ENVIRONMENT=your-pinecone-env
```

## Usage Examples

### Custom Agent with Actions

```python
from vocode.streaming.models.actions import ActionConfig
from vocode.streaming.action.transfer_call import TransferCallAction

# Configure agent with actions
agent_config = ChatGPTAgentConfig(
    openai_api_key=settings.openai_api_key,
    initial_message=BaseMessage(text="How can I help you?"),
    prompt_preamble="""You are a helpful assistant. 
    If the user wants to speak to a human, use the transfer_call action.""",
    actions=[
        ActionConfig(type="action_transfer_call"),
    ],
)
```

### Telephony Server

```python
from vocode.streaming.telephony.server.base import TelephonyServer
from vocode.streaming.telephony.config_manager.in_memory_config_manager import (
    InMemoryConfigManager,
)

config_manager = InMemoryConfigManager()

server = TelephonyServer(
    base_url="https://your-domain.com",
    config_manager=config_manager,
    transcriber_config=DeepgramTranscriberConfig.from_telephone_input_device(
        endpointing_config=PunctuationEndpointingConfig(),
        api_key=settings.deepgram_api_key,
    ),
    agent_config=ChatGPTAgentConfig(
        openai_api_key=settings.openai_api_key,
        initial_message=BaseMessage(text="Hello! You've reached our support line."),
    ),
    synthesizer_config=AzureSynthesizerConfig.from_telephone_output_device(
        voice_name="en-US-JennyNeural",
    ),
)
```

### Using Different LLMs

```python
# Anthropic Claude
from vocode.streaming.agent.anthropic_agent import AnthropicAgent
from vocode.streaming.models.agent import AnthropicAgentConfig

agent = AnthropicAgent(
    AnthropicAgentConfig(
        api_key=settings.anthropic_api_key,
        model="claude-3-opus-20240229",
        initial_message=BaseMessage(text="Hello!"),
    )
)

# Groq (for fast inference)
from vocode.streaming.agent.groq_agent import GroqAgent

agent = GroqAgent(
    GroqAgentConfig(
        api_key=settings.groq_api_key,
        model="mixtral-8x7b-32768",
    )
)
```

## Testing

Run the test suite:

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/

# Run with coverage
pytest tests/ --cov=vocode
```

## Documentation

For detailed documentation, visit: [docs.vocode.dev](https://docs.vocode.dev/open-source)

## Original Repository

This is a copy of the vocode-core library from: https://github.com/vocodedev/vocode-core

## License

See LICENSE file for details.
