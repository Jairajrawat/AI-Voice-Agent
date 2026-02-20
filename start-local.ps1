<#
.SYNOPSIS
    Start all Voice AI services locally for testing.
    Runs Node.js (5000), Vocode Python (3001), Nginx proxy (8080), and ngrok tunnel.

.DESCRIPTION
    This script starts everything you need to test AI phone calls locally.
    It opens 4 separate terminal windows. Close them all to stop.

.NOTES
    Prerequisites:
    - Node.js + npm (for the backend)
    - Python 3.10+ (for Vocode)
    - Nginx (download from https://nginx.org/en/download.html)
    - ngrok (download from https://ngrok.com/download, add authtoken)
    
    Set NGINX_PATH below if nginx is not in your PATH.
#>

# ─── Configuration ───────────────────────────────────────────────
$ProjectRoot   = "d:\Voice AI Project\test"
$VocodeDir     = "$ProjectRoot\vocode-core\apps\node_bridge"
$NginxConf     = "$ProjectRoot\nginx.dev.conf"

# If ngrok/nginx are not in PATH, set full paths here:
$NgrokExe      = "ngrok"       # e.g. "C:\tools\ngrok.exe"
$NginxExe      = "nginx"       # e.g. "C:\nginx\nginx.exe"

# Your static ngrok domain (from ngrok dashboard → Domains)
$NgrokDomain   = "mausolean-theodore-planklike.ngrok-free.dev"
# ─────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Voice AI Platform - Local Dev Startup " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Start Node.js Backend (port 5000) ──
Write-Host "[1/4] Starting Node.js backend (port 5000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# ── 2. Start Vocode Python (port 3001) ──
Write-Host "[2/4] Starting Vocode Python service (port 3001)..." -ForegroundColor Green
$vocodeEnv = @"
`$env:BASE_URL = '$NgrokDomain'
`$env:USE_IN_MEMORY_CONFIG_MANAGER = 'true'
`$env:OPENAI_API_KEY = '$((Get-Content "$ProjectRoot\.env" | Where-Object { $_ -match '^OPENAI_API_KEY=' }) -replace 'OPENAI_API_KEY=','')'
`$env:DEEPGRAM_API_KEY = '$((Get-Content "$ProjectRoot\.env" | Where-Object { $_ -match '^DEEPGRAM_API_KEY=' }) -replace 'DEEPGRAM_API_KEY=','')'
`$env:AZURE_SPEECH_KEY = '$((Get-Content "$ProjectRoot\.env" | Where-Object { $_ -match '^AZURE_SPEECH_KEY=' }) -replace 'AZURE_SPEECH_KEY=','')'
`$env:AZURE_SPEECH_REGION = '$((Get-Content "$ProjectRoot\.env" | Where-Object { $_ -match '^AZURE_SPEECH_REGION=' }) -replace 'AZURE_SPEECH_REGION=','')'
cd '$VocodeDir'
python -m uvicorn main:app --host 0.0.0.0 --port 3001 --reload
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $vocodeEnv -WindowStyle Normal

Start-Sleep -Seconds 2

# ── 3. Start Nginx Reverse Proxy (port 8080) ──
Write-Host "[3/4] Starting Nginx reverse proxy (port 8080)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Nginx proxy running on port 8080...' -ForegroundColor Yellow; & '$NginxExe' -c '$NginxConf' -g 'daemon off;'" -WindowStyle Normal

Start-Sleep -Seconds 2

# ── 4. Start ngrok tunnel (→ port 8080) ──
Write-Host "[4/4] Starting ngrok tunnel..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$NgrokExe' http 8080 --domain=$NgrokDomain" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All services launched!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Node.js backend:  http://localhost:5000" -ForegroundColor White
Write-Host "  Vocode service:   http://localhost:3001" -ForegroundColor White
Write-Host "  Nginx proxy:      http://localhost:8080" -ForegroundColor White
Write-Host "  Public URL:       https://$NgrokDomain" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Twilio webhook:   https://$NgrokDomain/webhooks/twilio/incoming" -ForegroundColor Yellow
Write-Host "  Twilio status:    https://$NgrokDomain/webhooks/twilio/status" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Test heartbeat:   curl http://localhost:8080/heartbeat" -ForegroundColor DarkGray
Write-Host "  Test Vocode:      curl http://localhost:8080/health" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To stop: close all 4 terminal windows" -ForegroundColor DarkGray
Write-Host ""
