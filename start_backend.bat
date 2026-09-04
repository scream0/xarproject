@echo off
title XAR Project - Backend & Cloudflare Tunnel
echo ==============================================
echo Starting XAR Backend and Cloudflare Tunnel...
echo ==============================================

cd /d "%~dp0"

echo [1/2] Starting Cloudflare Tunnel...
start "Cloudflare Tunnel" cmd /c "cloudflared.exe tunnel --config config.yml run"

echo [2/2] Starting Golang Backend...
cd backend\cmd\api
go run main.go

pause
