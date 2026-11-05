$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root 'dist'
$manifest = Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
if (!(Test-Path -LiteralPath (Join-Path $dist 'main.js'))) { throw 'Run node scripts/build.mjs first.' }
$stage = Join-Path $dist 'typora-autocaps'
if (Test-Path -LiteralPath $stage) {
  $resolvedStage = [IO.Path]::GetFullPath($stage)
  $resolvedDist = [IO.Path]::GetFullPath($dist).TrimEnd('\') + '\'
  if (!$resolvedStage.StartsWith($resolvedDist, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe staging path.' }
  if ((Get-Item -LiteralPath $stage -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked staging directory.' }
  Remove-Item -LiteralPath $stage -Recurse -Force
}
New-Item -ItemType Directory -Path $stage -Force | Out-Null
foreach ($file in @('main.js', 'manifest.json')) { Copy-Item -LiteralPath (Join-Path $dist $file) -Destination $stage -Force }
foreach ($file in @('README.md', 'README_EN.md', 'LICENSE', 'CHANGELOG.md')) { Copy-Item -LiteralPath (Join-Path $root $file) -Destination $stage -Force }
Get-ChildItem -LiteralPath $root -File -Filter '*.cmd' | Copy-Item -Destination $stage -Force
Copy-Item -LiteralPath (Join-Path $root 'installer') -Destination $stage -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root 'docs') -Destination $stage -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $stage 'test') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'test\manual-cases.md') -Destination (Join-Path $stage 'test')
Compress-Archive -LiteralPath @((Join-Path $dist 'main.js'), (Join-Path $dist 'manifest.json')) -DestinationPath (Join-Path $dist 'plugin.zip') -Force
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath (Join-Path $dist "typora-autocaps-$($manifest.version)-windows.zip") -Force
$sourceFiles = @('.gitattributes', '.gitignore', '.github', 'CHANGELOG.md', 'LICENSE', 'README.md', 'README_EN.md', 'manifest.json', 'package.json', 'pnpm-lock.yaml', 'docs', 'installer', 'scripts', 'src', 'test', 'tools') | ForEach-Object { Join-Path $root $_ }
$sourceFiles += @(Get-ChildItem -LiteralPath $root -File -Filter '*.cmd' | ForEach-Object FullName)
Compress-Archive -LiteralPath $sourceFiles -DestinationPath (Join-Path $dist "typora-autocaps-$($manifest.version)-source.zip") -Force
$artifacts = @('plugin.zip', "typora-autocaps-$($manifest.version)-source.zip", "typora-autocaps-$($manifest.version)-windows.zip")
$artifacts | ForEach-Object { Get-Item -LiteralPath (Join-Path $dist $_) } | ForEach-Object {
  $stream = [IO.File]::OpenRead($_.FullName)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
  "$hash  $($_.Name)"
} | Set-Content -LiteralPath (Join-Path $dist 'SHA256SUMS.txt') -Encoding ASCII
Get-Content -LiteralPath (Join-Path $dist 'SHA256SUMS.txt')
