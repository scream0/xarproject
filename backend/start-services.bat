@echo off
echo Starting XAR Backend and Cloudflare Tunnel...
cd /d "D:\Xar Project\xar project react.js\xar-project\backend"

echo Starting Go Backend...
start "XAR Backend API" /min cmd /c "go run cmd\api\main.go > backend.log 2>&1"

echo Starting Cloudflare Tunnel (HTTP2 Mode)...
:: Menggunakan protocol http2 untuk mencegah isu koneksi terputus (QUIC UDP sering tidak stabil)
start "Cloudflare Tunnel" /min cmd /c "cloudflared.exe tunnel --protocol http2 --config config.yml run > tunnel.log 2>&1"
