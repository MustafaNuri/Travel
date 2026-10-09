@echo off
rem ============================================================
rem  Siteyi yayinla: Obsidian -> site -> GitHub
rem  Cift tiklayin. Is ve ev bilgisayarinda ayni sekilde calisir.
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0"

rem --- Python'u bul (once Anaconda, sonra sistemdeki Python) ---
set "PY="
if exist "%USERPROFILE%\anaconda3\python.exe" set "PY=%USERPROFILE%\anaconda3\python.exe"
if not defined PY if exist "%USERPROFILE%\miniconda3\python.exe" set "PY=%USERPROFILE%\miniconda3\python.exe"
if not defined PY (
    where py >nul 2>nul
    if not errorlevel 1 set "PY=py"
)
if not defined PY (
    where python >nul 2>nul
    if not errorlevel 1 set "PY=python"
)
if not defined PY (
    echo Python bulunamadi. Lutfen Python ya da Anaconda kurun.
    pause
    exit /b 1
)

echo === 1/3 Obsidian notlari siteye aktariliyor ===
"%PY%" araclar\wiki_senkron.py
if errorlevel 1 (
    echo.
    echo Betik hata verdi, hicbir sey gonderilmedi.
    pause
    exit /b 1
)

echo.
echo === 2/3 Degisen dosyalar ===
git status --short
echo.
set "ONAY="
set /p ONAY=Bunlari GitHub'a gondereyim mi? (e/h): 
if /i not "%ONAY%"=="e" (
    echo Gonderilmedi. Site yerel olarak guncel.
    pause
    exit /b 0
)

echo.
echo === 3/3 GitHub'a gonderiliyor ===
git add -A
git commit -m "Site guncellendi"
git push
if errorlevel 1 (
    echo.
    echo Push basarisiz oldu. Yukaridaki mesaja bakin.
    pause
    exit /b 1
)
echo.
echo Tamam! Site 1-2 dakika icinde guncellenir.
pause
