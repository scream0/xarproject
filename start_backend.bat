@echo off
title XAR Project - Backend & Cloudflare Tunnel
echo ==============================================
echo Starting XAR Backend and Cloudflare Tunnel...
echo ==============================================

cd /d "%~dp0"

echo [1/2] Starting Cloudflare Tunnel (HTTP2 Mode)...
:: Menggunakan protocol http2 untuk mencegah isu koneksi terputus (QUIC UDP sering tidak stabil)
start "Cloudflare Tunnel" cmd /c "cloudflared.exe tunnel --protocol http2 --config config.yml run > tunnel.log 2>&1"

echo [2/2] Starting Golang Backend...
cd backend\cmd\api
go run main.go

pause
