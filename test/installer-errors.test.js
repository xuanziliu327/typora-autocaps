import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const windows = process.platform === 'win32';
const quote = value => `'${value.replaceAll("'", "''")}'`;
const script = path.resolve('installer/Manage.ps1');
async function fixture() {
  await mkdir('.test-output', { recursive: true });
  return mkdtemp(path.resolve('.test-output/installer-error-'));
}
function run(dir, processStub = 'return @()', args = '') {
  const command = `function Get-Process { ${processStub} }; & ${quote(script)} -Action Install -FrameworkPath ${quote(dir)} ${args}`;
  return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8' });
}
test('installer refuses running Typora before modifying files', { skip: !windows }, async () => {
  const dir = await fixture();
  const result = run(dir, 'return [pscustomobject]@{Name="Typora"}');
  assert.equal(result.status, 1); assert.match(result.stdout, /Close all Typora/);
  await assert.rejects(stat(path.join(dir, 'plugins')));
});
test('installer rejects a missing framework and invalid destination identity', { skip: !windows }, async () => {
  const dir = await fixture();
  let result = run(dir); assert.equal(result.status, 1); assert.match(result.stdout, /loader.js not found/);
  await writeFile(path.join(dir, 'loader.js'), '// fixture');
  const target = path.join(dir, 'plugins', 'typora-autocaps'); await mkdir(target, { recursive: true });
  await writeFile(path.join(target, 'manifest.json'), '{"id":"unrelated"}');
  await writeFile(path.join(target, 'main.js'), '// preserve');
  // Identity validation occurs after package validation; build only if needed.
  // The plugin contract test may build concurrently, producing identical bytes.
  const build = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8' }); assert.equal(build.status, 0);
  result = run(dir); assert.equal(result.status, 1); assert.match(result.stdout, /not an AutoCaps/);
  assert.equal(await readFile(path.join(target, 'main.js'), 'utf8'), '// preserve');
});
