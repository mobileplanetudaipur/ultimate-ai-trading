[CmdletBinding()]
param(
    [switch]$Development,
    [ValidateSet('nsis', 'msi')]
    [string]$Bundle = 'nsis'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot

try {
    $msvcRoot = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC\14.51.36231"
    $windowsSdkRoot = "${env:ProgramFiles(x86)}\Windows Kits\10"
    $windowsSdkVersion = '10.0.26100.0'
    $msvcBin = Join-Path $msvcRoot 'bin\Hostx64\x64'
    $sdkBin = Join-Path $windowsSdkRoot "bin\$windowsSdkVersion\x64"
    if ((Test-Path -LiteralPath (Join-Path $msvcBin 'link.exe')) -and (Test-Path -LiteralPath $sdkBin)) {
        $env:Path = "$msvcBin;$sdkBin;$env:USERPROFILE\.cargo\bin;$env:Path"
        $env:INCLUDE = @(
            (Join-Path $msvcRoot 'include'),
            (Join-Path $windowsSdkRoot "Include\$windowsSdkVersion\ucrt"),
            (Join-Path $windowsSdkRoot "Include\$windowsSdkVersion\um"),
            (Join-Path $windowsSdkRoot "Include\$windowsSdkVersion\shared"),
            (Join-Path $windowsSdkRoot "Include\$windowsSdkVersion\winrt"),
            (Join-Path $windowsSdkRoot "Include\$windowsSdkVersion\cppwinrt")
        ) -join ';'
        $env:LIB = @(
            (Join-Path $msvcRoot 'lib\x64'),
            (Join-Path $windowsSdkRoot "Lib\$windowsSdkVersion\ucrt\x64"),
            (Join-Path $windowsSdkRoot "Lib\$windowsSdkVersion\um\x64")
        ) -join ';'
    }

    python -m PyInstaller `
        --noconfirm `
        --clean `
        --onedir `
        --name mt5-connector `
        --distpath .\local-adapter\dist `
        --workpath .\local-adapter\build `
        --specpath .\local-adapter\build `
        --collect-all MetaTrader5 `
        --collect-all numpy `
        --collect-all psutil `
        --hidden-import MetaTrader5 `
        --hidden-import psutil `
        .\local-adapter\connector_main.py
    if ($LASTEXITCODE -ne 0) {
        throw "Bundled MT5 connector build failed with exit code $LASTEXITCODE."
    }

    $tauriArguments = @('run', 'tauri:build', '--', '--config', 'src-tauri/tauri.windows.conf.json', '--bundles', $Bundle)
    if ($Development) {
        $tauriArguments = @('run', 'tauri:dev', '--', '--config', 'src-tauri/tauri.windows.conf.json')
    }
    & npm @tauriArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Tauri Windows build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
