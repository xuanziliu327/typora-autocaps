import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, stat, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const windows = process.platform === 'win32';
const quote = text => `'${text.replaceAll("'", "''")}'`;
function ps(command) {
  return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
    `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); ${command}`], { encoding: 'utf8' });
}
async function fixture() {
  await mkdir('.test-output', { recursive: true });
  const dir = await mkdtemp(path.resolve('.test-output/two-entry-'));
  const pkg = path.join(dir, 'release package');
  const home = path.join(dir, 'custom Typora');
  const profile = path.join(dir, 'user profile');
  await cp('installer', path.join(pkg, 'installer'), { recursive: true });
  const build = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  await cp('dist/main.js', path.join(pkg, 'main.js'));
  await cp('manifest.json', path.join(pkg, 'manifest.json'));
  await mkdir(path.join(home, 'resources'), { recursive: true });
  await writeFile(path.join(home, 'Typora.exe'), '// fixture, never executed');
  const html = '<!doctype html><html><body>你好 — original Typora\n</body></html>\n';
  await writeFile(path.join(home, 'resources/window.html'), html);
  const payload = path.join(dir, 'framework-payload');
  await mkdir(path.join(payload, '2.10.86/locales'), { recursive: true });
  await writeFile(path.join(payload, 'loader.js'), '// mock framework loader');
  await writeFile(path.join(payload, 'loader.json'), '{"coreVersion":"2.10.86","debug":false}');
  await writeFile(path.join(payload, '2.10.86/core.js'), '// mock core');
  await writeFile(path.join(payload, '2.10.86/core.css'), '/* mock css */');
  await writeFile(path.join(payload, '2.10.86/locales/lang.en.json'), '{}');
  const archive = path.join(dir, 'framework.zip');
  const packed = ps(`Compress-Archive -Path ${quote(payload + '/*')} -DestinationPath ${quote(archive)}`);
  assert.equal(packed.status, 0, packed.stderr);
  const hash = createHash('sha256').update(await readFile(archive)).digest('hex');
  // Isolated installer copy trusts only the fake test archive; production pin is unchanged.
  await writeFile(path.join(pkg, 'installer/framework.json'), JSON.stringify({ version: '2.10.86', archiveUrl: 'https://example.invalid/not-used', sha256: hash }));
  const framework = path.join(profile, 'plugins');
  const htmlPath = path.join(home, 'resources/window.html');
  function run(action, extra = '', running = false) {
    return ps(`function Get-Process { ${running ? 'return [pscustomobject]@{Name="Typora"}' : 'return @()'} }; & ${quote(path.join(pkg, 'installer/Setup.ps1'))} -Action ${action} -TyporaPath ${quote(home)} -UserDataPath ${quote(profile)} -FrameworkZip ${quote(archive)} -NonInteractive -NoElevation ${extra}`);
  }
  return { dir, pkg, home, profile, framework, htmlPath, html, archive, run };
}
test('entry 1 installs the host/hook; entry 2 enables automatic startup without UI settings', { skip: !windows }, async () => {
  const f = await fixture();
  let result = f.run('Framework'); assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal((await readFile(f.htmlPath, 'utf8')).match(/userData\/plugins\/loader\.js/g).length, 1);
  const state = JSON.parse(await readFile(path.join(f.profile, 'autocaps-installer.json'), 'utf8'));
  assert.equal(await readFile(state.htmlBackup, 'utf8'), f.html);
  assert.equal(state.nativeAppearance, true);
  const appearance = JSON.parse(await readFile(path.join(f.framework, 'settings/core.json'), 'utf8'));
  assert.equal(appearance.settings.showRibbon, false);
  assert.equal(appearance.settings['internalPlugin.enabledPlugins']['internal.workspace'], false);
  await assert.rejects(stat(path.join(f.framework, 'install-windows.ps1'))); // downloaded installer is never deployed/run
  result = f.run('Plugin'); assert.equal(result.status, 0, result.stdout + result.stderr);
  const enabled = JSON.parse(await readFile(path.join(f.framework, 'settings/plugins.json'), 'utf8'));
  assert.equal(enabled['typora-autocaps'], true);
  const preferences = JSON.parse(await readFile(path.join(f.framework, 'settings/data/typora-autocaps.json'), 'utf8'));
  assert.equal(preferences.settings.enabled, true);
  assert.equal(await readFile(path.join(f.framework, 'plugins/typora-autocaps/main.js'), 'utf8'), await readFile(path.join(f.pkg, 'main.js'), 'utf8'));
});
test('repeat framework setup keeps one hook and preserves framework configuration', { skip: !windows }, async () => {
  const f = await fixture();
  let result = f.run('Framework'); assert.equal(result.status, 0, result.stdout + result.stderr);
  const loaderPath = path.join(f.framework, 'loader.json');
  await writeFile(loaderPath, '{"coreVersion":"2.10.86","debug":true,"custom":"keep"}');
  const before = await readFile(f.htmlPath, 'utf8');
  await writeFile(f.archive, 'archive no longer available: compatible host must skip download');
  result = f.run('Framework'); assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(await readFile(f.htmlPath, 'utf8'), before);
  assert.equal(JSON.parse(await readFile(loaderPath, 'utf8')).custom, 'keep');
});
test('automatic activation merges shared config and preserves independent feature choices', { skip: !windows }, async () => {
  const f = await fixture();
  assert.equal(f.run('Framework').status, 0);
  await mkdir(path.join(f.framework, 'settings/data'), { recursive: true });
  await writeFile(path.join(f.framework, 'settings/plugins.json'), '{"other-plugin":true,"another":false}');
  await writeFile(path.join(f.framework, 'settings/data/typora-autocaps.json'), '{"version":1,"settings":{"enabled":false,"sentence":false,"pronoun":true,"custom":"保留"}}');
  const result = f.run('Plugin'); assert.equal(result.status, 0, result.stdout + result.stderr);
  const shared = JSON.parse(await readFile(path.join(f.framework, 'settings/plugins.json'), 'utf8'));
  assert.deepEqual(shared, { 'other-plugin': true, another: false, 'typora-autocaps': true });
  const preferences = JSON.parse(await readFile(path.join(f.framework, 'settings/data/typora-autocaps.json'), 'utf8'));
  assert.deepEqual(preferences.settings, { enabled: true, sentence: false, pronoun: true, custom: '保留' });
});
test('corrupt activation config is rejected before copying plugin files', { skip: !windows }, async () => {
  const f = await fixture(); assert.equal(f.run('Framework').status, 0);
  await mkdir(path.join(f.framework, 'settings'), { recursive: true });
  await writeFile(path.join(f.framework, 'settings/plugins.json'), 'not json');
  assert.equal(f.run('Plugin').status, 1);
  await assert.rejects(stat(path.join(f.framework, 'plugins/typora-autocaps/main.js')));
  assert.equal(await readFile(path.join(f.framework, 'settings/plugins.json'), 'utf8'), 'not json');
});
test('upgrading an AutoCaps 0.1.1 setup restores native layout and backs up unrelated preferences', { skip: !windows }, async () => {
  const f = await fixture(); assert.equal(f.run('Framework').status, 0);
  const statePath = path.join(f.profile, 'autocaps-installer.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  delete state.nativeAppearance; // state written by the original two-entry installer
  await writeFile(statePath, JSON.stringify(state));
  const corePath = path.join(f.framework, 'settings/core.json');
  const original = JSON.stringify({ version: 2, custom: '保留', settings: {
    showRibbon: true, keepSearchResult: true, ribbonState: { 'core.outline': { visible: true } },
    'internalPlugin.enabledPlugins': { 'internal.workspace': true, 'internal.metadata': true, 'future.plugin': true },
  } });
  await writeFile(corePath, original);
  const result = f.run('Plugin'); assert.equal(result.status, 0, result.stdout + result.stderr);
  const after = JSON.parse(await readFile(corePath, 'utf8'));
  const expected = JSON.parse(original);
  expected.settings.showRibbon = false;
  expected.settings['internalPlugin.enabledPlugins']['internal.workspace'] = false;
  assert.deepEqual(after, expected);
  const backupRoot = path.join(f.framework, 'autocaps-backups');
  const folder = (await readdir(backupRoot)).find(name => name.startsWith('config-'));
  assert.equal(await readFile(path.join(backupRoot, folder, 'core.json'), 'utf8'), original);
});
test('an independently installed framework keeps its existing layout preferences', { skip: !windows }, async () => {
  const f = await fixture(); assert.equal(f.run('Framework').status, 0);
  await rm(path.join(f.profile, 'autocaps-installer.json'));
  const corePath = path.join(f.framework, 'settings/core.json');
  const existing = '{"version":2,"settings":{"showRibbon":true,"internalPlugin.enabledPlugins":{"internal.workspace":true}}}';
  await writeFile(corePath, existing);
  assert.equal(f.run('Framework').status, 0);
  const state = JSON.parse(await readFile(path.join(f.profile, 'autocaps-installer.json'), 'utf8'));
  assert.equal(state.nativeAppearance, false);
  assert.equal(f.run('Plugin').status, 0);
  assert.equal(await readFile(corePath, 'utf8'), existing);
});
for (const invalid of ['broken json', '{"version":2,"settings":{"internalPlugin.enabledPlugins":[]}}']) {
  test(`invalid host appearance preferences are rejected before plugin copy: ${invalid}`, { skip: !windows }, async () => {
    const f = await fixture(); assert.equal(f.run('Framework').status, 0);
    const corePath = path.join(f.framework, 'settings/core.json');
    await writeFile(corePath, invalid);
    const result = f.run('Plugin'); assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(await readFile(corePath, 'utf8'), invalid);
    await assert.rejects(stat(path.join(f.framework, 'plugins/typora-autocaps/main.js')));
    await assert.rejects(stat(path.join(f.framework, 'settings/plugins.json')));
  });
}
test('bad archive hash leaves application HTML unchanged', { skip: !windows }, async () => {
  const f = await fixture(); await writeFile(f.archive, 'tampered');
  const result = f.run('Framework'); assert.equal(result.status, 1); assert.match(result.stdout, /SHA-256 mismatch/);
  assert.equal(await readFile(f.htmlPath, 'utf8'), f.html);
  await assert.rejects(stat(path.join(f.framework, 'loader.js')));
});
test('entry 2 requires the host hook, and setup never force-kills a running Typora', { skip: !windows }, async () => {
  const f = await fixture(); assert.equal(f.run('Plugin').status, 1);
  const result = f.run('Framework', '', true); assert.equal(result.status, 1); assert.match(result.stdout, /Close all Typora/);
  assert.equal(await readFile(f.htmlPath, 'utf8'), f.html);
});
test('framework HTML restoration uses its exact backup and rejects changed HTML', { skip: !windows }, async () => {
  const f = await fixture(); assert.equal(f.run('Framework').status, 0);
  let result = f.run('RestoreFramework'); assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(await readFile(f.htmlPath, 'utf8'), f.html);
  assert.equal(f.run('Framework').status, 0);
  await writeFile(f.htmlPath, '<html><body>New Typora version</body></html>');
  result = f.run('RestoreFramework'); assert.equal(result.status, 1); assert.match(result.stdout, /HTML changed/);
});
test('a protected application file reports elevation need without modifying it', { skip: !windows }, async () => {
  const f = await fixture();
  assert.equal(ps(`[IO.File]::SetAttributes(${quote(f.htmlPath)},[IO.FileAttributes]::ReadOnly)`).status, 0);
  try {
    const result = f.run('Framework');
    assert.equal(result.status, 1); assert.match(result.stdout, /administrator/);
    assert.equal(await readFile(f.htmlPath, 'utf8'), f.html);
    await assert.rejects(stat(path.join(f.framework, 'loader.js')));
  } finally { ps(`[IO.File]::SetAttributes(${quote(f.htmlPath)},[IO.FileAttributes]::Normal)`); }
});
test('an existing different injection framework is not overwritten', { skip: !windows }, async () => {
  const f = await fixture();
  const conflicting = '<html><body><script src="./plugin/index.js" defer="defer"></script></body></html>';
  await writeFile(f.htmlPath, conflicting);
  const result = f.run('Framework'); assert.equal(result.status, 1); assert.match(result.stdout, /Another Typora/);
  assert.equal(await readFile(f.htmlPath, 'utf8'), conflicting);
});
for (const [name, label] of [['1-安装框架.cmd', '安装插件框架'], ['2-安装AutoCaps.cmd', 'AutoCaps']]) {
  test(`root launcher runs from another directory and propagates failure: ${name}`, { skip: !windows }, async () => {
    const dir = await mkdtemp(path.resolve('.test-output/launcher-'));
    const entry = path.resolve(name);
    const profile = path.join(dir, 'profile');
    const command = `""${entry}" -NonInteractive -TyporaPath "${path.join(dir, 'missing-Typora')}" -UserDataPath "${profile}""`;
    const result = spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
      cwd: dir, input: '\r\n', encoding: 'utf8', windowsVerbatimArguments: true, timeout: 10000,
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.stdout.includes(label), result.stdout);
    assert.match(result.stdout, /Cannot select a unique Typora/);
    await assert.rejects(stat(profile));
  });
}
