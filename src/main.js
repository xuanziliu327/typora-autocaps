import { attachAutoCaps } from './adapter.js';

// Same runtime export used by the framework's official Rollup/esbuild adapters.
const core = window[Symbol.for('typora-plugin-core@v2')];
const { Plugin, PluginSettings, SettingTab } = core;

class AutoCapsSettings extends SettingTab {
  constructor(plugin) { super(); this.plugin = plugin; }
  get name() { return 'AutoCaps'; }
  onshow() {
    this.containerEl.innerHTML = '';
    for (const [key, label] of [
      ['enabled', 'AutoCaps 开关 / Enabled'],
      ['sentence', 'Sentence Capitalization / 句首大写'],
      ['pronoun', 'Pronoun I Capitalization / 代词 I 大写'],
    ]) {
      this.addSetting(row => {
        row.addName(label);
        row.addCheckbox({ settings: this.plugin.settings, bindingKey: key });
      });
    }
    this.addSetting(row => {
      row.addName('快捷键 / Shortcut');
      row.addDescription('Settings → Hotkeys → Typora AutoCaps: Toggle. Default: Ctrl+Alt+U');
    });
  }
}

export default class AutoCaps extends Plugin {
  onload() {
    const settings = new PluginSettings(this.app, this.manifest, { version: 1 });
    settings.setDefault({ enabled: true, sentence: true, pronoun: true });
    this.registerSettings(settings);
    this.registerSettingTab(new AutoCapsSettings(this));
    const status = this.addStatusBarItem({ position: 'left', type: 'item', hint: 'Toggle AutoCaps (Ctrl+Alt+U)' });
    status.setAttribute('role', 'button');
    status.tabIndex = 0;
    let failed = false, binding;
    const refresh = () => {
      status.textContent = `AutoCaps: ${failed ? 'PAUSED' : settings.get('enabled') ? 'ON' : 'OFF'}`;
      status.setAttribute('aria-pressed', String(!failed && settings.get('enabled')));
      binding?.reset();
    };
    const toggle = () => settings.set('enabled', !settings.get('enabled'));
    this.registerDomEvent(status, 'click', toggle);
    this.registerDomEvent(status, 'keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
    });
    this.registerCommand({ id: 'toggle', title: 'Toggle', scope: 'editor', hotkey: 'Ctrl+Alt+U', callback: toggle });
    this.register(settings.addChangeListener('*', refresh));
    refresh();
    const attach = root => {
      binding?.dispose();
      binding = attachAutoCaps({
        root, editor: window.File?.editor ?? window.editor,
        getSettings: () => ({ enabled: settings.get('enabled'), sentence: settings.get('sentence'), pronoun: settings.get('pronoun') }),
        onError: () => {
          failed = true;
          status.title = 'AutoCaps paused after an editor API error. Reload Typora; report the version, without private document text.';
          refresh();
          console.warn('[AutoCaps] Editor insertion failed; processing paused. Document text is not logged.');
        },
      });
    };
    const root = document.querySelector('#write');
    if (root) attach(root);
    this.registerMarkdownEvent('load', attach);
    this.register(() => binding?.dispose());
  }
}
