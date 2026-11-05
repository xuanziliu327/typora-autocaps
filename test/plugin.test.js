import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { spawnSync } from 'node:child_process';

test('framework contract: settings, status, hotkey, persistence and unload', async () => {
  const dom = new JSDOM('<footer class="ty-footer"></footer><div id="write"><p></p></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  const saved = {};
  class Plugin {
    constructor(app, manifest) { this.app = app; this.manifest = manifest; this.cleanup = []; this.commands = []; }
    register(f) { this.cleanup.push(f); }
    registerDomEvent(el, name, cb) { el.addEventListener(name, cb); this.register(() => el.removeEventListener(name, cb)); }
    registerSettings(s) { this.settings = s; }
    registerSettingTab(t) { this.tab = t; }
    registerCommand(c) { this.commands.push(c); this.register(() => { this.commands = []; }); }
    registerMarkdownEvent() {}
    addStatusBarItem() { const el = document.createElement('div'); document.querySelector('footer').append(el); this.register(() => el.remove()); return el; }
    unload() { this.cleanup.forEach(fn => fn()); }
  }
  class PluginSettings {
    constructor() { this.defaults = {}; this.listeners = []; }
    setDefault(d) { this.defaults = d; }
    get(k) { return saved[k] ?? this.defaults[k]; }
    set(k,v) { saved[k]=v; this.listeners.forEach(f=>f()); }
    addChangeListener(k,fn) { this.listeners.push(fn); return () => { this.listeners=this.listeners.filter(f=>f!==fn); }; }
  }
  class SettingTab {}
  window[Symbol.for('typora-plugin-core@v2')] = { Plugin, PluginSettings, SettingTab };
  window.editor = { sourceView: { inSourceMode: false } };
  const build = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const { default: AutoCaps } = await import('../dist/main.js');
  const plugin = new AutoCaps({}, { id: 'typora-autocaps' }); plugin.onload();
  const button = document.querySelector('footer div');
  assert.equal(button.textContent, 'AutoCaps: ON');
  assert.equal(plugin.commands[0].hotkey, 'Ctrl+Alt+U');
  assert.equal(plugin.commands[0].scope, 'editor');
  button.click(); assert.equal(saved.enabled, false); assert.equal(button.textContent, 'AutoCaps: OFF');
  plugin.unload(); assert.equal(document.querySelector('footer div'), null); assert.equal(plugin.commands.length, 0);
  const restart = new AutoCaps({}, { id: 'typora-autocaps' }); restart.onload();
  assert.equal(document.querySelector('footer div').textContent, 'AutoCaps: OFF');
  assert.equal(restart.settings.get('sentence'), true); assert.equal(restart.settings.get('pronoun'), true);
  restart.unload(); delete globalThis.window; delete globalThis.document;
});
