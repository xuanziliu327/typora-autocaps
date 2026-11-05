param([string]$ArchivePath)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
if (!$ArchivePath) { $ArchivePath = Join-Path $root "dist\typora-autocaps-$($manifest.version)-windows.zip" }
$temp = Join-Path $root ('.test-output\package-' + [guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $ArchivePath -DestinationPath $temp
$framework = Join-Path $temp 'fixture-framework'
New-Item -ItemType Directory -Path $framework | Out-Null
Set-Content -LiteralPath (Join-Path $framework 'loader.js') -Value '// fixture only'
Set-Content -LiteralPath (Join-Path $framework 'loader.json') -Value '{"coreVersion":"2.10.86"}'
New-Item -ItemType Directory -Path (Join-Path $framework '2.10.86') | Out-Null
Set-Content -LiteralPath (Join-Path $framework '2.10.86\core.js') -Value '// fixture only'
Set-Content -LiteralPath (Join-Path $framework '2.10.86\core.css') -Value '/* fixture only */'
$profile = Join-Path $temp 'fixture-profile'
# Setup expects the framework in the active Typora user-data directory.
New-Item -ItemType Directory -Path $profile | Out-Null
# Simulate an earlier AutoCaps-managed setup, exercising layout migration too.
Set-Content -LiteralPath (Join-Path $profile 'autocaps-installer.json') -Value '{"tool":"Typora AutoCaps"}' -Encoding ASCII
Move-Item -LiteralPath $framework -Destination (Join-Path $profile 'plugins')
$framework = Join-Path $profile 'plugins'
$typora = Join-Path $temp 'fixture-Typora'
New-Item -ItemType Directory -Path (Join-Path $typora 'resources') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $typora 'Typora.exe') -Value '// never executed'
Set-Content -LiteralPath (Join-Path $typora 'resources\window.html') -Value '<html><body><script src="typora://app/userData/plugins/loader.js" type="module"></script></body></html>'
# Test only: emulate a closed Typora for an isolated fake installation.
function Get-Process { return @() }
& (Join-Path $temp 'installer\Setup.ps1') -Action Plugin -TyporaPath $typora -UserDataPath $profile -NonInteractive -NoElevation
if ($LASTEXITCODE -ne 0) { throw 'Extracted installer failed.' }
$installed = Join-Path $framework 'plugins\typora-autocaps'
foreach ($file in @('main.js', 'manifest.json')) {
  if ((Get-FileHash -LiteralPath (Join-Path $temp $file)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $installed $file)).Hash) { throw "Installed $file differs from ZIP payload" }
}
foreach ($file in @('README.md', 'README_EN.md', 'LICENSE', 'docs\TESTING.md', 'docs\ARCHITECTURE.md', 'test\manual-cases.md')) {
  if (!(Test-Path -LiteralPath (Join-Path $temp $file))) { throw "Missing package file: $file" }
}
foreach ($prefix in @('1-', '2-')) {
  if (@(Get-ChildItem -LiteralPath $temp -File -Filter "$prefix*.cmd").Count -ne 1) { throw "Missing root installer entry: $prefix" }
}
$enabled = Get-Content -LiteralPath (Join-Path $framework 'settings\plugins.json') -Raw | ConvertFrom-Json
if ($enabled.'typora-autocaps' -ne $true) { throw 'Installed plugin is not enabled for startup.' }
$appearance = Get-Content -LiteralPath (Join-Path $framework 'settings\core.json') -Raw | ConvertFrom-Json
if ($appearance.settings.showRibbon -ne $false -or $appearance.settings.'internalPlugin.enabledPlugins'.'internal.workspace' -ne $false) { throw 'Native appearance profile is missing.' }
Write-Host 'PASS: two root entries, extracted setup, payload hashes, automatic startup and native appearance.'
