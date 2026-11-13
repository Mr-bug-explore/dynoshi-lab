@echo off
title DYNOSHI ANDROID LAB - Desktop Control Center
color 0B
cls

echo ===============================================================================
echo               D Y N O S H I   A N D R O I D   L A B
echo       Real Android Emulator, Physical ADB & Automation Control Center
echo ===============================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js v18+ or v20+ LTS from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detected:
node -v
echo.

:: 2. Check Android SDK, ADB, and Emulator binaries
echo [INFO] Scanning system for Android SDK platform-tools and emulator...
where adb >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Android Debug Bridge (ADB) found in PATH:
    adb version | findstr /i "Android Debug Bridge"
) else (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        echo [OK] Android SDK detected at %LOCALAPPDATA%\Android\Sdk
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
        set "PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools;%LOCALAPPDATA%\Android\Sdk\emulator;%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin;%PATH%"
    ) else if exist "C:\Android\Sdk\platform-tools\adb.exe" (
        echo [OK] Android SDK detected at C:\Android\Sdk
        set "ANDROID_HOME=C:\Android\Sdk"
        set "PATH=C:\Android\Sdk\platform-tools;C:\Android\Sdk\emulator;C:\Android\Sdk\cmdline-tools\latest\bin;%PATH%"
    ) else (
        echo [WARNING] Android SDK platform-tools not found in default locations.
        echo Install Android Studio / SDK Command-line Tools or attach a phone via ADB TCP/IP.
        echo Configure your SDK path in Dynoshi Settings ^& Diagnostics once open.
    )
)
echo.

:: 3. Check node_modules
if not exist "node_modules\" (
    echo [INFO] First-time setup: Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b 1
    )
)

:: 4. Start DYNOSHI ANDROID LAB
echo [INFO] Launching DYNOSHI ANDROID LAB Desktop Server...
echo [INFO] Server URL: http://localhost:3000
echo.

start "" http://localhost:3000
npm run dev

pause
