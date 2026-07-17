@echo off
echo ============================================
echo   AGF Coleta - Gerar APK
echo ============================================
echo.

set ANDROID_HOME=C:\Users\E2236\AppData\Local\Android\Sdk
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot

echo Verificando Java...
"%JAVA_HOME%\bin\java" -version
echo.

echo Verificando Android SDK...
if not exist "%ANDROID_HOME%" (
    echo ERRO: Android SDK nao encontrado em %ANDROID_HOME%
    pause
    exit /b 1
)
echo Android SDK encontrado!
echo.

echo Iniciando Bubblewrap...
echo IMPORTANTE: Responda as perguntas assim:
echo   - JDK installer? -> N (nao)
echo   - JDK path -> cole: C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot
echo   - App name -> AGF Coleta
echo   - Package name -> com.agroflor.coleta
echo   - Host -> localhost
echo   - TWA Protocol -> N (nao)
echo   - Signing key -> Create new key
echo   - Key password -> crie uma senha (min 6 caracteres)
echo.

cd /d C:\AGF_Coleta
bubblewrap init --manifest=http://localhost:8080/manifest.json

echo.
echo ============================================
echo   Configuracao concluida!
echo   Agora execute: bubblewrap build
echo ============================================
pause
