@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
REM MediStat — installation sur Windows
REM Installe l'application dans %LOCALAPPDATA%\MediStat et crée un raccourci.

echo.
echo  ╭──────────────────────────────────────────────╮
echo  │  MediStat — installation                     │
echo  ╰──────────────────────────────────────────────╯
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  [X] Node.js est introuvable.
  echo      Installez-le depuis https://nodejs.org ^(version 22 ou superieure^)
  echo      puis relancez cet installateur.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -pe "process.versions.node.split('.')[0]"') do set NODEMAJ=%%v
if !NODEMAJ! LSS 22 (
  echo  [X] Node.js 22 ou superieur est requis ^(version detectee : !NODEMAJ!^).
  pause
  exit /b 1
)

set "SOURCE=%~dp0.."
set "DEST=%LOCALAPPDATA%\MediStat"

echo  -^> Copie des fichiers vers %DEST%
if not exist "%DEST%" mkdir "%DEST%"
xcopy /E /I /Y /Q "%SOURCE%\css"    "%DEST%\css"    >nul
xcopy /E /I /Y /Q "%SOURCE%\js"     "%DEST%\js"     >nul
xcopy /E /I /Y /Q "%SOURCE%\assets" "%DEST%\assets" >nul
xcopy /E /I /Y /Q "%SOURCE%\server" "%DEST%\server" >nul
if exist "%SOURCE%\docs" xcopy /E /I /Y /Q "%SOURCE%\docs" "%DEST%\docs" >nul
copy /Y "%SOURCE%\index.html"          "%DEST%\" >nul
copy /Y "%SOURCE%\manifest.webmanifest" "%DEST%\" >nul
copy /Y "%SOURCE%\sw.js"               "%DEST%\" >nul

if not exist "%DEST%\.secret" (
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" > "%DEST%\.secret"
  echo  -^> Secret de signature engendre
)

echo  -^> Creation du lanceur
(
  echo @echo off
  echo chcp 65001 ^>nul
  echo set /p MEDISTAT_SECRET=^<"%DEST%\.secret"
  echo if "%%MEDISTAT_PORT%%"=="" set MEDISTAT_PORT=8080
  echo start "" http://localhost:%%MEDISTAT_PORT%%
  echo node "%DEST%\server\api.mjs" --port %%MEDISTAT_PORT%% --db "%DEST%\data\medistat.db"
) > "%DEST%\MediStat.bat"

set "MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
powershell -NoProfile -Command ^
  "$w = New-Object -ComObject WScript.Shell; ^
   $r = $w.CreateShortcut('%MENU%\MediStat.lnk'); ^
   $r.TargetPath = '%DEST%\MediStat.bat'; ^
   $r.WorkingDirectory = '%DEST%'; ^
   $r.IconLocation = '%DEST%\assets\icone-512.png'; ^
   $r.Description = 'Dossiers medicaux, laboratoire et analyse de donnees'; ^
   $r.Save()" >nul 2>&1

powershell -NoProfile -Command ^
  "$w = New-Object -ComObject WScript.Shell; ^
   $r = $w.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\MediStat.lnk'); ^
   $r.TargetPath = '%DEST%\MediStat.bat'; ^
   $r.WorkingDirectory = '%DEST%'; ^
   $r.IconLocation = '%DEST%\assets\icone-512.png'; ^
   $r.Save()" >nul 2>&1

echo.
echo  [OK] Installation terminee.
echo.
echo       Lancer   : raccourci MediStat sur le Bureau ou dans le menu Demarrer
echo       Donnees  : %DEST%\data\
echo.
echo       Astuce : dans Edge ou Chrome, le bouton « Installer » de la barre
echo                d'adresse installe aussi MediStat comme application.
echo.
echo       Desinstaller : supprimez %DEST% et les raccourcis.
echo.
pause
