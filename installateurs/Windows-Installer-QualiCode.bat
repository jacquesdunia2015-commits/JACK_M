@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Installation de QualiCode

REM ============================================================
REM  QualiCode - installation sur un ordinateur Windows
REM  Copie l'application dans votre dossier personnel et cree
REM  une icone sur le Bureau + dans le menu Demarrer.
REM  AUCUNE connexion internet n'est necessaire.
REM  Si Chrome ou Edge est present, le raccourci ouvre QualiCode
REM  en MODE APPLICATION : fenetre propre, sans barre d'adresse,
REM  exactement comme un logiciel installe.
REM  Pour desinstaller : supprimez les raccourcis et le dossier
REM  indique a la fin. Rien n'est ecrit dans le registre.
REM ============================================================

echo.
echo   ================================================
echo     QualiCode - Installation sur cet ordinateur
echo   ================================================
echo.

REM --- 1. Retrouver le fichier de l'application ---------------
set "APP="
for %%F in (
  "%~dp0QualiCode.html"
  "%~dp0..\dist\QualiCode.html"
  "%~dp0..\QualiCode.html"
) do if exist "%%~fF" if not defined APP set "APP=%%~fF"

if not defined APP (
  echo   [X] Fichier QualiCode.html introuvable.
  echo.
  echo   Placez ce script a cote du fichier QualiCode.html,
  echo   puis relancez-le.
  echo.
  pause
  exit /b 1
)
echo   Application trouvee : %APP%

REM --- 2. Copier dans le dossier personnel --------------------
set "DEST=%LOCALAPPDATA%\QualiCode"
if not exist "%DEST%" mkdir "%DEST%"
copy /y "%APP%" "%DEST%\QualiCode.html" >nul
if exist "%~dp0..\assets\logo\qualicode.ico" copy /y "%~dp0..\assets\logo\qualicode.ico" "%DEST%\qualicode.ico" >nul
if exist "%~dp0qualicode.ico" copy /y "%~dp0qualicode.ico" "%DEST%\qualicode.ico" >nul
echo   Copie dans : %DEST%

REM --- 3. Chercher Chrome ou Edge (mode application) ----------
set "BROWSER="
for %%B in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do if exist "%%~B" if not defined BROWSER set "BROWSER=%%~B"

if defined BROWSER (
  echo   Navigateur detecte : %BROWSER%
  echo   Le raccourci ouvrira QualiCode en fenetre d'application.
) else (
  echo   Chrome/Edge non detectes : le raccourci ouvrira QualiCode
  echo   dans votre navigateur par defaut.
)

REM --- 4. Creer les raccourcis (Bureau + menu Demarrer) -------
set "ICON=%DEST%\qualicode.ico"
if not exist "%ICON%" set "ICON=%DEST%\QualiCode.html"
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

if defined BROWSER (
  set "TARGET=%BROWSER%"
  set "ARGS=--app=file:///%DEST:\=/%/QualiCode.html"
) else (
  set "TARGET=%DEST%\QualiCode.html"
  set "ARGS="
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$w = New-Object -ComObject WScript.Shell;" ^
  "foreach ($dir in @([Environment]::GetFolderPath('Desktop'), '%STARTMENU%')) {" ^
  "  $s = $w.CreateShortcut((Join-Path $dir 'QualiCode.lnk'));" ^
  "  $s.TargetPath = '%TARGET%';" ^
  "  $s.Arguments = '%ARGS%';" ^
  "  $s.IconLocation = '%ICON%';" ^
  "  $s.Description = 'QualiCode - analyse qualitative de donnees';" ^
  "  $s.WorkingDirectory = '%DEST%';" ^
  "  $s.Save() }"

if errorlevel 1 (
  echo   [!] Les raccourcis n'ont pas pu etre crees automatiquement.
  echo       Vous pouvez ouvrir l'application directement ici :
  echo       %DEST%\QualiCode.html
) else (
  echo   Icone QualiCode ajoutee sur le Bureau et au menu Demarrer.
)

echo.
echo   Termine : double-cliquez l'icone QualiCode pour travailler.
echo   (Pour desinstaller : supprimez les raccourcis QualiCode.lnk
echo    et le dossier %DEST%)
echo.
pause
