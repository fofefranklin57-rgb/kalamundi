@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
set ANDROID_HOME=C:\Users\Franklin\AppData\Local\Android\Sdk
set GRADLE_HOME=%TEMP%\kalamundi-gradle-8.4\gradle-8.4
if not exist "%GRADLE_HOME%\bin\gradle.bat" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~dp0gradle-8.4-bin.zip' -DestinationPath '%TEMP%\kalamundi-gradle-8.4' -Force"
)
"%GRADLE_HOME%\bin\gradle.bat" %*
