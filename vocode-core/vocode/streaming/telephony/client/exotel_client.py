"""
Exotel telephony client for Vocode integration.

Exotel is an Indian cloud telephony provider. This client handles:
- Outbound call creation via Exotel Connect API
- Call termination
- WebSocket audio streaming via Voicebot Applet

Exotel Documentation:
- API: https://developer.exotel.com/api/
- Voicebot Applet: https://developer.exotel.com/applet/voicebot
"""

import os
from typing import Dict, Optional

import aiohttp
from loguru import logger

from vocode.streaming.models.telephony import ExotelConfig
from vocode.streaming.telephony.client.abstract_telephony_client import AbstractTelephonyClient
from vocode.streaming.utils.async_requester import AsyncRequestor


class ExotelBadRequestException(ValueError):
    pass


class ExotelException(ValueError):
    pass


class ExotelClient(AbstractTelephonyClient):
    """
    Client for Exotel telephony operations.
    
    Exotel uses:
    - REST API for call control (create, end calls)
    - Voicebot Applet for bidirectional WebSocket audio streaming
    
    Audio format: base64 encoded 16-bit, 8kHz mono PCM (little-endian)
    """
    
    # Exotel API endpoints vary by region/subdomain
    # Format: https://<subdomain>.exotel.com/v1/Accounts/<account_sid>/Calls/connect.json
    
    def __init__(
        self,
        base_url: str,
        maybe_exotel_config: Optional[ExotelConfig] = None,
    ):
        self.exotel_config = maybe_exotel_config or ExotelConfig(
            account_sid=os.environ["EXOTEL_ACCOUNT_SID"],
            api_key=os.environ["EXOTEL_API_KEY"],
            api_token=os.environ["EXOTEL_API_TOKEN"],
            subdomain=os.environ.get("EXOTEL_SUBDOMAIN", "api"),
        )
        self.auth = aiohttp.BasicAuth(
            login=self.exotel_config.api_key,
            password=self.exotel_config.api_token,
        )
        super().__init__(base_url=base_url)

    def get_telephony_config(self):
        return self.exotel_config
    
    def _get_api_base_url(self) -> str:
        """Get the Exotel API base URL based on subdomain."""
        return f"https://{self.exotel_config.subdomain}.exotel.com/v1/Accounts/{self.exotel_config.account_sid}"

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
        Create an outbound call using Exotel Connect API.
        
        For inbound calls, Exotel triggers a webhook to your app URL,
        which then uses the Voicebot Applet for audio streaming.
        
        Args:
            conversation_id: Unique conversation ID
            to_phone: Destination phone number (customer)
            from_phone: Exotel virtual number (ExoPhone)
            record: Whether to record the call
            digits: DTMF digits to send after connection
            telephony_params: Additional Exotel-specific parameters
            
        Returns:
            Exotel call SID
        """
        # Exotel Connect Flow:
        # 1. Exotel calls the 'from' number first (agent/system)
        # 2. When answered, Exotel calls the 'to' number (customer)
        # 3. Both legs are bridged
        
        # For voice AI, we use the Voicebot Applet in an App flow instead
        # This API is for basic Connect calls; for AI calls, use webhook flow
        
        data = {
            "From": from_phone,  # ExoPhone (virtual number)
            "To": to_phone,      # Customer number
            "CallerId": from_phone,
            **(telephony_params or {}),
        }
        
        if record:
            data["Record"] = "true"
        
        # Note: For AI voice calls, the actual WebSocket URL is configured
        # in the Exotel App Bazaar using the Voicebot Applet.
        # This create_call method is for outbound connect calls.
        
        url = f"{self._get_api_base_url()}/Calls/connect.json"
        
        async with AsyncRequestor().get_session().post(
            url,
            auth=self.auth,
            data=data,
        ) as response:
            if not response.ok:
                if response.status == 400:
                    error_text = await response.text()
                    logger.warning(
                        f"Failed to create Exotel call: {response.status} {response.reason} {error_text}"
                    )
                    raise ExotelBadRequestException(
                        "Exotel rejected call; check phone number format or account limits."
                    )
                else:
                    raise ExotelException(
                        f"Exotel failed to create call: {response.status} {response.reason}"
                    )
            result = await response.json()
            # Exotel returns nested structure: {"Call": {"Sid": "..."}}
            call_data = result.get("Call", result)
            return call_data.get("Sid", "")

    async def end_call(self, exotel_sid: str) -> bool:
        """
        End an active call on Exotel.
        
        Args:
            exotel_sid: The Exotel call SID
            
        Returns:
            True if call was successfully ended
        """
        # Exotel uses POST to update call status
        url = f"{self._get_api_base_url()}/Calls/{exotel_sid}.json"
        
        async with AsyncRequestor().get_session().post(
            url,
            auth=self.auth,
            data={"Status": "completed"},
        ) as response:
            if not response.ok:
                raise RuntimeError(f"Failed to end Exotel call: {response.status} {response.reason}")
            result = await response.json()
            call_data = result.get("Call", result)
            return call_data.get("Status") == "completed"

    def get_websocket_url(self, conversation_id: str) -> str:
        """
        Get the WebSocket URL that Exotel's Voicebot Applet should connect to.
        
        This URL is configured in Exotel App Bazaar -> Voicebot Applet -> URL field.
        Can be static (wss://...) or dynamic (https://... returns wss://).
        
        Args:
            conversation_id: Unique conversation ID for this call
            
        Returns:
            WebSocket URL for bidirectional audio streaming
        """
        # Dynamic URL: Exotel will call this HTTPS endpoint, which returns the actual WSS URL
        # This allows passing custom parameters per call
        return f"https://{self.base_url}/exotel/websocket?conversation_id={conversation_id}"
