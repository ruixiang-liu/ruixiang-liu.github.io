@echo off
cd /d "%~dp0.."
node tools/local-write-server.cjs
pause
