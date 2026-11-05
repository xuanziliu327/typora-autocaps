@echo off
chcp 65001 >nul
title Typora AutoCaps - 2 安装AutoCaps
echo.
echo   第 2 步：安装 AutoCaps 并自动启用
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0installer\Setup.ps1" -Action Plugin %*
set "setup_result=%ERRORLEVEL%"
echo.
if not "%setup_result%"=="0" echo   安装未完成，请查看上方提示。
pause
exit /b %setup_result%
