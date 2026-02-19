import os
from typing import Any, Dict, Optional

from fastapi import Body, Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from vocode.streaming.models.agent import ChatGPTAgentConfig, GroqAgentConfig
from vocode.streaming.models.message import BaseMessage
from vocode.streaming.models.synthesizer import (
    AzureSynthesizerConfig,
    ElevenLabsSynthesizerConfig,
    SarvamSynthesizerConfig,
)
from vocode.streaming.models.telephony import TwilioCallConfig
from vocode.streaming.models.transcriber import (
    DeepgramTranscriberConfig,
    PunctuationEndpointingConfig,
    SarvamTranscriberConfig,
)
from vocode.streaming.telephony.config_manager.in_memory_config_manager import (
    InMemoryConfigManager,
)
from vocode.streaming.telephony.config_manager.redis_config_manager import RedisConfigManager
from vocode.streaming.telephony.server.router.calls import CallsRouter
from vocode.streaming.utils import create_conversation_id


def _normalize_base_url(value: Optional[str]) -> str:
    if not value:
        # Render typically provides this for web services.
        value = os.environ.get("RENDER_EXTERNAL_HOSTNAME") or os.environ.get("RENDER_INTERNAL_HOSTNAME")
    if not value:
        raise ValueError("BASE_URL (host only) is required (or set RENDER_EXTERNAL_HOSTNAME).")
    value = value.strip()
    value = value.removeprefix("https://").removeprefix("http://")
    return value.rstrip("/")


def _auth(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")) -> None:
    expected = os.environ.get("VOCODE_API_KEY")
    if not expected:
        return
    if not x_api_key or x_api_key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _get_config_manager():
    if os.environ.get("USE_IN_MEMORY_CONFIG_MANAGER", "").lower() in ("1", "true", "yes"):
        return InMemoryConfigManager()
    return RedisConfigManager()


class CreateConversationRequest(BaseModel):
    call_id: str
    tenant_id: str
    system_prompt: str
    language: str = "en"
    voice_id: Optional[str] = None

    stt_provider: str = "deepgram"
    tts_provider: str = "azure"
    llm_provider: str = "openai"

    stt_api_key: Optional[str] = None
    tts_api_key: Optional[str] = None
    llm_api_key: Optional[str] = None

    # Telephony metadata (Node should send these).
    provider: str = "twilio"
    from_phone: Optional[str] = None
    to_phone: Optional[str] = None
    provider_call_id: Optional[str] = None

    context: Optional[Dict[str, Any]] = Field(default=None)


class CreateConversationResponse(BaseModel):
    conversation_id: str


app = FastAPI(docs_url=None)

BASE_URL = _normalize_base_url(os.environ.get("BASE_URL"))
config_manager = _get_config_manager()

# Log request validation failures (422) to make debugging deployments easier.
@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # FastAPI will return a 422 by default; this handler just ensures the details are visible in logs.
    try:
        from loguru import logger

        logger.error(
            "Request validation error on {} {}: {} | body={}",
            request.method,
            request.url.path,
            exc.errors(),
            getattr(exc, "body", None),
        )
    except Exception:
        pass
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# Websocket endpoint used by Twilio <Connect><Stream url="wss://.../connect_call/{conversationId}">
app.include_router(CallsRouter(base_url=BASE_URL, config_manager=config_manager).get_router())


@app.get("/health")
def health() -> Dict[str, str]:
    return {"message": "ok"}


@app.post("/conversations", response_model=CreateConversationResponse, dependencies=[Depends(_auth)])
async def create_conversation(
    payload: CreateConversationRequest = Body(...)
) -> CreateConversationResponse:
    if payload.provider.lower() != "twilio":
        raise HTTPException(
            status_code=400,
            detail="Only provider=twilio is supported by node_bridge right now.",
        )

    greeting = None
    memory_prompt = None
    if payload.context:
        greeting = payload.context.get("greeting")
        memory_prompt = payload.context.get("memoryPrompt")

    prompt_preamble = payload.system_prompt.strip()
    if memory_prompt:
        prompt_preamble = f"{prompt_preamble}\n\nMEMORY CONTEXT:\n{memory_prompt}"

    llm_provider = payload.llm_provider.lower()
    if llm_provider == "groq":
        agent_config = GroqAgentConfig(
            prompt_preamble=prompt_preamble,
            groq_api_key=payload.llm_api_key,
            initial_message=BaseMessage(text=greeting or "Hello!"),
        )
    else:
        agent_config = ChatGPTAgentConfig(
            prompt_preamble=prompt_preamble,
            openai_api_key=payload.llm_api_key,
            initial_message=BaseMessage(text=greeting or "Hello!"),
        )

    stt_provider = payload.stt_provider.lower()
    if stt_provider == "sarvam":
        transcriber_config = SarvamTranscriberConfig.from_telephone_input_device(
            endpointing_config=PunctuationEndpointingConfig(),
            language=payload.language or "hi-IN",
            api_key=payload.stt_api_key,
        )
    else:
        # Default to Deepgram, tuned for telephony audio.
        transcriber_config = DeepgramTranscriberConfig.from_telephone_input_device(
            endpointing_config=PunctuationEndpointingConfig(),
            model="phonecall",
            tier="nova",
            language=payload.language or None,
            api_key=payload.stt_api_key,
        )

    tts_provider = payload.tts_provider.lower()
    if tts_provider in ("11labs", "elevenlabs", "eleven_labs"):
        synthesizer_config = ElevenLabsSynthesizerConfig(
            sampling_rate=TwilioCallConfig.default_synthesizer_config().sampling_rate,
            audio_encoding=TwilioCallConfig.default_synthesizer_config().audio_encoding,
            api_key=payload.tts_api_key,
            voice_id=payload.voice_id,
            optimize_streaming_latency=None,
            stability=None,
            similarity_boost=None,
            model_id=None,
        )
    elif tts_provider == "sarvam":
        synthesizer_config = SarvamSynthesizerConfig(
            sampling_rate=TwilioCallConfig.default_synthesizer_config().sampling_rate,
            audio_encoding=TwilioCallConfig.default_synthesizer_config().audio_encoding,
            api_key=payload.tts_api_key,
            target_language_code=payload.language or "hi-IN",
        )
    else:
        # Default to Azure. Requires AZURE_SPEECH_KEY/AZURE_SPEECH_REGION if used at runtime.
        synthesizer_config = AzureSynthesizerConfig(
            sampling_rate=TwilioCallConfig.default_synthesizer_config().sampling_rate,
            audio_encoding=TwilioCallConfig.default_synthesizer_config().audio_encoding,
            voice_name=payload.voice_id or AzureSynthesizerConfig().voice_name,
        )

    conversation_id = create_conversation_id()

    # If Node didn't send telephony metadata, keep placeholders so WS can still run.
    from_phone = payload.from_phone or "unknown"
    to_phone = payload.to_phone or "unknown"
    twilio_sid = payload.provider_call_id or payload.call_id or conversation_id

    call_config = TwilioCallConfig(
        transcriber_config=transcriber_config,
        agent_config=agent_config,
        synthesizer_config=synthesizer_config,
        from_phone=from_phone,
        to_phone=to_phone,
        twilio_sid=twilio_sid,
        twilio_config=None,  # will be resolved from env by TwilioPhoneConversation if needed
        direction="inbound",
    )

    await config_manager.save_config(conversation_id, call_config)
    return CreateConversationResponse(conversation_id=conversation_id)


@app.post("/conversations/{conversation_id}/end", dependencies=[Depends(_auth)])
async def end_conversation(conversation_id: str) -> Dict[str, str]:
    await config_manager.delete_config(conversation_id)
    return {"status": "ended"}


@app.post("/conversations/{conversation_id}/transfer", dependencies=[Depends(_auth)])
async def transfer_conversation(conversation_id: str) -> Dict[str, str]:
    raise HTTPException(status_code=501, detail="Transfer not implemented in node_bridge.")
