[CmdletBinding()]
param(
  [ValidateSet('Framework', 'Plugin', 'RestoreFramework')][string]$Action = 'Framework',
  [string]$TyporaPath,
  [string]$UserDataPath,
  [string]$FrameworkZip,
  [switch]$NonInteractive,
  [switch]$NoElevation,
  [string]$ResultLog
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$messages = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'messages.zh-CN.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$pin = Read-AutoCapsJson (Join-Path $PSScriptRoot 'framework.json') $null
$loaderPattern = '(?is)<script\b[^>]*\bsrc\s*=\s*["'']typora://(?:app/)?userData/plugins/loader\.js["''][^>]*>\s*</script>'

function Say([string]$Message) {
  Write-Host $Message
  if ($ResultLog) { [IO.File]::AppendAllText($ResultLog, $Message + [Environment]::NewLine, [Text.UTF8Encoding]::new($false)) }
}
function Normalize-SetupPath([string]$Path) {
  return [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($Path.Trim().Trim('"').Trim("'"))).TrimEnd('\', '/')
}
function Find-TyporaHome([string]$Explicit, [string]$Hint) {
  if (!$Explicit -and $Hint) {
    $remembered = Normalize-SetupPath $Hint
    if ((Test-Path -LiteralPath (Join-Path $remembered 'Typora.exe')) -and (Test-Path -LiteralPath (Join-Path $remembered 'resources\window.html'))) { return $remembered }
  }
  $candidates = [Collections.Generic.List[string]]::new()
  if ($Explicit) { $candidates.Add($Explicit) }
  else {
    if ($Hint) { $candidates.Add($Hint) }
    Get-Process -Name Typora -ErrorAction SilentlyContinue | ForEach-Object { if ($_.Path) { $candidates.Add($_.Path) } }
    $command = Get-Command Typora.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates.Add($command.Source) }
    foreach ($key in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\Typora.exe', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\Typora.exe')) {
      if (Test-Path $key) { $exe = (Get-ItemProperty $key -ErrorAction SilentlyContinue).'(default)'; if ($exe) { $candidates.Add($exe) } }
    }
    foreach ($key in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')) {
      if (!(Test-Path $key)) { continue }
      Get-ChildItem $key -ErrorAction SilentlyContinue | ForEach-Object {
        $entry = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
        if ($entry.DisplayName -like '*Typora*') {
          if ($entry.InstallLocation) { $candidates.Add($entry.InstallLocation) }
          if ($entry.DisplayIcon -match '^"?(.+?Typora\.exe)') { $candidates.Add($Matches[1]) }
        }
      }
    }
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) { if ($base) { $candidates.Add((Join-Path $base 'Typora')) } }
    $candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\Typora'))
    $candidates.Add((Join-Path $env:USERPROFILE 'scoop\apps\typora\current'))
  }
  $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $valid = @($candidates | ForEach-Object {
    $value = Normalize-SetupPath $_
    if ([IO.Path]::GetFileName($value) -ieq 'Typora.exe') { $value = Split-Path $value -Parent }
    if ((Test-Path -LiteralPath (Join-Path $value 'Typora.exe')) -and (Test-Path -LiteralPath (Join-Path $value 'resources\window.html')) -and $seen.Add($value)) { $value }
  })
  if ($valid.Count -eq 1) { return $valid[0] }
  if ($NonInteractive) { throw 'Cannot select a unique Typora installation. Supply -TyporaPath explicitly.' }
  if ($valid.Count -gt 1) {
    for ($i = 0; $i -lt $valid.Count; $i++) { Say ("{0}. {1}" -f ($i + 1), $valid[$i]) }
    $index = 0
    if ([int]::TryParse((Read-Host $messages.choose), [ref]$index) -and $index -ge 1 -and $index -le $valid.Count) { return $valid[$index - 1] }
    throw 'Invalid installation number.'
  }
  $selected = Read-Host $messages.notFound
  if (!$selected) { throw 'Cancelled. No installation files changed.' }
  return Find-TyporaHome $selected ''
}
function Wait-ForTyporaClosed {
  while (Get-Process -Name Typora -ErrorAction SilentlyContinue) {
    if ($NonInteractive) { throw 'Close all Typora windows before installation.' }
    Say $messages.closeTypora
    $null = Read-Host
  }
}
function Test-CompatibleFramework([string]$Root) {
  if (!(Test-Path -LiteralPath (Join-Path $Root 'loader.js'))) { return $false }
  $config = Read-AutoCapsJson (Join-Path $Root 'loader.json') ([pscustomobject]@{})
  $version = $null
  if (![version]::TryParse([string]$config.coreVersion, [ref]$version) -or $version -lt [version]$pin.version) { return $false }
  return (Test-Path -LiteralPath (Join-Path $Root "$($config.coreVersion)\core.js")) -and (Test-Path -LiteralPath (Join-Path $Root "$($config.coreVersion)\core.css"))
}
function Assert-SetupTarget([string]$Path, [string]$Root) {
  $absolute = Normalize-SetupPath $Path
  $base = Normalize-SetupPath $Root
  if (!$absolute.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Unexpected deployment target: $Path" }
  for ($current = $absolute; $current -ne $base; $current = Split-Path $current -Parent) {
    if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Linked deployment target: $current" }
  }
}
function New-SetupChange([string]$Path, [byte[]]$Bytes) {
  [pscustomobject]@{Path=$Path;Bytes=$Bytes;Existed=(Test-Path -LiteralPath $Path);Original=$(if (Test-Path -LiteralPath $Path) { [IO.File]::ReadAllBytes($Path) } else { $null })}
}
function Get-FrameworkStage([string]$Archive, [string]$Root) {
  $cache = Join-Path $Root 'autocaps-install-cache'
  New-Item -ItemType Directory -Path $cache -Force | Out-Null
  if (!$Archive) {
    $offline = Join-Path (Split-Path $PSScriptRoot -Parent) 'typora-community-plugin.zip'
    if (Test-Path -LiteralPath $offline) { $Archive = $offline }
    else {
      $Archive = Join-Path $cache "typora-community-plugin-$($pin.version).zip"
      if (!(Test-Path -LiteralPath $Archive) -or (Get-AutoCapsSha256 $Archive) -ne $pin.sha256) {
        Say ($messages.download + [Environment]::NewLine + $pin.archiveUrl)
        try {
          [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
          Invoke-WebRequest -Uri $pin.archiveUrl -OutFile $Archive -UseBasicParsing -TimeoutSec 120
        } catch { Say $messages.offline; throw }
      }
    }
  }
  $Archive = Normalize-SetupPath $Archive
  if ((Get-AutoCapsSha256 $Archive) -ne $pin.sha256) { throw 'Framework ZIP SHA-256 mismatch. Use the pinned official release; no files were installed.' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $stage = Join-Path $cache ('stage-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $stage | Out-Null
  $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
  try {
    foreach ($entry in $zip.Entries) {
      $name = $entry.FullName.Replace('\', '/')
      if ($name -match '(^/|(^|/)\.\.(/|$)|:)' -or (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'Unsafe framework ZIP entry.' }
      if ($name -notmatch ('^(loader\.js|loader\.json|' + [regex]::Escape($pin.version) + '/(core\.js|core\.css|locales/[^/]+\.json))$')) { continue }
      if ($entry.Length -gt 10MB) { throw 'Unexpected framework file size.' }
      $dest = Join-Path $stage $name
      Assert-SetupTarget $dest $stage
      New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
      $inputStream = $entry.Open(); $outputStream = [IO.File]::Create($dest)
      try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose(); $outputStream.Dispose() }
    }
  } finally { $zip.Dispose() }
  $config = Read-AutoCapsJson (Join-Path $stage 'loader.json') $null
  if ($config.coreVersion -ne $pin.version -or !(Test-CompatibleFramework $stage)) { throw 'Incomplete framework payload.' }
  return $stage
}
function Start-ElevatedSetup([string]$InstallHome, [string]$DataDirectory) {
  if ($NonInteractive -or $NoElevation) { throw 'No write permission for Typora window.html. Run entry 1 as administrator.' }
  Say $messages.admin
  $log = Join-Path $DataDirectory ('autocaps-setup-' + [guid]::NewGuid().ToString('N') + '.log')
  function Quote-Setup([string]$Value) { return "'" + $Value.Replace("'", "''") + "'" }
  $command = '& ' + (Quote-Setup (Join-Path $PSScriptRoot 'Setup.ps1')) + ' -Action Framework -TyporaPath ' + (Quote-Setup $InstallHome) + ' -UserDataPath ' + (Quote-Setup $DataDirectory) + ' -NonInteractive -NoElevation -ResultLog ' + (Quote-Setup $log)
  if ($FrameworkZip) { $command += ' -FrameworkZip ' + (Quote-Setup (Normalize-SetupPath $FrameworkZip)) }
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
  $process = Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded) -Verb RunAs -WindowStyle Hidden -Wait -PassThru
  if (Test-Path -LiteralPath $log) { Say ([IO.File]::ReadAllText($log, [Text.Encoding]::UTF8)) }
  return $process.ExitCode
}

try {
  if (!$UserDataPath) { $UserDataPath = Join-Path $env:APPDATA 'Typora' }
  $UserDataPath = Normalize-SetupPath $UserDataPath
  $statePath = Join-Path $UserDataPath 'autocaps-installer.json'
  $state = Read-AutoCapsJson $statePath ([pscustomobject]@{tool='Typora AutoCaps'})
  if ($state.tool -ne 'Typora AutoCaps') { throw 'Unknown installer state file; not overwriting.' }
  $homePath = Find-TyporaHome $TyporaPath $state.typoraHome
  Say ($messages.detected + $homePath)
  Wait-ForTyporaClosed
  $htmlPath = Join-Path $homePath 'resources\window.html'
  $html = [IO.File]::ReadAllText($htmlPath, [Text.Encoding]::UTF8)
  $framework = Join-Path $UserDataPath 'plugins'
  if ($Action -eq 'RestoreFramework') {
    if (!$state.htmlBackup -or !(Test-Path -LiteralPath $state.htmlBackup)) { throw 'No AutoCaps framework HTML backup found.' }
    if ((Get-AutoCapsSha256 $htmlPath) -ne $state.htmlInstalledHash) { throw 'Typora HTML changed since installation. Refusing to restore an older file.' }
    [IO.File]::WriteAllBytes($htmlPath, [IO.File]::ReadAllBytes($state.htmlBackup))
    Say 'Original window.html restored. Framework data remains in the Typora user-data directory.'
    exit 0
  }
  if ($Action -eq 'Plugin') {
    if (!(Test-CompatibleFramework $framework) -or $html -notmatch $loaderPattern) { throw $messages.needFramework }
    & (Join-Path $PSScriptRoot 'Manage.ps1') -Action Install -FrameworkPath $framework -AutoEnable
    if ($LASTEXITCODE -ne 0) { throw 'AutoCaps installation failed; see the preceding error. Startup was not enabled.' }
    Say $messages.pluginReady
    Say $messages.extraction
    exit 0
  }
  if ($html -match '(?is)<script\b[^>]*src\s*=\s*["''][^"'']*plugin/index\.js') { throw 'Another Typora injection framework is installed. Remove that framework before installing Community Plugin.' }
  $needsHook = $html -notmatch $loaderPattern
  if ($needsHook) {
    if ($html -notmatch '(?is)</body>\s*</html>\s*$') { throw 'Unknown window.html format. No injection was written.' }
    try { $stream = [IO.File]::Open($htmlPath, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::Read); $stream.Dispose() }
    catch [UnauthorizedAccessException] {
      New-Item -ItemType Directory -Path $UserDataPath -Force | Out-Null
      $code = Start-ElevatedSetup $homePath $UserDataPath
      exit $code
    }
  }
  $compatible = Test-CompatibleFramework $framework
  $changes = [Collections.Generic.List[object]]::new()
  if (!$compatible) {
    $stage = Get-FrameworkStage $FrameworkZip $UserDataPath
    foreach ($file in Get-ChildItem -LiteralPath $stage -File -Recurse) {
      $relative = $file.FullName.Substring($stage.Length + 1)
      $target = Join-Path $framework $relative
      Assert-SetupTarget $target $framework
      $bytes = [IO.File]::ReadAllBytes($file.FullName)
      if ($relative -eq 'loader.json') {
        $loaderConfig = Read-AutoCapsJson $target ([pscustomobject]@{debug=$false})
        $loaderConfig | Add-Member -NotePropertyName coreVersion -NotePropertyValue $pin.version -Force
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($loaderConfig | ConvertTo-Json -Depth 30))
      }
      $changes.Add((New-SetupChange $target $bytes))
    }
  } else { Say $messages.alreadyInstalled }
  New-Item -ItemType Directory -Path $UserDataPath -Force | Out-Null
  $backup = Join-Path $UserDataPath ('autocaps-framework-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6))
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  $htmlBackup = $state.htmlBackup
  if ($needsHook) {
    $htmlBackup = Join-Path $backup 'window.html'
    [IO.File]::WriteAllBytes($htmlBackup, [IO.File]::ReadAllBytes($htmlPath))
    $updatedHtml = [regex]::Replace($html, '(?is)(</body>\s*</html>\s*)$', '<script src="typora://app/userData/plugins/loader.js" type="module"></script>$1')
    $changes.Add((New-SetupChange $htmlPath ([Text.UTF8Encoding]::new($false).GetBytes($updatedHtml))))
  }
  $newState = [pscustomobject]@{tool='Typora AutoCaps';typoraHome=$homePath;frameworkPath=$framework;htmlBackup=$htmlBackup;htmlInstalledHash='';frameworkVersion=$(if ($compatible) { (Read-AutoCapsJson (Join-Path $framework 'loader.json') $null).coreVersion } else { $pin.version })}
  $applied = [Collections.Generic.List[object]]::new()
  $backupIndex = [Collections.Generic.List[object]]::new()
  try {
    $number = 0
    foreach ($change in $changes) {
      if ($change.Existed) {
        $backupFile = "file-{0}.bak" -f $number
        [IO.File]::WriteAllBytes((Join-Path $backup $backupFile), [byte[]]$change.Original)
        $backupIndex.Add([pscustomobject]@{originalPath=$change.Path;backupFile=$backupFile})
      }
      New-Item -ItemType Directory -Path (Split-Path $change.Path -Parent) -Force | Out-Null
      $applied.Add($change)
      [IO.File]::WriteAllBytes($change.Path, [byte[]]$change.Bytes)
      $number++
    }
    Write-AutoCapsText (Join-Path $backup 'backup-index.json') (ConvertTo-Json -InputObject @($backupIndex.ToArray()) -Depth 10)
    $newState.htmlInstalledHash = Get-AutoCapsSha256 $htmlPath
    Write-AutoCapsText $statePath (($newState | ConvertTo-Json -Depth 10) + [Environment]::NewLine)
  } catch {
    for ($i = $applied.Count - 1; $i -ge 0; $i--) {
      $change = $applied[$i]
      if ($change.Existed) { [IO.File]::WriteAllBytes($change.Path, [byte[]]$change.Original) }
      elseif (Test-Path -LiteralPath $change.Path) { Remove-Item -LiteralPath $change.Path -Force }
    }
    throw
  }
  Say ($messages.backup + $backup)
  Say $messages.frameworkReady
  Say $messages.restartAfterUpdate
} catch {
  Say ($messages.failed + $_.Exception.Message)
  exit 1
}
exit 0
