@echo off
REM Delete all files in uploads directory except this script
for %%f in ("%~dp0*.*") do (
  if /I not "%%~nxf"==".delete_old_uploads.bat" del "%%f"
)
