@echo off
REM ─────────────────────────────────────────────────────────────────────────
REM  THE SHIELD 2.0 — UDC Simulator v13 · Local Web Server Launcher
REM ─────────────────────────────────────────────────────────────────────────
REM  วัตถุประสงค์ : เปิด simulator ผ่าน http://localhost แทน file://
REM                 เพื่อหลีกเลี่ยง CORS block ที่ทำให้ Aviation/Seamarks ERR
REM
REM  วิธีใช้      : ดับเบิลคลิกไฟล์นี้ → จะเปิด browser ที่ port 8765 ให้
REM                 (ต้องการ Python 3 ติดตั้งบนเครื่อง — มากับ Windows Store)
REM
REM  ปิด server   : กด Ctrl+C ในหน้าต่าง CMD นี้
REM ─────────────────────────────────────────────────────────────────────────

cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   THE SHIELD 2.0 · UDC Simulator v13 — Local Server     ║
echo  ║   URL: http://localhost:8765/UDC_Simulator_13.html       ║
echo  ║   หยุดเซิร์ฟเวอร์: กด Ctrl+C                                ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

REM เปิดเบราว์เซอร์หลังจาก server ทำงาน 1.5 วินาที
start "" /B cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8765/UDC_Simulator_13.html"

REM พยายามใช้ python ก่อน → ถ้าไม่มีลอง py launcher
python proxy_server.py 2>nul
if errorlevel 1 (
    py -3 proxy_server.py 2>nul
)
if errorlevel 1 (
    echo.
    echo  [!] ไม่พบ Python — กรุณาติดตั้งจาก https://www.python.org/downloads/
    echo      หรือ Microsoft Store ^(ค้นหา "python"^)
    echo.
    pause
)
