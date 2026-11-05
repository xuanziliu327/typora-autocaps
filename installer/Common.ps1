$ErrorActionPreference = 'Stop'

function Get-AutoCapsSha256([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
}

function Read-AutoCapsJson([string]$Path, $Default) {
  if (!(Test-Path -LiteralPath $Path)) { return $Default }
  $value = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) | ConvertFrom-Json
  if ($null -eq $value -or $value -isnot [pscustomobject]) { throw "Expected a JSON object, not overwriting: $Path" }
  return $value
}

function Write-AutoCapsText([string]$Path, [string]$Text) {
  $parent = Split-Path $Path -Parent
  if (!(Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $temp = Join-Path $parent ('.autocaps-' + [guid]::NewGuid().ToString('N') + '.tmp')
  $previous = $temp + '.previous'
  try {
    [IO.File]::WriteAllText($temp, $Text, [Text.UTF8Encoding]::new($false))
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($temp, $Path, $previous) }
    else { [IO.File]::Move($temp, $Path) }
  } finally {
    foreach ($file in @($temp, $previous)) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force } }
  }
}

function Get-AutoCapsEnablePlans([string]$FrameworkPath) {
  $pluginsPath = Join-Path $FrameworkPath 'settings\plugins.json'
  $dataPath = Join-Path $FrameworkPath 'settings\data\typora-autocaps.json'
  $plugins = Read-AutoCapsJson $pluginsPath ([pscustomobject]@{})
  $plugins | Add-Member -NotePropertyName 'typora-autocaps' -NotePropertyValue $true -Force
  $data = Read-AutoCapsJson $dataPath ([pscustomobject]@{version=1;settings=[pscustomobject]@{}})
  if (!$data.PSObject.Properties['settings'] -or $data.settings -isnot [pscustomobject]) { throw "Invalid plugin preferences, not overwriting: $dataPath" }
  $data.settings | Add-Member -NotePropertyName 'enabled' -NotePropertyValue $true -Force
  foreach ($entry in @(@{Path=$pluginsPath;Value=$plugins}, @{Path=$dataPath;Value=$data})) {
    [pscustomobject]@{
      Path = $entry.Path
      Content = ($entry.Value | ConvertTo-Json -Depth 30) + [Environment]::NewLine
      Existed = (Test-Path -LiteralPath $entry.Path)
      Original = $(if (Test-Path -LiteralPath $entry.Path) { [IO.File]::ReadAllBytes($entry.Path) } else { $null })
    }
  }
}

function Save-AutoCapsConfigBackup($Plans, [string]$BackupRoot) {
  $existing = @($Plans | Where-Object Existed)
  if (!$existing.Count) { return }
  $folder = Join-Path $BackupRoot ('config-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6))
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  foreach ($plan in $existing) { [IO.File]::WriteAllBytes((Join-Path $folder (Split-Path $plan.Path -Leaf)), [byte[]]$plan.Original) }
  Write-Host "Configuration backup: $folder"
}

function Restore-AutoCapsConfigPlans($Plans) {
  foreach ($plan in $Plans) {
    if ($plan.Existed) { [IO.File]::WriteAllBytes($plan.Path, [byte[]]$plan.Original) }
    elseif (Test-Path -LiteralPath $plan.Path) { Remove-Item -LiteralPath $plan.Path -Force }
  }
}
