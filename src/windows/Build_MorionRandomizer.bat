@echo off
setlocal
set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo .NET Framework 4.x compiler not found.
  pause
  exit /b 1
)
echo Building MorionRandomizer.exe...
"%CSC%" /nologo /target:winexe /utf8output /optimize /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /out:"%~dp0MorionRandomizer.exe" "%~dp0MorionRandomizer.cs"
if errorlevel 1 (
  echo Build failed!
  pause
  exit /b 1
)
echo Done! Launching MorionRandomizer.exe...
start "" "%~dp0MorionRandomizer.exe"
