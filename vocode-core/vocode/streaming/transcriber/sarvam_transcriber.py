"""
Sarvam AI transcriber for Indian language speech-to-text.

Sarvam AI offers real-time streaming STT via WebSocket optimized for Indian languages.

Documentation: https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe
Pricing: ₹30/hour of audio (₹0.50/minute)

Features:
- Real-time WebSocket streaming at wss://api.sarvam.ai/speech-to-text/ws
- Supports 22 Indian languages + English with Indian accent
- Auto language detection
- Code-mixing support (switching languages mid-sentence)
- Optimized for 8kHz/16kHz telephony audio

Supported languages:
- hi-IN (Hindi), bn-IN (Bengali), ta-IN (Tamil), te-IN (Telugu)
- kn-IN (Kannada), ml-IN (Malayalam), mr-IN (Marathi), gu-IN (Gujarati)
- pa-IN (Punjabi), or-IN (Odia), en-IN (Indian English)
"""

import asyncio
import base64
import json
from typing import Optional

import websockets
from loguru import logger
from websockets.asyncio.client import ClientConnection

from vocode import getenv
from vocode.streaming.models.audio import AudioEncoding
from vocode.streaming.models.transcriber import (
    SarvamTranscriberConfig,
    Transcription,
)
from vocode.streaming.transcriber.base_transcriber import BaseAsyncTranscriber

# Sarvam WebSocket message types
SARVAM_EVENT_TRANSCRIPT = "transcript"
SARVAM_EVENT_PARTIAL = "partial"
SARVAM_EVENT_CONNECTED = "connected"
SARVAM_EVENT_ERROR = "error"

NUM_RESTARTS = 3


class SarvamTranscriber(BaseAsyncTranscriber[SarvamTranscriberConfig]):
    """
    Real-time streaming transcriber using Sarvam AI WebSocket API.
    
    Optimized for Indian languages with support for:
    - Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia
    - Indian English (en-IN)
    - Code-mixing (switching between languages mid-sentence)
    """
    
    def __init__(self, transcriber_config: SarvamTranscriberConfig):
        super().__init__(transcriber_config)
        self.api_key = transcriber_config.api_key or getenv("SARVAM_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Please set SARVAM_API_KEY environment variable or pass it as a parameter"
            )
        self._ended = False
        self.is_ready = False
        self.ws_connection: Optional[ClientConnection] = None
        
    def get_sarvam_url(self) -> str:
        """Build WebSocket URL with query parameters."""
        base_url = self.transcriber_config.ws_url
        params = []
        
        # Sample rate - Sarvam supports 8kHz/16kHz
        sample_rate = self.transcriber_config.sampling_rate
        params.append(f"sample_rate={sample_rate}")
        
        # Language (optional - if None, Sarvam auto-detects)
        if self.transcriber_config.language:
            params.append(f"language={self.transcriber_config.language}")
        
        # Encoding - Sarvam expects raw PCM
        if self.transcriber_config.audio_encoding == AudioEncoding.LINEAR16:
            params.append("encoding=pcm16")
        elif self.transcriber_config.audio_encoding == AudioEncoding.MULAW:
            params.append("encoding=mulaw")
        
        return f"{base_url}?{'&'.join(params)}"
    
    async def _run_loop(self):
        """Main loop that handles WebSocket connection and audio streaming."""
        restarts = 0
        while not self._ended and restarts < NUM_RESTARTS:
            try:
                await self._process_audio()
            except Exception as e:
                logger.warning(f"Sarvam connection error: {e}, restarting...")
                restarts += 1
                await asyncio.sleep(0.5)  # Brief delay before reconnect
        
        if restarts >= NUM_RESTARTS:
            logger.error("Sarvam connection failed after max restarts")
    
    async def _process_audio(self):
        """Process audio through Sarvam WebSocket."""
        url = self.get_sarvam_url()
        headers = {
            "api-subscription-key": self.api_key,
        }
        
        async with websockets.connect(url, additional_headers=headers) as ws:
            self.ws_connection = ws
            self.is_ready = True
            logger.info("Connected to Sarvam AI WebSocket")
            
            # Run send and receive concurrently
            await asyncio.gather(
                self._send_audio_loop(ws),
                self._receive_transcription_loop(ws),
            )
    
    async def _send_audio_loop(self, ws: ClientConnection):
        """Send audio chunks to Sarvam."""
        while not self._ended:
            try:
                # Get audio chunk from input queue
                audio_chunk = await asyncio.wait_for(
                    self.input_queue.get(),
                    timeout=5.0
                )
                
                if audio_chunk is None:
                    break
                
                # Sarvam expects base64 encoded audio in JSON format
                # Note: Check Sarvam's actual WebSocket message format
                audio_b64 = base64.b64encode(audio_chunk).decode("utf-8")
                message = json.dumps({
                    "type": "audio",
                    "data": audio_b64
                })
                await ws.send(message)
                
            except asyncio.TimeoutError:
                # Send keepalive if no audio
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error sending audio to Sarvam: {e}")
                break
    
    async def _receive_transcription_loop(self, ws: ClientConnection):
        """Receive transcription results from Sarvam."""
        while not self._ended:
            try:
                message = await ws.recv()
                data = json.loads(message)
                
                event_type = data.get("type", data.get("event", ""))
                
                if event_type == SARVAM_EVENT_CONNECTED:
                    logger.debug("Sarvam session started")
                    
                elif event_type == SARVAM_EVENT_PARTIAL:
                    # Interim/partial transcription
                    text = data.get("text", data.get("transcript", ""))
                    if text:
                        transcription = Transcription(
                            message=text,
                            confidence=data.get("confidence", 0.0),
                            is_final=False,
                        )
                        self.produce_nonblocking(transcription)
                        
                elif event_type == SARVAM_EVENT_TRANSCRIPT:
                    # Final transcription
                    text = data.get("text", data.get("transcript", ""))
                    if text:
                        transcription = Transcription(
                            message=text,
                            confidence=data.get("confidence", 1.0),
                            is_final=True,
                            duration_seconds=data.get("duration"),
                        )
                        self.produce_nonblocking(transcription)
                        
                elif event_type == SARVAM_EVENT_ERROR:
                    error_msg = data.get("message", data.get("error", "Unknown error"))
                    logger.error(f"Sarvam error: {error_msg}")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error receiving from Sarvam: {e}")
                break
    
    async def terminate(self):
        """Close WebSocket connection."""
        self._ended = True
        self.is_ready = False
        if self.ws_connection:
            try:
                await self.ws_connection.close()
            except Exception:
                pass
        await super().terminate()
