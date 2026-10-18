@echo off
chcp 65001 >nul
title NOVA PHARMA OS
cd /d "%~dp0"

echo.
echo   Demarrage de NOVA PHARMA OS...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   ERREUR : Node.js n'est pas installe sur cet ordinateur.
  echo.
  echo   1. Ouvrez le site  https://nodejs.org
  echo   2. Telechargez la version "LTS"
  echo   3. Installez-la en cliquant Suivant a chaque etape
  echo   4. Relancez ce fichier
  echo.
  pause
  exit /b 1
)

node demarrer.mjs

echo.
echo   L'application est arretee.
pause
