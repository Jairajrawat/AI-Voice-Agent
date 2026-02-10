from vocode.streaming.models.audio import AudioEncoding, SamplingRate

# TODO(EPD-186): namespace as Twilio
DEFAULT_SAMPLING_RATE: int = SamplingRate.RATE_8000.value
DEFAULT_AUDIO_ENCODING = AudioEncoding.MULAW
DEFAULT_CHUNK_SIZE = 20 * 160
MULAW_SILENCE_BYTE = b"\xff"

VONAGE_SAMPLING_RATE: int = SamplingRate.RATE_16000.value
VONAGE_AUDIO_ENCODING = AudioEncoding.LINEAR16
VONAGE_CHUNK_SIZE = 640  # 20ms at 16kHz with 16bit samples
VONAGE_CONTENT_TYPE = "audio/l16;rate=16000"
PCM_SILENCE_BYTE = b"\x00"

# Exotel Voicebot Applet: 16-bit, 8kHz mono PCM (little-endian), base64 encoded
# Supports 8kHz, 16kHz, 24kHz sample rates via ?sample-rate query param
EXOTEL_SAMPLING_RATE: int = SamplingRate.RATE_8000.value
EXOTEL_AUDIO_ENCODING = AudioEncoding.LINEAR16  # raw/slin 16-bit PCM
EXOTEL_CHUNK_SIZE = 320  # Minimum chunk = 320 bytes (20ms at 8kHz 16-bit mono)

# Plivo Audio Streaming: bidirectional WebSocket via <Stream> XML element
# Default content type: audio/x-mulaw;rate=8000 (same as Twilio)
# Also supports: audio/x-l16;rate=8000, audio/x-l16;rate=16000
PLIVO_SAMPLING_RATE: int = SamplingRate.RATE_8000.value
PLIVO_AUDIO_ENCODING = AudioEncoding.MULAW  # audio/x-mulaw;rate=8000
PLIVO_CHUNK_SIZE = 20 * 160  # Same as Twilio (MULAW 8kHz)
PLIVO_CONTENT_TYPE = "audio/x-mulaw;rate=8000"

