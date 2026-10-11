[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,

    [ValidateRange(1, 120)]
    [int]$StartupTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installDirectory = Join-Path $env:TEMP ("ultimate-ai-trading-smoke-" + [guid]::NewGuid().ToString('N'))
$app = $null
$connectorProcess = $null
$connectorShutdownFailed = $false
$previousDiscoverySetting = [Environment]::GetEnvironmentVariable('AITRADING_DISABLE_MT5_DISCOVERY', 'Process')

try {
    $env:AITRADING_DISABLE_MT5_DISCOVERY = '1'
    $setup = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDirectory") -PassThru -Wait
    if ($setup.ExitCode -ne 0) {
        throw "Installer exited with code $($setup.ExitCode)."
    }

    $appPath = Join-Path $installDirectory 'ultimate-ai-trading.exe'
    $installDeadline = (Get-Date).AddSeconds(60)
    while (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
        if ((Get-Date) -ge $installDeadline) {
            throw "Installed application was not found at '$appPath'."
        }
        Start-Sleep -Seconds 1
    }

    $connectorFiles = @(Get-ChildItem -LiteralPath $installDirectory -Filter 'mt5-connector.exe' -File -Recurse)
    if ($connectorFiles.Count -ne 1) {
        throw "Expected exactly one bundled mt5-connector.exe; found $($connectorFiles.Count)."
    }
    $connectorPath = $connectorFiles[0].FullName
    $guideFiles = @(Get-ChildItem -LiteralPath $installDirectory -Filter 'XM_ORDER_GUIDE.md' -File -Recurse)
    if ($guideFiles.Count -ne 1 -or $guideFiles[0].Length -eq 0) {
        throw "Expected exactly one bundled XM order guide; found $($guideFiles.Count)."
    }

    $app = Start-Process -FilePath $appPath -PassThru
    $startupDeadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    do {
        $app.Refresh()
        if ($app.HasExited) {
            throw "Application exited during startup with code $($app.ExitCode)."
        }
        $connectorProcess = Get-CimInstance Win32_Process |
            Where-Object { $_.ExecutablePath -eq $connectorPath -and $_.ParentProcessId -eq $app.Id } |
            Select-Object -First 1
        if ($app.MainWindowHandle -ne [IntPtr]::Zero -and $app.MainWindowTitle -eq 'Ultimate AI Trading') {
            if ($null -ne $connectorProcess) {
                break
            }
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $startupDeadline)

    $app.Refresh()
    if ($app.HasExited -or $app.MainWindowHandle -eq [IntPtr]::Zero -or $app.MainWindowTitle -ne 'Ultimate AI Trading') {
        throw "Application did not present the expected visible window within $StartupTimeoutSeconds seconds."
    }
    if ($null -eq $connectorProcess) {
        throw "The app did not launch its bundled MT5 connector within $StartupTimeoutSeconds seconds."
    }

    Write-Output "Install/startup passed: $($app.MainWindowTitle); bundled connector and XM order guide found (PID $($connectorProcess.ProcessId))."
}
finally {
    if ($null -eq $previousDiscoverySetting) {
        Remove-Item Env:AITRADING_DISABLE_MT5_DISCOVERY -ErrorAction SilentlyContinue
    } else {
        $env:AITRADING_DISABLE_MT5_DISCOVERY = $previousDiscoverySetting
    }

    if ($null -ne $app) {
        $app.Refresh()
        if (-not $app.HasExited) {
            [void]$app.CloseMainWindow()
            if (-not $app.WaitForExit(10000)) {
                Stop-Process -Id $app.Id
            }
        }
    }

    if ($null -ne $connectorProcess) {
        $connectorStillRunning = Get-CimInstance Win32_Process |
            Where-Object { $_.ProcessId -eq $connectorProcess.ProcessId }
        if ($null -ne $connectorStillRunning) {
            $connectorDeadline = (Get-Date).AddSeconds(10)
            do {
                Start-Sleep -Milliseconds 250
                $connectorStillRunning = Get-CimInstance Win32_Process |
                    Where-Object { $_.ProcessId -eq $connectorProcess.ProcessId }
            } while ($null -ne $connectorStillRunning -and (Get-Date) -lt $connectorDeadline)
        }
        if ($null -ne $connectorStillRunning) {
            Stop-Process -Id $connectorProcess.ProcessId
            $connectorShutdownFailed = $true
        }
    }

    $uninstaller = Join-Path $installDirectory 'uninstall.exe'
    if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
        $uninstall = Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru -Wait
        if ($uninstall.ExitCode -ne 0) {
            throw "Uninstaller exited with code $($uninstall.ExitCode)."
        }
    }

    if (Test-Path -LiteralPath $installDirectory) {
        Remove-Item -LiteralPath $installDirectory -Recurse -Force
    }

    if (Test-Path -LiteralPath $installDirectory) {
        throw "Smoke-test directory remains after cleanup: '$installDirectory'."
    }
    if ($connectorShutdownFailed) {
        throw "The bundled MT5 connector did not stop when the app closed."
    }
}
