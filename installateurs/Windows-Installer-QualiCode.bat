@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Installation de QualiCode

REM ============================================================
REM  QualiCode - installation sur un ordinateur Windows
REM  Copie l'application dans votre dossier personnel et cree
REM  une icone sur le Bureau + dans le menu Demarrer.
REM  Aucune connexion internet n'est necessaire.
REM  Rien n'est installe dans Windows : pour desinstaller, il
REM  suffit de supprimer les raccourcis et le dossier indique.
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

REM --- 3. Creer les raccourcis (Bureau + menu Demarrer) -------
set "ICON=%DEST%\qualicode.ico"
if not exist "%ICON%" set "ICON=%DEST%\QualiCode.html"
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$w = New-Object -ComObject WScript.Shell;" ^
  "foreach ($dir in @([Environment]::GetFolderPath('Desktop'), '%STARTMENU%')) {" ^
  "  $s = $w.CreateShortcut((Join-Path $dir 'QualiCode.lnk'));" ^
  "  $s.TargetPath = '%DEST%\QualiCode.html';" ^
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
echo   (Pour desinstaller : supprimez les raccourcis et le dossier
echo    %DEST%)
echo.
pause
