"""
Exotel webhook routes for handling call events.

These routes handle webhooks from Exotel for:
- Incoming calls (triggers Voicebot Applet connection)
- Call status updates (completed, failed, etc.)
- Recording notifications

Exotel Documentation:
- Webhooks: https://developer.exotel.com/api/#webhooks
- Voicebot Applet: https://developer.exotel.com/applet/voicebot
"""

from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic.v1 import BaseModel


class ExotelWebhookPayload(BaseModel):
    """Common fields in Exotel webhook payloads."""
    CallSid: str
    From: str
    To: str
    CallStatus: Optional[str] = None
    Direction: Optional[str] = None
    Duration: Optional[int] = None
    RecordingUrl: Optional[str] = None


class ExotelRoutes:
    """
    FastAPI routes for Exotel webhooks.
    
    Configure these endpoints in Exotel App Bazaar:
    - Passthru Applet → Status Callback URL: /webhooks/exotel/status
    - Voicebot Applet → URL: Configured dynamically per call
    """
    
    def __init__(
        self,
        base_url: str,
        on_incoming_call=None,
        on_status_change=None,
        on_recording=None,
    ):
        self.base_url = base_url
        self.on_incoming_call = on_incoming_call
        self.on_status_change = on_status_change
        self.on_recording = on_recording
        self.router = APIRouter(prefix="/webhooks/exotel", tags=["exotel"])
        self._setup_routes()
    
    def _setup_routes(self):
        """Set up webhook routes."""
        
        @self.router.post("/incoming")
        async def incoming_call(request: Request):
            """
            Handle incoming call webhook from Exotel.
            
            This is called when a new call arrives on an Exotel number.
            The response should indicate how to handle the call.
            """
            try:
                data = await request.json()
            except Exception:
                data = dict(request.query_params)
            
            call_sid = data.get("CallSid", data.get("call_sid", ""))
            from_number = data.get("From", data.get("from", ""))
            to_number = data.get("To", data.get("to", ""))
            
            logger.info(f"Exotel incoming call: {call_sid} from {from_number} to {to_number}")
            
            if self.on_incoming_call:
                result = await self.on_incoming_call(
                    call_sid=call_sid,
                    from_number=from_number,
                    to_number=to_number,
                    data=data,
                )
                if result:
                    return JSONResponse(result)
            
            # Default: return acknowledgment
            return JSONResponse({"status": "received", "call_sid": call_sid})
        
        @self.router.post("/status")
        async def status_update(request: Request):
            """
            Handle call status change webhook from Exotel.
            
            Called when call status changes (ringing, in-progress, completed, etc.)
            """
            try:
                data = await request.json()
            except Exception:
                data = dict(request.query_params)
            
            call_sid = data.get("CallSid", data.get("call_sid", ""))
            status = data.get("CallStatus", data.get("Status", ""))
            duration = data.get("Duration", data.get("duration"))
            
            logger.info(f"Exotel call status: {call_sid} -> {status} (duration: {duration}s)")
            
            if self.on_status_change:
                await self.on_status_change(
                    call_sid=call_sid,
                    status=status,
                    duration=duration,
                    data=data,
                )
            
            return JSONResponse({"status": "ok"})
        
        @self.router.post("/recording")
        async def recording_notification(request: Request):
            """
            Handle recording ready webhook from Exotel.
            
            Called when a call recording is available.
            """
            try:
                data = await request.json()
            except Exception:
                data = dict(request.query_params)
            
            call_sid = data.get("CallSid", data.get("call_sid", ""))
            recording_url = data.get("RecordingUrl", data.get("recording_url", ""))
            
            logger.info(f"Exotel recording ready: {call_sid} -> {recording_url}")
            
            if self.on_recording:
                await self.on_recording(
                    call_sid=call_sid,
                    recording_url=recording_url,
                    data=data,
                )
            
            return JSONResponse({"status": "ok"})
        
        @self.router.get("/websocket")
        async def websocket_url(request: Request):
            """
            Return WebSocket URL for Exotel Voicebot Applet.
            
            Exotel's dynamic URL mode calls this endpoint to get the WSS URL.
            Query params: conversation_id
            """
            conversation_id = request.query_params.get("conversation_id", "")
            
            # Return the actual WebSocket URL for audio streaming
            ws_url = f"wss://{self.base_url}/ws/{conversation_id}"
            
            return JSONResponse({
                "url": ws_url,
                "conversation_id": conversation_id,
            })
    
    def get_router(self) -> APIRouter:
        return self.router
