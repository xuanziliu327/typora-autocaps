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
# Test only: emulate a closed Typora for an isolated fake installation.
function Get-Process { return @() }
& (Join-Path $temp 'installer\Manage.ps1') -Action Install -FrameworkPath $framework
$installed = Join-Path $framework 'plugins\typora-autocaps'
foreach ($file in @('main.js', 'manifest.json')) {
  if ((Get-FileHash -LiteralPath (Join-Path $temp $file)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $installed $file)).Hash) { throw "Installed $file differs from ZIP payload" }
}
foreach ($file in @('README.md', 'README_EN.md', 'LICENSE', 'docs\TESTING.md', 'docs\ARCHITECTURE.md', 'test\manual-cases.md')) {
  if (!(Test-Path -LiteralPath (Join-Path $temp $file))) { throw "Missing package file: $file" }
}
Write-Host 'PASS: extracted release installer and payload hashes; packaged documentation present.'
