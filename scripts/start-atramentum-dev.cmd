@echo off
setlocal
cd /d "%~dp0.."
corepack pnpm --store-dir=.pnpm-store --filter app dev
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Manuscript failed to start. Exit code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
