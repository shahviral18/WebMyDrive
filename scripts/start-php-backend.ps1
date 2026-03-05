param(
    [int]$Port = 4000,
    [string]$ServerHost = "0.0.0.0"
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if ($existing) {
    Write-Output "PHP backend already running on http://${ServerHost}:$Port (PID $($existing[0].OwningProcess))."
    exit 0
}

$phpCandidates = @()
if ($env:PHP_BIN) {
    $phpCandidates += $env:PHP_BIN
}

$phpCandidates += @(
    "php",
    "C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe",
    "C:\xampp\php\php.exe"
)

$phpExe = $null
foreach ($candidate in $phpCandidates) {
    if ($candidate -eq "php") {
        $command = Get-Command php -ErrorAction SilentlyContinue
        if ($command) {
            $phpExe = $command.Source
            break
        }
        continue
    }

    if (Test-Path $candidate) {
        $phpExe = $candidate
        break
    }
}

if (-not $phpExe) {
    Write-Error "PHP runtime not found. Set PHP_BIN env var or install PHP and add it to PATH."
    exit 1
}

$arguments = @("-S", "$ServerHost`:$Port", "-t", "server-php/public", "server-php/router.php")
Start-Process -FilePath $phpExe -ArgumentList $arguments -WorkingDirectory $repoRoot | Out-Null

Start-Sleep -Seconds 2
$started = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $started) {
    Write-Error "Failed to start PHP backend on port $Port."
    exit 1
}

Write-Output "PHP backend started on http://${ServerHost}:$Port (PID $($started[0].OwningProcess))."
