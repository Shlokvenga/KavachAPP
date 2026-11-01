@echo off
title Kavach hub
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "process.exit(+process.versions.node.split('.')[0]>=18?0:1)"
if errorlevel 1 goto oldnode
node hub.mjs --open
echo.
echo The Kavach hub has stopped.
pause
exit /b 0

:nonode
echo.
echo  Kavach needs Node.js (version 18 or newer) on this laptop.
echo  The download page will open now. Install the "LTS" version,
echo  then double-click start-windows.bat again.
echo.
start "" https://nodejs.org/en/download
pause
exit /b 1

:oldnode
echo.
echo  This laptop has an old Node.js. Kavach needs version 18 or newer.
echo  The download page will open now. Install the "LTS" version, then try again.
echo.
start "" https://nodejs.org/en/download
pause
exit /b 1
