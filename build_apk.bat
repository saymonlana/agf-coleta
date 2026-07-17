@echo off
echo ============================================
echo   AGF Coleta - Build APK
echo ============================================
echo.

set ANDROID_HOME=C:\Users\E2236\AppData\Local\Android\Sdk
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot

cd /d C:\AGF_Coleta

echo Buildando o APK...
echo Isso pode demorar alguns minutos...
echo.

bubblewrap build

echo.
echo ============================================
echo   APK gerado com sucesso!
echo   Procure o arquivo .apk na pasta do projeto
echo ============================================
pause
