@echo off
setlocal
cd /d "%~dp0.."
corepack pnpm --store-dir=.pnpm-store --filter app dev
