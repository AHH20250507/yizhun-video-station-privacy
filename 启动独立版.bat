@echo off
cd /d "%~dp0"
start "" "http://127.0.0.1:8795/"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server_no_cache.py
) else (
  python server_no_cache.py
)
pause
