[CmdletBinding()]
param(
  [ValidateSet('Install', 'Uninstall', 'Restore')][string]$Action = 'Install',
  [string]$FrameworkPath,
  [string]$BackupPath,
  [switch]$PurgeSettings,
  [switch]$AutoEnable,
  [switch]$NativeAppearance
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$id = 'typora-autocaps'

function FullPath([string]$path) { return [IO.Path]::GetFullPath($path).TrimEnd('\', '/') }
function AssertChild([string]$child, [string]$parent) {
  if (!(FullPath $child).StartsWith((FullPath $parent) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe path: $child" }
}
function AssertNoLink([string]$path) {
  if ((Test-Path -LiteralPath $path) -and ((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Refusing a linked plugin/backup directory: $path" }
}
function BackupPlugin {
  if (!(Test-Path -LiteralPath $target)) { return $null }
  AssertNoLink $target
  if (Get-ChildItem -LiteralPath $target -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Refusing a plugin directory containing links.' }
  $known = Join-Path $target 'manifest.json'
  if (!(Test-Path -LiteralPath $known) -or (Get-Content -LiteralPath $known -Raw | ConvertFrom-Json).id -ne $id) { throw 'Destination is not an AutoCaps installation; nothing was changed.' }
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  $dest = Join-Path $backupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6))
  Copy-Item -LiteralPath $target -Destination $dest -Recurse
  Write-Host "Backup: $dest"
  return $dest
}
try {
  if (Get-Process -Name Typora -ErrorAction SilentlyContinue) { throw 'Close all Typora windows before installing, updating, restoring or uninstalling.' }
  if (!$FrameworkPath) {
    $candidates = @((Join-Path $env:USERPROFILE '.typora\community-plugins'), (Join-Path $env:APPDATA 'Typora\plugins'))
    $FrameworkPath = $candidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'loader.js') } | Select-Object -First 1
    if (!$FrameworkPath) {
      Write-Host 'Typora Community Plugin was not found. Install the framework first:'
      Write-Host 'https://github.com/typora-community-plugin/typora-community-plugin/releases'
      $FrameworkPath = Read-Host 'Or enter its installed directory (containing loader.js); Enter to cancel'
      if (!$FrameworkPath) { throw 'Cancelled. No files changed.' }
    }
  }
  $FrameworkPath = FullPath $FrameworkPath.Trim('"')
  if (!(Test-Path -LiteralPath (Join-Path $FrameworkPath 'loader.js'))) { throw "Framework loader.js not found: $FrameworkPath" }
  $plugins = Join-Path $FrameworkPath 'plugins'
  $target = Join-Path $plugins $id
  $backupRoot = Join-Path $FrameworkPath 'autocaps-backups'
  AssertChild $target $plugins
  AssertNoLink $plugins
  AssertNoLink $backupRoot
  AssertNoLink $target
  if ($Action -eq 'Install') {
    $packageRoot = Split-Path $PSScriptRoot -Parent
    if (!(Test-Path -LiteralPath (Join-Path $packageRoot 'main.js'))) { $packageRoot = Join-Path $packageRoot 'dist' }
    $sourceManifest = Join-Path $packageRoot 'manifest.json'
    if (!(Test-Path -LiteralPath (Join-Path $packageRoot 'main.js')) -or !(Test-Path -LiteralPath $sourceManifest)) { throw 'Incomplete package: main.js or manifest.json missing. Extract the ZIP first.' }
    if ((Get-Content -LiteralPath $sourceManifest -Raw | ConvertFrom-Json).id -ne $id) { throw 'Unexpected package identity.' }
    $enablePlans = @()
    if ($AutoEnable) {
      foreach ($path in @('settings', 'settings\data', 'settings\plugins.json', 'settings\data\typora-autocaps.json', 'settings\core.json')) { AssertNoLink (Join-Path $FrameworkPath $path) }
      $enablePlans = @(Get-AutoCapsEnablePlans $FrameworkPath -NativeAppearance:$NativeAppearance)
    }
    $backup = BackupPlugin
    if ($AutoEnable) { Save-AutoCapsConfigBackup $enablePlans $backupRoot }
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    try {
      # Only these two owned files are replaced. Settings and unrelated files stay intact.
      foreach ($file in @('main.js', 'manifest.json')) { Copy-Item -LiteralPath (Join-Path $packageRoot $file) -Destination (Join-Path $target $file) -Force }
      foreach ($plan in $enablePlans) { Write-AutoCapsText $plan.Path $plan.Content }
    } catch {
      if ($enablePlans.Count) { Restore-AutoCapsConfigPlans $enablePlans }
      if ($backup) { foreach ($file in @('main.js', 'manifest.json')) { Copy-Item -LiteralPath (Join-Path $backup $file) -Destination (Join-Path $target $file) -Force } }
      else {
        AssertChild $target $plugins
        AssertNoLink $target
        Remove-Item -LiteralPath $target -Recurse -Force
      }
      throw
    }
    Write-Host "Installed: $target"
    if ($AutoEnable) { Write-Host 'AutoCaps enabled for startup. Fully restart Typora; no manual plugin activation needed.' }
    else { Write-Host 'Restart Typora > Ctrl+. > Installed Plugins > enable Typora AutoCaps.' }
  } elseif ($Action -eq 'Uninstall') {
    if (Test-Path -LiteralPath $target) {
      $backup = BackupPlugin
      AssertChild $target $plugins
      Remove-Item -LiteralPath $target -Recurse -Force
    }
    if ($PurgeSettings) {
      $dataRoot = Join-Path $FrameworkPath 'settings\data'
      $dataFile = Join-Path $dataRoot "$id.json"
      AssertChild $dataFile $dataRoot
      if (Test-Path -LiteralPath $dataFile) { Remove-Item -LiteralPath $dataFile -Force }
    }
    Write-Host 'Uninstalled. Preferences are retained unless -PurgeSettings was supplied. Backups remain for recovery.'
  } else {
    if (!$BackupPath) { $BackupPath = Read-Host 'Enter the full Backup path printed by Install/Uninstall' }
    $BackupPath = FullPath $BackupPath.Trim('"')
    AssertChild $BackupPath $backupRoot
    AssertNoLink $BackupPath
    if ((Get-Content -LiteralPath (Join-Path $BackupPath 'manifest.json') -Raw | ConvertFrom-Json).id -ne $id) { throw 'Not an AutoCaps backup.' }
    if (!(Test-Path -LiteralPath (Join-Path $BackupPath 'main.js'))) { throw 'Incomplete backup.' }
    $backup = BackupPlugin
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    foreach ($file in @('main.js', 'manifest.json')) { Copy-Item -LiteralPath (Join-Path $BackupPath $file) -Destination (Join-Path $target $file) -Force }
    Write-Host 'Restored. Restart Typora.'
  }
} catch {
  Write-Host "AutoCaps: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
exit 0
