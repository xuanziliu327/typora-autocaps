// Development-only integration tests. Never include this plugin in a release ZIP.
const { Plugin } = window[Symbol.for('typora-plugin-core@v2')];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export default class NativeProbe extends Plugin {
  onload() {
    this.fs = window.reqnode('fs');
    this.profile = window._options.userDataPath;
    // The preparation script creates this marker only in a new test profile.
    if (!this.fs.existsSync(`${this.profile}/AUTOCAPS_TEST_PROFILE`)) {
      throw new Error('Native probe requires an isolated, marked test profile.');
    }
    setTimeout(() => this.run().catch(error => this.save({
      error: String(error), stack: error.stack,
    })), 1000);
  }

  save(report) {
    this.fs.writeFileSync(`${this.profile}/native-report.json`, JSON.stringify(report, null, 2));
  }

  async run() {
    const root = document.querySelector('#write');
    const editor = window.File.editor;
    const plugin = this.app.plugins.instances['typora-autocaps'];
    const status = () => [...document.querySelectorAll('footer .footer-item')]
      .find(el => el.textContent.includes('AutoCaps:'))?.textContent;
    const report = {
      method: 'Synthetic beforeinput + Chromium execCommand for unhandled characters; real Typora DOM/insertion/undo/framework/storage. No physical keyboard or IME acceptance.',
      typora: '1.14.x target; record exact installed version separately',
      core: this.app.coreVersion,
      initialStatus: status(),
      initialPreference: plugin.settings.get('enabled'),
      cases: [],
    };
    this.save(report);
    plugin.settings.set('enabled', true);
    // Enable rendering only in this disposable profile's in-memory options.
    window.File.option.enableInlineMath = true;
    window._options.enableInlineMath = true;

    async function reset(markdown = '') {
      window.File.reloadContent(markdown, false, true, false, true);
      await delay(80);
      root.focus();
      editor.selection.jumpIntoElemEnd(window.$(root).children().last());
    }
    function beforeInput(target = root) {
      const range = window.getSelection().getRangeAt(0);
      const targetRange = new StaticRange({
        startContainer: range.startContainer, startOffset: range.startOffset,
        endContainer: range.endContainer, endOffset: range.endOffset,
      });
      const event = new InputEvent('beforeinput', {
        bubbles: true, cancelable: true, data: 'i', inputType: 'insertText',
      });
      Object.defineProperty(event, 'getTargetRanges', { value: () => [targetRange] });
      target.dispatchEvent(event);
      return event;
    }
    async function type(text) {
      for (const character of text) {
        const range = window.getSelection().getRangeAt(0);
        const target = new StaticRange({
          startContainer: range.startContainer, startOffset: range.startOffset,
          endContainer: range.endContainer, endOffset: range.endOffset,
        });
        const event = new InputEvent('beforeinput', {
          bubbles: true, cancelable: true, data: character, inputType: 'insertText',
        });
        Object.defineProperty(event, 'getTargetRanges', { value: () => [target] });
        root.dispatchEvent(event);
        if (!event.defaultPrevented) document.execCommand('insertText', false, character);
        await delay(15); // Deliberately permit native Markdown redraws between chars.
      }
    }
    function caretAtEnd(node) {
      const range = document.createRange();
      range.selectNodeContents(node); range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
    }
    for (const [input, expected] of [
      ['hello. how are you?', 'Hello. How are you?'],
      ['are you okay? i am fine! that is good.', 'Are you okay? I am fine! That is good.'],
      ['iPhone iPad and i am inside.', 'iPhone iPad and I am inside.'],
      ["today i feel happy. i'm ready.", "Today I feel happy. I'm ready."],
      ['https://example.com/i hello@example.com', 'https://example.com/i hello@example.com'],
      ['i think $f(x)=ax+b$ is interesting. it is linear.', 'I think $f(x)=ax+b$ is interesting. It is linear.'],
    ]) {
      await reset(); await type(input); await delay(100);
      const actual = editor.getMarkdown().trim();
      report.cases.push({ input, expected, actual, pass: actual === expected, status: status() });
      this.save(report);
    }

    await reset(); await type('hello. iPhone and i am fine?'); await delay(100);
    editor.undo.endSnap(true);
    const beforeUndo = editor.getMarkdown().trim();
    let undoCount = 0;
    while (editor.getMarkdown().trim() && undoCount < 50) {
      editor.undo.undo(); undoCount++; await delay(10);
    }
    const afterUndo = editor.getMarkdown().trim();
    for (let i = 0; i < undoCount; i++) { editor.undo.redo(); await delay(10); }
    const afterRedo = editor.getMarkdown().trim();
    report.undo = { beforeUndo, afterUndo, afterRedo, undoCount, pass: !afterUndo && afterRedo === beforeUndo };

    await reset('i think the function $f(x)=ax+b$ is interesting. ');
    await type('it is linear.'); await delay(100);
    report.mixed = {
      actual: editor.getMarkdown().trim(),
      pass: editor.getMarkdown().trim() === 'i think the function $f(x)=ax+b$ is interesting. It is linear.',
    };
    const math = root.querySelector('.md-inline-math script');
    report.math = { pass: false, reason: 'No rendered inline math script found' };
    if (math) {
      caretAtEnd(math);
      report.math = { source: math.textContent, pass: !beforeInput().defaultPrevented && math.textContent === 'f(x)=ax+b' };
    }
    await reset('$$\ni + f(x)=ax+b\n$$');
    report.blockMath = {
      actual: editor.getMarkdown().trim(),
      hasProtectedDOM: !!root.querySelector('.md-math-block .CodeMirror'),
      pass: editor.getMarkdown().trim() === '$$\ni + f(x)=ax+b\n$$',
    };
    await reset('`const i = f(x)`');
    const code = root.querySelector('code');
    report.code = { pass: false };
    if (code) {
      caretAtEnd(code);
      report.code = { source: code.textContent, pass: !beforeInput().defaultPrevented && code.textContent === 'const i = f(x)' };
    }
    await reset(); editor.sourceView.show(); await delay(100);
    report.sourceMode = { active: editor.sourceView.inSourceMode, pass: editor.sourceView.inSourceMode && !beforeInput().defaultPrevented };
    editor.sourceView.hide(); await delay(100);

    plugin.settings.set('enabled', false);
    await reset(); await type('hello i');
    report.disabled = { actual: editor.getMarkdown().trim(), status: status(), pass: editor.getMarkdown().trim() === 'hello i' };
    await delay(1400);
    report.persistedSettings = JSON.parse(this.fs.readFileSync(plugin.dataPath, 'utf8'));
    report.done = true;
    report.pass = report.cases.every(c => c.pass)
      && ['undo', 'mixed', 'math', 'blockMath', 'code', 'sourceMode', 'disabled'].every(key => report[key].pass)
      && report.persistedSettings.settings.enabled === false;
    this.save(report);
  }
}
