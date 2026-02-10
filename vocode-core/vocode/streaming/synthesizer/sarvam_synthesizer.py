"""
Sarvam AI synthesizer for Indian language text-to-speech.

Sarvam AI offers TTS via REST API optimized for Indian languages.

Documentation: https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert
Pricing: ₹15/10K characters

Features:
- Supports 10 Indian languages + English
- Natural-sounding Indian voices
- Models: bulbul:v2 (voice control), bulbul:v3 (HD quality)
- Output: base64 encoded audio
- Configurable sample rates: 8000-48000 Hz

Supported languages:
- hi-IN (Hindi), bn-IN (Bengali), ta-IN (Tamil), te-IN (Telugu)
- kn-IN (Kannada), ml-IN (Malayalam), mr-IN (Marathi), gu-IN (Gujarati)
- pa-IN (Punjabi), or-IN (Odia), en-IN (Indian English)
"""

import asyncio
import base64
from typing import AsyncGenerator, Callable, Optional

import aiohttp
from loguru import logger

from vocode import getenv
from vocode.streaming.models.audio import AudioEncoding
from vocode.streaming.models.message import BaseMessage
from vocode.streaming.models.synthesizer import (
    SARVAM_TTS_API_URL,
    SarvamSynthesizerConfig,
)
from vocode.streaming.synthesizer.base_synthesizer import (
    BaseSynthesizer,
    SynthesisResult,
)


class SarvamSynthesizer(BaseSynthesizer[SarvamSynthesizerConfig]):
    """
    Sarvam AI text-to-speech synthesizer for Indian languages.
    
    Uses REST API to convert text to natural-sounding Indian language speech.
    """
    
    def __init__(
        self,
        synthesizer_config: SarvamSynthesizerConfig,
    ):
        super().__init__(synthesizer_config)
        self.api_key = synthesizer_config.api_key or getenv("SARVAM_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Please set SARVAM_API_KEY environment variable or pass it as a parameter"
            )
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def create_speech(
        self,
        message: BaseMessage,
        chunk_size: int,
        is_first_text_chunk: bool = False,
        is_sole_text_chunk: bool = False,
    ) -> SynthesisResult:
        """Generate speech from text using Sarvam TTS API."""
        
        async def chunk_generator() -> AsyncGenerator[SynthesisResult.ChunkResult, None]:
            try:
                session = await self._get_session()
                
                # Build request payload
                payload = {
                    "text": message.text,
                    "target_language_code": self.synthesizer_config.target_language_code,
                    "model": self.synthesizer_config.model,
                    "sample_rate": self.synthesizer_config.sampling_rate,
                }
                
                # Add voice control params for bulbul:v2
                if "v2" in self.synthesizer_config.model:
                    if self.synthesizer_config.pitch != 0.0:
                        payload["pitch"] = self.synthesizer_config.pitch
                    if self.synthesizer_config.speed != 1.0:
                        payload["pace"] = self.synthesizer_config.speed
                    if self.synthesizer_config.loudness != 1.0:
                        payload["loudness"] = self.synthesizer_config.loudness
                
                headers = {
                    "api-subscription-key": self.api_key,
                    "Content-Type": "application/json",
                }
                
                async with session.post(
                    SARVAM_TTS_API_URL,
                    json=payload,
                    headers=headers,
                ) as response:
                    if not response.ok:
                        error_text = await response.text()
                        logger.error(f"Sarvam TTS error: {response.status} - {error_text}")
                        return
                    
                    result = await response.json()
                    
                    # Sarvam returns: {"request_id": "...", "audios": ["base64_audio"]}
                    audios = result.get("audios", [])
                    if not audios:
                        logger.warning("Sarvam returned empty audio")
                        return
                    
                    # Decode base64 audio
                    audio_b64 = audios[0]
                    audio_bytes = base64.b64decode(audio_b64)
                    
                    # Convert to expected encoding if needed
                    if self.synthesizer_config.audio_encoding == AudioEncoding.MULAW:
                        import audioop
                        # Convert from LINEAR16 to MULAW
                        audio_bytes = audioop.lin2ulaw(audio_bytes, 2)
                    
                    # Yield audio in chunks
                    for i in range(0, len(audio_bytes), chunk_size):
                        chunk = audio_bytes[i:i + chunk_size]
                        is_last = (i + chunk_size >= len(audio_bytes))
                        yield SynthesisResult.ChunkResult(
                            chunk=chunk,
                            is_last_chunk=is_last,
                        )
                        
            except Exception as e:
                logger.error(f"Sarvam TTS synthesis error: {e}")
        
        def get_message_up_to(seconds: Optional[float]) -> str:
            return message.text
        
        return SynthesisResult(
            chunk_generator=chunk_generator(),
            get_message_up_to=get_message_up_to,
        )
    
    async def tear_down(self):
        """Close aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()
        await super().tear_down()
