"""
Plivo webhook routes for handling call events and XML responses.

These routes handle webhooks from Plivo for:
- Answer URL (returns XML with <Stream> for audio streaming)
- Status callbacks (call status changes)
- Hangup notifications

Plivo Documentation:
- Webhooks: https://www.plivo.com/docs/voice/api/call/make-a-call/#callbacks
- XML: https://www.plivo.com/docs/voice/xml/
- Audio Streaming: https://www.plivo.com/docs/voice/concepts/audio-streaming/
"""

from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from loguru import logger
from pydantic.v1 import BaseModel


class PlivoRoutes:
    """
    FastAPI routes for Plivo webhooks.

    Configure these endpoints:
    - answer_url: /plivo/answer/{conversation_id} (returns XML with <Stream>)
    - hangup_url: /plivo/hangup/{conversation_id}
    - status callback: /plivo/status/{conversation_id}
    """

    def __init__(
        self,
        base_url: str,
        on_call_answered=None,
        on_status_change=None,
        on_hangup=None,
    ):
        self.base_url = base_url
        self.on_call_answered = on_call_answered
        self.on_status_change = on_status_change
        self.on_hangup = on_hangup
        self.router = APIRouter(prefix="/plivo", tags=["plivo"])
        self._setup_routes()

    def _setup_routes(self):
        """Set up Plivo webhook routes."""

        @self.router.post("/answer/{conversation_id}")
        @self.router.get("/answer/{conversation_id}")
        async def answer_url(conversation_id: str, request: Request):
            """
            Answer URL handler - returns Plivo XML with <Stream> element.

            When a call is answered, Plivo fetches this URL to get instructions.
            We return XML that opens a bidirectional WebSocket stream.

            Plivo sends these params: From, To, CallUUID, Direction, CallStatus, etc.
            """
            try:
                if request.method == "POST":
                    data = await request.form()
                    data = dict(data)
                else:
                    data = dict(request.query_params)
            except Exception:
                data = {}

            call_uuid = data.get("CallUUID", "")
            from_number = data.get("From", "")
            to_number = data.get("To", "")
            direction = data.get("Direction", "")

            logger.info(
                f"Plivo answer: conversation={conversation_id} "
                f"call_uuid={call_uuid} from={from_number} to={to_number} "
                f"direction={direction}"
            )

            if self.on_call_answered:
                await self.on_call_answered(
                    conversation_id=conversation_id,
                    call_uuid=call_uuid,
                    from_number=from_number,
                    to_number=to_number,
                    data=data,
                )

            # Return XML with <Stream> for bidirectional WebSocket audio
            ws_url = f"wss://{self.base_url}/ws/{conversation_id}"
            status_callback = f"https://{self.base_url}/plivo/status/{conversation_id}"

            xml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream
        streamTimeout="3600"
        keepCallAlive="true"
        bidirectional="true"
        contentType="audio/x-mulaw;rate=8000"
        statusCallbackUrl="{status_callback}"
    >{ws_url}</Stream>
</Response>"""

            return Response(
                content=xml_response,
                media_type="application/xml",
            )

        @self.router.post("/status/{conversation_id}")
        async def status_callback(conversation_id: str, request: Request):
            """
            Status callback handler for Plivo stream events.

            Called when stream status changes (e.g., stream connected, disconnected).
            """
            try:
                data = await request.form()
                data = dict(data)
            except Exception:
                data = {}

            event = data.get("Event", "")
            call_uuid = data.get("CallUUID", "")
            call_status = data.get("CallStatus", "")

            logger.info(
                f"Plivo status: conversation={conversation_id} "
                f"event={event} call_uuid={call_uuid} status={call_status}"
            )

            if self.on_status_change:
                await self.on_status_change(
                    conversation_id=conversation_id,
                    call_uuid=call_uuid,
                    event=event,
                    status=call_status,
                    data=data,
                )

            return JSONResponse({"status": "ok"})

        @self.router.post("/hangup/{conversation_id}")
        async def hangup_callback(conversation_id: str, request: Request):
            """
            Hangup URL handler for Plivo.

            Called when a call is hung up. Receives hangup details.

            Params: From, To, CallUUID, Direction, CallStatus (completed),
                    StartTime, AnswerTime, EndTime, Duration, BillDuration, etc.
            """
            try:
                data = await request.form()
                data = dict(data)
            except Exception:
                data = {}

            call_uuid = data.get("CallUUID", "")
            duration = data.get("Duration", "")
            bill_duration = data.get("BillDuration", "")

            logger.info(
                f"Plivo hangup: conversation={conversation_id} "
                f"call_uuid={call_uuid} duration={duration}s bill={bill_duration}s"
            )

            if self.on_hangup:
                await self.on_hangup(
                    conversation_id=conversation_id,
                    call_uuid=call_uuid,
                    duration=duration,
                    data=data,
                )

            return JSONResponse({"status": "ok"})

    def get_router(self) -> APIRouter:
        return self.router
