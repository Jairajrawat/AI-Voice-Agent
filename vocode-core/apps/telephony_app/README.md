# Self-hosted Telephony Server

See https://docs.vocode.dev/open-source/telephony for setup steps!

## Deployment notes (Render)

This app needs a publicly reachable `BASE_URL` (hostname only; no scheme) so Twilio can hit your webhook.

- On Render, set `BASE_URL` to your service hostname (for example: `my-service.onrender.com`).
- Alternatively, the code will use Render's `RENDER_EXTERNAL_URL` if present.

## Local dev (optional ngrok)

Ngrok is now opt-in:

- Set `USE_NGROK=true`
- Set `NGROK_AUTH_TOKEN=<your token>`
