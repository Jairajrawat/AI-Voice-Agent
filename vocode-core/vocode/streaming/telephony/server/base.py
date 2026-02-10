import abc
from functools import partial
from typing import List, Optional

from fastapi import APIRouter, Form, Request, Response
from loguru import logger
from pydantic.v1 import BaseModel, Field

from vocode.streaming.agent.abstract_factory import AbstractAgentFactory
from vocode.streaming.agent.default_factory import DefaultAgentFactory
from vocode.streaming.models.agent import AgentConfig
from vocode.streaming.models.events import RecordingEvent
from vocode.streaming.models.synthesizer import SynthesizerConfig
from vocode.streaming.models.telephony import (
    ExotelCallConfig,
    ExotelConfig,
    PlivoCallConfig,
    PlivoConfig,
    TwilioCallConfig,
    TwilioConfig,
    VonageCallConfig,
    VonageConfig,
)
from vocode.streaming.models.transcriber import TranscriberConfig
from vocode.streaming.synthesizer.abstract_factory import AbstractSynthesizerFactory
from vocode.streaming.synthesizer.default_factory import DefaultSynthesizerFactory
from vocode.streaming.telephony.client.abstract_telephony_client import AbstractTelephonyClient
from vocode.streaming.telephony.client.exotel_client import ExotelClient
from vocode.streaming.telephony.client.plivo_client import PlivoClient
from vocode.streaming.telephony.client.twilio_client import TwilioClient
from vocode.streaming.telephony.client.vonage_client import VonageClient
from vocode.streaming.telephony.config_manager.base_config_manager import BaseConfigManager
from vocode.streaming.telephony.server.router.calls import CallsRouter
from vocode.streaming.telephony.templater import get_connection_twiml
from vocode.streaming.transcriber.abstract_factory import AbstractTranscriberFactory
from vocode.streaming.transcriber.default_factory import DefaultTranscriberFactory
from vocode.streaming.utils import create_conversation_id
from vocode.streaming.utils.events_manager import EventsManager


class AbstractInboundCallConfig(BaseModel, abc.ABC):
    url: str
    agent_config: AgentConfig
    transcriber_config: Optional[TranscriberConfig] = None
    synthesizer_config: Optional[SynthesizerConfig] = None


class TwilioInboundCallConfig(AbstractInboundCallConfig):
    twilio_config: TwilioConfig


class VonageInboundCallConfig(AbstractInboundCallConfig):
    vonage_config: VonageConfig


class ExotelInboundCallConfig(AbstractInboundCallConfig):
    """Inbound call configuration for Exotel telephony."""
    exotel_config: ExotelConfig


class PlivoInboundCallConfig(AbstractInboundCallConfig):
    """Inbound call configuration for Plivo telephony."""
    plivo_config: PlivoConfig


class VonageAnswerRequest(BaseModel):
    to: str
    from_: str = Field(..., alias="from")
    uuid: str


class TelephonyServer:
    def __init__(
        self,
        base_url: str,
        config_manager: BaseConfigManager,
        inbound_call_configs: List[AbstractInboundCallConfig] = [],
        transcriber_factory: AbstractTranscriberFactory = DefaultTranscriberFactory(),
        agent_factory: AbstractAgentFactory = DefaultAgentFactory(),
        synthesizer_factory: AbstractSynthesizerFactory = DefaultSynthesizerFactory(),
        events_manager: Optional[EventsManager] = None,
    ):
        self.base_url = base_url
        self.router = APIRouter()
        self.config_manager = config_manager
        self.events_manager = events_manager
        self.router.include_router(
            CallsRouter(
                base_url=base_url,
                config_manager=self.config_manager,
                transcriber_factory=transcriber_factory,
                agent_factory=agent_factory,
                synthesizer_factory=synthesizer_factory,
                events_manager=self.events_manager,
            ).get_router()
        )
        for config in inbound_call_configs:
            self.router.add_api_route(
                config.url,
                self.create_inbound_route(inbound_call_config=config),
                methods=["POST"],
            )
        # vonage requires an events endpoint
        self.router.add_api_route("/events", self.events, methods=["GET", "POST"])
        logger.info(f"Set up events endpoint at https://{self.base_url}/events")

        self.router.add_api_route(
            "/recordings/{conversation_id}", self.recordings, methods=["GET", "POST"]
        )
        logger.info(
            f"Set up recordings endpoint at https://{self.base_url}/recordings/{{conversation_id}}"
        )

    def events(self, request: Request):
        return Response()

    async def recordings(self, request: Request, conversation_id: str):
        recording_url = (await request.json())["recording_url"]
        if self.events_manager is not None and recording_url is not None:
            self.events_manager.publish_event(
                RecordingEvent(recording_url=recording_url, conversation_id=conversation_id)
            )
        return Response()

    def create_inbound_route(
        self,
        inbound_call_config: AbstractInboundCallConfig,
    ):
        async def twilio_route(
            twilio_config: TwilioConfig,
            twilio_sid: str = Form(alias="CallSid"),
            twilio_from: str = Form(alias="From"),
            twilio_to: str = Form(alias="To"),
        ) -> Response:
            call_config = TwilioCallConfig(
                transcriber_config=inbound_call_config.transcriber_config
                or TwilioCallConfig.default_transcriber_config(),
                agent_config=inbound_call_config.agent_config,
                synthesizer_config=inbound_call_config.synthesizer_config
                or TwilioCallConfig.default_synthesizer_config(),
                twilio_config=twilio_config,
                twilio_sid=twilio_sid,
                from_phone=twilio_from,
                to_phone=twilio_to,
                direction="inbound",
            )

            conversation_id = create_conversation_id()
            await self.config_manager.save_config(conversation_id, call_config)
            return get_connection_twiml(base_url=self.base_url, call_id=conversation_id)

        async def vonage_route(vonage_config: VonageConfig, request: Request):
            vonage_answer_request = VonageAnswerRequest.parse_obj(await request.json())
            call_config = VonageCallConfig(
                transcriber_config=inbound_call_config.transcriber_config
                or VonageCallConfig.default_transcriber_config(),
                agent_config=inbound_call_config.agent_config,
                synthesizer_config=inbound_call_config.synthesizer_config
                or VonageCallConfig.default_synthesizer_config(),
                vonage_config=vonage_config,
                vonage_uuid=vonage_answer_request.uuid,
                to_phone=vonage_answer_request.from_,
                from_phone=vonage_answer_request.to,
                direction="inbound",
            )
            conversation_id = create_conversation_id()
            await self.config_manager.save_config(conversation_id, call_config)
            vonage_client = VonageClient(
                base_url=self.base_url,
                maybe_vonage_config=vonage_config,
                record_calls=vonage_config.record,
            )
            return vonage_client.create_call_ncco(
                conversation_id=conversation_id,
                record=vonage_config.record,
            )

        if isinstance(inbound_call_config, TwilioInboundCallConfig):
            logger.info(
                f"Set up inbound call TwiML at https://{self.base_url}{inbound_call_config.url}"
            )
            return partial(twilio_route, inbound_call_config.twilio_config)
        elif isinstance(inbound_call_config, VonageInboundCallConfig):
            logger.info(
                f"Set up inbound call NCCO at https://{self.base_url}{inbound_call_config.url}"
            )
            return partial(vonage_route, inbound_call_config.vonage_config)
        elif isinstance(inbound_call_config, ExotelInboundCallConfig):
            # Exotel route: handles Exotel Voicebot Applet WebSocket URL request
            async def exotel_route(exotel_config: ExotelConfig, request: Request):
                # Exotel sends JSON with call details
                try:
                    data = await request.json()
                except Exception:
                    data = {}
                
                exotel_sid = data.get("CallSid", data.get("call_sid", ""))
                exotel_from = data.get("From", data.get("from", ""))
                exotel_to = data.get("To", data.get("to", ""))
                
                call_config = ExotelCallConfig(
                    transcriber_config=inbound_call_config.transcriber_config
                    or ExotelCallConfig.default_transcriber_config(),
                    agent_config=inbound_call_config.agent_config,
                    synthesizer_config=inbound_call_config.synthesizer_config
                    or ExotelCallConfig.default_synthesizer_config(),
                    exotel_config=exotel_config,
                    exotel_sid=exotel_sid,
                    from_phone=exotel_from,
                    to_phone=exotel_to,
                    direction="inbound",
                )
                
                conversation_id = create_conversation_id()
                await self.config_manager.save_config(conversation_id, call_config)
                
                # Return WebSocket URL for Exotel Voicebot Applet
                exotel_client = ExotelClient(
                    base_url=self.base_url,
                    maybe_exotel_config=exotel_config,
                )
                ws_url = exotel_client.get_websocket_url(conversation_id)
                
                # Exotel expects JSON response with WebSocket URL
                from fastapi.responses import JSONResponse
                return JSONResponse({
                    "url": ws_url,
                    "conversation_id": conversation_id,
                })
            
            logger.info(
                f"Set up inbound Exotel call route at https://{self.base_url}{inbound_call_config.url}"
            )
            return partial(exotel_route, inbound_call_config.exotel_config)
        elif isinstance(inbound_call_config, PlivoInboundCallConfig):
            # Plivo route: returns XML with <Stream> for bidirectional WebSocket audio
            async def plivo_route(plivo_config: PlivoConfig, request: Request):
                try:
                    data = await request.form()
                    data = dict(data)
                except Exception:
                    data = {}

                call_uuid = data.get("CallUUID", "")
                plivo_from = data.get("From", "")
                plivo_to = data.get("To", "")

                call_config = PlivoCallConfig(
                    transcriber_config=inbound_call_config.transcriber_config
                    or PlivoCallConfig.default_transcriber_config(),
                    agent_config=inbound_call_config.agent_config,
                    synthesizer_config=inbound_call_config.synthesizer_config
                    or PlivoCallConfig.default_synthesizer_config(),
                    plivo_config=plivo_config,
                    plivo_call_uuid=call_uuid,
                    from_phone=plivo_from,
                    to_phone=plivo_to,
                    direction="inbound",
                )

                conversation_id = create_conversation_id()
                await self.config_manager.save_config(conversation_id, call_config)

                # Return XML with <Stream> for bidirectional WebSocket audio
                plivo_client = PlivoClient(
                    base_url=self.base_url,
                    maybe_plivo_config=plivo_config,
                )
                xml_response = plivo_client.get_stream_xml(conversation_id)

                return Response(
                    content=xml_response,
                    media_type="application/xml",
                )

            logger.info(
                f"Set up inbound Plivo call route at https://{self.base_url}{inbound_call_config.url}"
            )
            return partial(plivo_route, inbound_call_config.plivo_config)
        else:
            raise ValueError(f"Unknown inbound call config type {type(inbound_call_config)}")

    async def end_outbound_call(self, conversation_id: str):
        # TODO validation via twilio_client
        call_config = await self.config_manager.get_config(conversation_id)
        if not call_config:
            raise ValueError(f"Could not find call config for {conversation_id}")
        telephony_client: AbstractTelephonyClient
        if isinstance(call_config, TwilioCallConfig):
            telephony_client = TwilioClient(
                base_url=self.base_url, maybe_twilio_config=call_config.twilio_config
            )
            await telephony_client.end_call(call_config.twilio_sid)
        elif isinstance(call_config, VonageCallConfig):
            telephony_client = VonageClient(
                base_url=self.base_url, maybe_vonage_config=call_config.vonage_config
            )
            await telephony_client.end_call(call_config.vonage_uuid)
        elif isinstance(call_config, ExotelCallConfig):
            telephony_client = ExotelClient(
                base_url=self.base_url, maybe_exotel_config=call_config.exotel_config
            )
            await telephony_client.end_call(call_config.exotel_sid)
        elif isinstance(call_config, PlivoCallConfig):
            telephony_client = PlivoClient(
                base_url=self.base_url, maybe_plivo_config=call_config.plivo_config
            )
            await telephony_client.end_call(call_config.plivo_call_uuid)
        return {"id": conversation_id}

    def get_router(self) -> APIRouter:
        return self.router
