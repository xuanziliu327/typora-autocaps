$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$temp = Join-Path $root ('.test-output\install-' + [guid]::NewGuid().ToString('N'))
$framework = Join-Path $temp 'custom framework path'
New-Item -ItemType Directory -Path $framework -Force | Out-Null
Set-Content -LiteralPath (Join-Path $framework 'loader.js') -Value '// test fixture; not a real framework'
$plugin = Join-Path $framework 'plugins\typora-autocaps'
$settingsDir = Join-Path $framework 'settings\data'
New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null
$settings = Join-Path $settingsDir 'typora-autocaps.json'
Set-Content -LiteralPath $settings -Value '{"version":1,"settings":{"enabled":false}}'
$settingsHash = (Get-FileHash -LiteralPath $settings).Hash
# Scoped process stub: the installer is tested only against a disposable fixture.
# Production script still refuses to install while the real Typora is running.
function Get-Process { return @() }
function Assert($ok, $message) { if (!$ok) { throw "FAILED: $message" } }
& (Join-Path $root 'installer\Manage.ps1') -Action Install -FrameworkPath $framework
Assert (Test-Path -LiteralPath (Join-Path $plugin 'main.js')) 'first installation'
Assert ((Get-Content -LiteralPath (Join-Path $plugin 'manifest.json') -Raw | ConvertFrom-Json).id -eq 'typora-autocaps') 'manifest'
Set-Content -LiteralPath (Join-Path $plugin 'main.js') -Value '// previous version'
$oldHash = (Get-FileHash -LiteralPath (Join-Path $plugin 'main.js')).Hash
& (Join-Path $root 'installer\Manage.ps1') -Action Install -FrameworkPath $framework
Assert ((Get-FileHash -LiteralPath (Join-Path $plugin 'main.js')).Hash -ne $oldHash) 'upgrade'
Assert ((Get-FileHash -LiteralPath $settings).Hash -eq $settingsHash) 'settings preserved'
$backup = Get-ChildItem -LiteralPath (Join-Path $framework 'autocaps-backups') -Directory | Select-Object -First 1
Assert ((Get-FileHash -LiteralPath (Join-Path $backup.FullName 'main.js')).Hash -eq $oldHash) 'exact backup'
& (Join-Path $root 'installer\Manage.ps1') -Action Restore -FrameworkPath $framework -BackupPath $backup.FullName
Assert ((Get-FileHash -LiteralPath (Join-Path $plugin 'main.js')).Hash -eq $oldHash) 'restore'
& (Join-Path $root 'installer\Manage.ps1') -Action Uninstall -FrameworkPath $framework
Assert (!(Test-Path -LiteralPath $plugin)) 'uninstall'
Assert (Test-Path -LiteralPath $settings) 'preferences retained on uninstall'
& (Join-Path $root 'installer\Manage.ps1') -Action Install -FrameworkPath $framework
& (Join-Path $root 'installer\Manage.ps1') -Action Uninstall -FrameworkPath $framework -PurgeSettings
Assert (!(Test-Path -LiteralPath $settings)) 'explicit preferences purge'
Write-Host 'PASS: install, upgrade, exact backup, restore, uninstall, preference preservation and purge.'
Write-Host "Fixture kept for inspection: $temp"
