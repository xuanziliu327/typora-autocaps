import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function checkDirectory(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const name = `${dir}/${file.name}`;
    if (file.isDirectory()) { await checkDirectory(name); continue; }
    if (!/\.m?js$/.test(file.name)) continue;
    const result = spawnSync(process.execPath, ['--check', name], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
for (const dir of ['src', 'scripts', 'test', 'tools']) await checkDirectory(dir);
for (const dir of ['.', 'installer']) {
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.cmd')) continue;
    const contents = await readFile(`${dir}/${file}`, 'utf8');
    if (contents.startsWith('\ufeff') || /(?<!\r)\n/u.test(contents)) throw new Error(`${dir}/${file}: Windows launchers require UTF-8 without BOM and CRLF line endings`);
  }
}
if (process.platform === 'win32') {
  const command = `$ErrorActionPreference='Stop'; Get-ChildItem scripts,installer,test -Recurse -Filter '*.ps1' | ForEach-Object { $t=$null; $e=$null; $null=[System.Management.Automation.Language.Parser]::ParseFile($_.FullName,[ref]$t,[ref]$e); if($e.Count){ $e | ForEach-Object { Write-Error $_ }; exit 1 } }`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== pkg.version) throw new Error('Version mismatch');
console.log('JavaScript/PowerShell syntax and manifest version checks passed (PowerShell checked on Windows).');
