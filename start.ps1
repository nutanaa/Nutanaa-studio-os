param(
    [switch]$SkipBackend,
    [switch]$SkipEditor
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $ProjectRoot "editor\venv\Scripts\python.exe"
$UvicornPort = 8787
$UvicornProcessName = "uvicorn"

function Test-UvicornRunning {
    try {
        $connection = Test-NetConnection -ComputerName 127.0.0.1 -Port $UvicornPort -WarningAction SilentlyContinue
        return $connection.TcpTestSucceeded
    } catch {
        return $false
    }
}

function Start-Uvicorn {
    Write-Host "Starting uvicorn backend on port $UvicornPort..." -ForegroundColor Cyan
    $env:PYTHONPATH = "."
    $env:PYTHONUNBUFFERED = "1"
    $env:PYTHONDONTWRITEBYTECODE = "1"

    $proc = Start-Process -FilePath $VenvPython -ArgumentList "-m", "uvicorn", "backend.api.main:app", "--host", "127.0.0.1", "--port", $UvicornPort, "--reload" -PassThru -NoNewWindow
    Write-Host "uvicorn started (PID: $($proc.Id))" -ForegroundColor Green

    $timeout = 30
    $elapsed = 0
    while (-not (Test-UvicornRunning) -and $elapsed -lt $timeout) {
        Start-Sleep -Seconds 1
        $elapsed++
    }

    if (Test-UvicornRunning) {
        Write-Host "Backend is ready on http://127.0.0.1:$UvicornPort" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Backend may not be ready yet. Check the terminal for errors." -ForegroundColor Yellow
    }
}

function Start-Editor {
    Write-Host "Opening VS Code..." -ForegroundColor Cyan
    $codeScript = Join-Path $ProjectRoot "editor\scripts\code.bat"
    if (Test-Path $codeScript) {
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-Command", "& '$codeScript'" -Verb Open
    } else {
        Write-Host "ERROR: code.bat not found at $codeScript" -ForegroundColor Red
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Nutanaa Studio OS - Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipBackend) {
    if (Test-UvicornRunning) {
        Write-Host "Backend is already running on port $UvicornPort" -ForegroundColor Green
    } else {
        Start-Uvicorn
    }
} else {
    Write-Host "Skipping backend startup (SkipBackend flag)" -ForegroundColor Yellow
}

if (-not $SkipEditor) {
    Start-Editor
} else {
    Write-Host "Skipping editor startup (SkipEditor flag)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Nutanaa Studio OS is ready." -ForegroundColor Cyan