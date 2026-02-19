# Standard library imports
import os
import sys
from urllib.parse import urlparse

from dotenv import load_dotenv

# Third-party imports
from fastapi import FastAPI
from loguru import logger
from pyngrok import ngrok

# Local application/library specific imports
from speller_agent import SpellerAgentFactory

from vocode.logging import configure_pretty_logging
from vocode.streaming.models.agent import ChatGPTAgentConfig
from vocode.streaming.models.message import BaseMessage
from vocode.streaming.models.telephony import TwilioConfig
from vocode.streaming.telephony.config_manager.redis_config_manager import RedisConfigManager
from vocode.streaming.telephony.server.base import TelephonyServer, TwilioInboundCallConfig

# if running from python, this will load the local .env
# docker-compose will load the .env file by itself
load_dotenv()

configure_pretty_logging()

app = FastAPI(docs_url=None)

config_manager = RedisConfigManager()


def _strip_scheme(url_or_host: str) -> str:
    value = (url_or_host or "").strip()
    if not value:
        return ""
    if "://" not in value:
        return value
    parsed = urlparse(value)
    return parsed.netloc or value.replace("https://", "").replace("http://", "")


def _truthy_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_uvicorn_port_default() -> int:
    if "--port" in sys.argv:
        try:
            return int(sys.argv[sys.argv.index("--port") + 1])
        except Exception:
            pass
    try:
        return int(os.getenv("PORT", "3000"))
    except Exception:
        return 3000


def resolve_base_url() -> str:
    base_url = os.getenv("BASE_URL")
    if base_url:
        return _strip_scheme(base_url)

    # Render sets this to something like: https://<service>.onrender.com
    render_external_url = os.getenv("RENDER_EXTERNAL_URL")
    if render_external_url:
        return _strip_scheme(render_external_url)

    # ngrok is optional and should be used only when explicitly enabled.
    if not _truthy_env("USE_NGROK"):
        return ""

    ngrok_auth = os.getenv("NGROK_AUTH_TOKEN") or os.getenv("NGROK_AUTHTOKEN")
    if ngrok_auth:
        ngrok.set_auth_token(ngrok_auth)

    port = _get_uvicorn_port_default()
    try:
        public_url = ngrok.connect(port).public_url
    except Exception:
        logger.exception(
            "Failed to start ngrok tunnel. Set BASE_URL (recommended for production) or configure ngrok auth.",
        )
        raise

    resolved = _strip_scheme(public_url)
    logger.info('ngrok tunnel "{}" -> "http://127.0.0.1:{}"'.format(resolved, port))
    return resolved


BASE_URL = resolve_base_url()

if not BASE_URL:
    raise ValueError(
        "BASE_URL is required. On Render, set BASE_URL to your public hostname (e.g. '<service>.onrender.com') "
        "or rely on RENDER_EXTERNAL_URL. For local dev, set USE_NGROK=true and NGROK_AUTH_TOKEN."
    )

telephony_server = TelephonyServer(
    base_url=BASE_URL,
    config_manager=config_manager,
    inbound_call_configs=[
        TwilioInboundCallConfig(
            url="/inbound_call",
            agent_config=ChatGPTAgentConfig(
                initial_message=BaseMessage(text="What up"),
                prompt_preamble="Have a pleasant conversation about life",
                generate_responses=True,
            ),
            # uncomment this to use the speller agent instead
            # agent_config=SpellerAgentConfig(
            #     initial_message=BaseMessage(
            #         text="im a speller agent, say something to me and ill spell it out for you"
            #     ),
            #     generate_responses=False,
            # ),
            twilio_config=TwilioConfig(
                account_sid=os.environ["TWILIO_ACCOUNT_SID"],
                auth_token=os.environ["TWILIO_AUTH_TOKEN"],
            ),
        )
    ],
    agent_factory=SpellerAgentFactory(),
)

app.include_router(telephony_server.get_router())
