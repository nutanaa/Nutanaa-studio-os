param(
    [switch]$SkipBackend,
    [switch]$SkipEditor
)

$ErrorActionPreference = "SilentlyContinue"

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$Python = Join-Path $ProjectRoot "venv\Scripts\python.exe"

if (!(Test-Path $Python)) {
    $Python = Join-Path $ProjectRoot "editor\venv\Scripts\python.exe"
}

$BackendPort = 8787

$EditorExe = Join-Path $ProjectRoot "editor\.build\electron\Nutanaa Studio OS.exe"

$EditorCodeBat = Join-Path $ProjectRoot "editor\scripts\code.bat"

$Logs = Join-Path $ProjectRoot "logs"

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

# ---------------------------------------------------------
# Kill Existing Backend
# ---------------------------------------------------------

function Stop-Backend {

    Write-Host ""
    Write-Host "Stopping previous backend..." -ForegroundColor Yellow

    $connections = Get-NetTCPConnection `
        -LocalPort $BackendPort `
        -ErrorAction SilentlyContinue

    if ($connections) {

        $connections |
            Select-Object -ExpandProperty OwningProcess -Unique |
            ForEach-Object {

                Write-Host "Killing PID $_"

                Stop-Process `
                    -Id $_ `
                    -Force `
                    -ErrorAction SilentlyContinue

            }

    }

}

# ---------------------------------------------------------
# Start Backend
# ---------------------------------------------------------

function Start-Backend {

    Write-Host ""
    Write-Host "Starting Backend..." -ForegroundColor Cyan

    $env:PYTHONPATH = $ProjectRoot
    $env:PYTHONUNBUFFERED = "1"

    $stdout = Join-Path $Logs "backend.log"
    $stderr = Join-Path $Logs "backend.err"

    Remove-Item $stdout,$stderr -Force -ErrorAction SilentlyContinue

    $process = Start-Process `
        -FilePath $Python `
        -ArgumentList @(
            "-m",
            "uvicorn",
            "backend.api.main:app",
            "--host","127.0.0.1",
            "--port",$BackendPort,
            "--reload"
        ) `
        -WorkingDirectory $ProjectRoot `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden `
        -PassThru

    Write-Host "Backend PID : $($process.Id)" -ForegroundColor Green

}

# ---------------------------------------------------------
# Start Editor
# ---------------------------------------------------------

function Start-Editor {

    Write-Host ""
    Write-Host "Starting Nutanaa Studio OS..." -ForegroundColor Cyan

    if (Test-Path $EditorExe) {

        Start-Process `
            -FilePath $EditorExe `
            -WorkingDirectory (Join-Path $ProjectRoot "editor")

        return
    }

    if (Test-Path $EditorCodeBat) {

        Start-Process `
            -FilePath "cmd.exe" `
            -ArgumentList "/c", "`"$EditorCodeBat`" ." `
            -WorkingDirectory (Join-Path $ProjectRoot "editor")

        return
    }

    Write-Host "Editor executable not found." -ForegroundColor Red

}

# ---------------------------------------------------------
# Startup
# ---------------------------------------------------------

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "      Nutanaa Studio OS Launcher" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not $SkipBackend) {

    Stop-Backend

    Start-Backend

}

if (-not $SkipEditor) {

    Start-Editor

}

Write-Host ""
Write-Host "Launcher Finished." -ForegroundColor Green