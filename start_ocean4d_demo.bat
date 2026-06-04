@echo off
REM ============================================================
REM  The Shield Simulator - 4D Ocean LIVE demo launcher
REM  Starts the HYCOM live server (port 8799) and opens the
REM  simulator SAME-ORIGIN so live ocean fetch works reliably.
REM ============================================================
cd /d "%~dp0"
echo.
echo  [4D Ocean] Starting HYCOM live server on http://localhost:8799 ...
start "ocean4d-live-server (keep open during demo)" cmd /k node ocean4d_live_server.js
echo  [4D Ocean] Warming up the live cache (HYCOM forecast)...
timeout /t 6 /nobreak >nul
echo  [4D Ocean] Opening the simulator (same-origin = live works)...
start "" "http://localhost:8799/index.html"
echo.
echo  Done.
echo    - Simulator : http://localhost:8799/index.html
echo    - Keep the BLACK server window open during the whole demo.
echo    - Toggle the "4D Ocean" layer; the badge should turn GREEN (LIVE).
echo    - If you ever see a WHITE "SNAPSHOT" badge, the server window was
echo      closed or has no internet - the app still works on baked data.
echo.
pause
