"""
Plivo telephony client for Vocode integration.

Plivo is a cloud communications platform providing Voice, SMS and other services.
This client handles:
- Outbound call creation via Plivo Voice API
- Call termination (hangup)
- XML generation for audio streaming via <Stream> element

Plivo Documentation:
- Voice API: https://www.plivo.com/docs/voice/api/call/
- Audio Streaming: https://www.plivo.com/docs/voice/concepts/audio-streaming/
- XML Reference: https://www.plivo.com/docs/voice/xml/

Key Details:
- API Base: https://api.plivo.com/v1/Account/{auth_id}/
- Auth: HTTP Basic Auth (auth_id:auth_token)
- Call Create: POST /Call/ with from, to, answer_url
- Call Hangup: DELETE /Call/{call_uuid}/
- Audio Streaming: Uses XML <Stream> element with bidirectional WebSocket
- Audio Format: MULAW 8kHz (audio/x-mulaw;rate=8000) by default
- WebSocket Events: start, media, stop, dtmf
- Media Payload: base64 encoded audio chunks
- Bidirectional: supports playAudio, clearAudio, checkPoint events
"""

import os
from typing import Dict, Optional

import aiohttp
from loguru import logger

from vocode.streaming.models.telephony import PlivoConfig
from vocode.streaming.telephony.client.abstract_telephony_client import AbstractTelephonyClient
from vocode.streaming.utils.async_requester import AsyncRequestor


class PlivoBadRequestException(ValueError):
    pass


class PlivoException(ValueError):
    pass


class PlivoClient(AbstractTelephonyClient):
    """
    Client for Plivo telephony operations.

    Plivo uses:
    - REST API for call control (create, hangup)
    - XML responses with <Stream> element for bidirectional WebSocket audio streaming
    - answer_url webhook pattern: when call connects, Plivo fetches XML from answer_url

    Audio format: MULAW 8kHz (audio/x-mulaw;rate=8000), base64 encoded in WebSocket frames
    WebSocket events: start, media (with base64 payload), stop, dtmf
    """

    # Plivo API base URL
    PLIVO_API_BASE = "https://api.plivo.com/v1/Account"

    def __init__(
        self,
        base_url: str,
        maybe_plivo_config: Optional[PlivoConfig] = None,
    ):
        self.plivo_config = maybe_plivo_config or PlivoConfig(
            auth_id=os.environ["PLIVO_AUTH_ID"],
            auth_token=os.environ["PLIVO_AUTH_TOKEN"],
        )
        self.auth = aiohttp.BasicAuth(
            login=self.plivo_config.auth_id,
            password=self.plivo_config.auth_token,
        )
        super().__init__(base_url=base_url)

    def get_telephony_config(self):
        return self.plivo_config

    def _get_api_base_url(self) -> str:
        """Get the Plivo API base URL for this account."""
        return f"{self.PLIVO_API_BASE}/{self.plivo_config.auth_id}"

    async def create_call(
        self,
        conversation_id: str,
        to_phone: str,
        from_phone: str,
        record: bool = False,
        digits: Optional[str] = None,
        telephony_params: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Create an outbound call using Plivo Voice API.

        Plivo Call Flow:
        1. POST /Call/ with from, to, answer_url
        2. Plivo calls the 'to' number
        3. When answered, Plivo fetches XML from answer_url
        4. XML contains <Stream> element that opens WebSocket for audio

        Args:
            conversation_id: Unique conversation ID
            to_phone: Destination phone number
            from_phone: Plivo phone number (caller ID)
            record: Whether to record the call
            digits: DTMF digits to send after connection
            telephony_params: Additional Plivo-specific parameters

        Returns:
            Plivo request_uuid (call identifier)
        """
        # answer_url returns XML with <Stream> for audio streaming
        answer_url = f"https://{self.base_url}/plivo/answer/{conversation_id}"

        data = {
            "from": from_phone,
            "to": to_phone,
            "answer_url": answer_url,
            "answer_method": "POST",
            **(telephony_params or {}),
        }

        if record:
            data["record"] = "true"

        if digits:
            data["send_digits"] = digits

        url = f"{self._get_api_base_url()}/Call/"

        async with AsyncRequestor().get_session().post(
            url,
            auth=self.auth,
            json=data,
            headers={"Content-Type": "application/json"},
        ) as response:
            if not response.ok:
                if response.status == 400:
                    error_text = await response.text()
                    logger.warning(
                        f"Failed to create Plivo call: {response.status} {response.reason} {error_text}"
                    )
                    raise PlivoBadRequestException(
                        "Plivo rejected call; check phone number format or account limits."
                    )
                else:
                    raise PlivoException(
                        f"Plivo failed to create call: {response.status} {response.reason}"
                    )
            result = await response.json()
            # Plivo returns: {"message": "call fired", "request_uuid": "...", "api_id": "..."}
            return result.get("request_uuid", "")

    async def end_call(self, call_uuid: str) -> bool:
        """
        Hang up an active call on Plivo.

        Uses DELETE method on the call resource.

        Args:
            call_uuid: The Plivo call UUID

        Returns:
            True if call was successfully ended
        """
        url = f"{self._get_api_base_url()}/Call/{call_uuid}/"

        async with AsyncRequestor().get_session().delete(
            url,
            auth=self.auth,
        ) as response:
            if not response.ok:
                raise RuntimeError(
                    f"Failed to end Plivo call: {response.status} {response.reason}"
                )
            # DELETE returns 204 No Content on success
            return response.status == 204

    def get_stream_xml(self, conversation_id: str) -> str:
        """
        Generate Plivo XML response with <Stream> element for audio streaming.

        This XML is returned from the answer_url when a call connects.
        It instructs Plivo to open a bidirectional WebSocket to our server.

        Args:
            conversation_id: Unique conversation ID

        Returns:
            Plivo XML string with Stream element
        """
        ws_url = f"wss://{self.base_url}/ws/{conversation_id}"

        return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream
        streamTimeout="3600"
        keepCallAlive="true"
        bidirectional="true"
        contentType="audio/x-mulaw;rate=8000"
        statusCallbackUrl="https://{self.base_url}/plivo/status/{conversation_id}"
    >{ws_url}</Stream>
</Response>"""
