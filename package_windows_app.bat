@echo off
title DYNOSHI ANDROID LAB - Windows Executable Packaging
color 0D
cls

echo ===============================================================================
echo         D Y N O S H I   A N D R O I D   L A B   B U I L D E R
echo              Packaging Standalone Windows Application (.exe)
echo ===============================================================================
echo.

echo [1/4] Building production web frontend bundle...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)

echo [2/4] Verifying Electron runtime dependencies...
npm list electron >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Installing Electron packager...
    call npm install --save-dev electron electron-builder
)

echo [3/4] Compiling Windows Executable Package...
npx electron-builder --win --x64

echo.
echo ===============================================================================
echo [SUCCESS] Windows packaging complete!
echo Output executable created in: dist/dynoshi-android-lab-setup.exe
echo ===============================================================================
echo.
pause
