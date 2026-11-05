[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$TyporaPath,
  [Parameter(Mandatory=$true)][string]$FrameworkZip,
  [switch]$Launch
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$TyporaPath = [IO.Path]::GetFullPath($TyporaPath)
$FrameworkZip = [IO.Path]::GetFullPath($FrameworkZip)
if (!(Test-Path -LiteralPath (Join-Path $TyporaPath 'Typora.exe')) -or !(Test-Path -LiteralPath (Join-Path $TyporaPath 'resources\window.html'))) { throw 'Expected a Windows Typora installation containing resources/window.html.' }
if (!(Test-Path -LiteralPath (Join-Path $root 'dist\main.js'))) { throw 'Run node scripts/build.mjs first.' }
$fixture = Join-Path $root ('.test-output\native-' + [guid]::NewGuid().ToString('N'))
$app = Join-Path $fixture 'app'
$profile = Join-Path $fixture 'profile'
New-Item -ItemType Directory -Path $app,$profile -Force | Out-Null
Set-Content -LiteralPath (Join-Path $profile 'AUTOCAPS_TEST_PROFILE') -Value 'Disposable AutoCaps native integration fixture.' -Encoding ASCII
# Own copies of application files; existing resource directories are shared via
# junctions for reading. No test script writes through these resource junctions.
Get-ChildItem -LiteralPath $TyporaPath -File | Where-Object { $_.Name -notlike 'unins*' -and $_.Name -ne 'DO NOT ADD FILES HERE' } | Copy-Item -Destination $app
Get-ChildItem -LiteralPath $TyporaPath -Directory | Where-Object Name -ne 'resources' | ForEach-Object { New-Item -ItemType Junction -Path (Join-Path $app $_.Name) -Target $_.FullName | Out-Null }
$resources = Join-Path $app 'resources'
New-Item -ItemType Directory -Path $resources | Out-Null
Get-ChildItem -LiteralPath (Join-Path $TyporaPath 'resources') -File | Copy-Item -Destination $resources
Get-ChildItem -LiteralPath (Join-Path $TyporaPath 'resources') -Directory | ForEach-Object { New-Item -ItemType Junction -Path (Join-Path $resources $_.Name) -Target $_.FullName | Out-Null }
$plugins = Join-Path $profile 'plugins'
Expand-Archive -LiteralPath $FrameworkZip -DestinationPath $plugins
if (!(Test-Path -LiteralPath (Join-Path $plugins 'loader.js'))) { throw 'Framework ZIP must have loader.js at its root.' }
$autoCaps = Join-Path $plugins 'plugins\typora-autocaps'
$probe = Join-Path $plugins 'plugins\autocaps-native-probe'
New-Item -ItemType Directory -Path $autoCaps,$probe -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'dist\main.js'),(Join-Path $root 'dist\manifest.json') -Destination $autoCaps
Copy-Item -Path (Join-Path $root 'tools\native-probe\*') -Destination $probe
$settings = Join-Path $plugins 'settings'
New-Item -ItemType Directory -Path $settings -Force | Out-Null
Set-Content -LiteralPath (Join-Path $settings 'plugins.json') -Value '{"typora-autocaps":true,"autocaps-native-probe":true}' -Encoding ASCII
# Match the two-entry installer's native appearance profile.
Set-Content -LiteralPath (Join-Path $settings 'core.json') -Value '{"version":2,"settings":{"showRibbon":false,"internalPlugin.enabledPlugins":{"internal.workspace":false}}}' -Encoding ASCII
$html = Join-Path $resources 'window.html'
$markup = [IO.File]::ReadAllText($html)
if (!$markup.Contains('</body></html>')) { throw 'Unknown window.html format. Fixture not launched.' }
# The original installed HTML is never changed; retain an additional copy here.
Copy-Item -LiteralPath $html -Destination ($html + '.original')
if ($markup -notmatch 'typora://(?:app/)?userData/plugins/loader\.js') {
  $markup = $markup.Replace('</body></html>', '<script src="typora://app/userData/plugins/loader.js" type="module"></script></body></html>')
}
[IO.File]::WriteAllText($html,$markup,[Text.UTF8Encoding]::new($false))
$metadata = @{ app=$app; profile=$profile; report=(Join-Path $profile 'native-report.json') }
$metadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fixture 'fixture.json') -Encoding UTF8
Write-Host "Fixture: $fixture"
Write-Host "Report: $($metadata.report)"
if ($Launch) {
  $process = Start-Process -FilePath (Join-Path $app 'Typora.exe') -ArgumentList @('--user-data-dir="' + $profile + '"') -WindowStyle Hidden -PassThru
  Write-Host "Test Typora process: $($process.Id). Allow about 15 seconds, then inspect native-report.json."
  Write-Host 'Launch the same copied executable with the same --user-data-dir a second time to verify initialPreference=false after restart.'
}
