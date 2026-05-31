# Requires Administrator. Copies pgvector build artifacts into PostgreSQL 18 PGROOT.
$ErrorActionPreference = 'Stop'
$src = 'C:\Users\balag\AppData\Local\Temp\pgvector'
$pgRoot = 'D:\postgres\data'
$serviceName = 'postgresql-x64-18'
$logFile = 'D:\PraniDoctor\pranidoctor-backend\docs\audits\pgvector_install_elevated.log'

function Write-Log($msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Add-Content -Path $logFile -Value $line
  Write-Output $line
}

try {
  Write-Log 'Starting elevated pgvector file install'
  if (-not (Test-Path "$src\vector.dll")) { throw "Missing $src\vector.dll" }
  if (-not (Test-Path "$src\vector.control")) { throw "Missing $src\vector.control" }

  $svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -eq 'Running') {
    Write-Log "Stopping service $serviceName"
    Stop-Service -Name $serviceName -Force
    Start-Sleep -Seconds 3
  }

  Copy-Item -Path "$src\vector.dll" -Destination "$pgRoot\lib\vector.dll" -Force
  Write-Log 'Copied vector.dll'

  Copy-Item -Path "$src\vector.control" -Destination "$pgRoot\share\extension\vector.control" -Force
  Write-Log 'Copied vector.control'

  $sqlCount = (Get-ChildItem "$src\sql\vector--*.sql").Count
  Copy-Item -Path "$src\sql\vector--*.sql" -Destination "$pgRoot\share\extension" -Force
  Write-Log "Copied $sqlCount vector--*.sql files"

  if (-not (Test-Path "$pgRoot\lib\vector.dll")) { throw 'Verify failed: vector.dll' }
  if (-not (Test-Path "$pgRoot\share\extension\vector.control")) { throw 'Verify failed: vector.control' }

  Write-Log 'Starting service'
  Start-Service -Name $serviceName
  Start-Sleep -Seconds 2
  Write-Log "Service status: $((Get-Service $serviceName).Status)"
  Write-Log 'SUCCESS'
  exit 0
} catch {
  Write-Log "FAILED: $($_.Exception.Message)"
  try { Start-Service -Name $serviceName -ErrorAction SilentlyContinue } catch {}
  exit 1
}
