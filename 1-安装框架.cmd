@echo off
chcp 65001 >nul
title Typora AutoCaps - 1 安装框架
echo.
echo   第 1 步：安装插件框架（仅首次需要）
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0installer\Setup.ps1" -Action Framework %*
set "setup_result=%ERRORLEVEL%"
echo.
if not "%setup_result%"=="0" echo   安装未完成，请查看上方提示。
pause
exit /b %setup_result%
