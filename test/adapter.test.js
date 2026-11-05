import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachAutoCaps } from '../src/adapter.js';
import { readContext } from '../src/context.js';

function fixture(html = '<p></p>') {
  const dom = new JSDOM(`<div id="write" contenteditable="true">${html}</div><input id="search">`);
  const { document: doc } = dom.window;
  const root = doc.querySelector('#write'), sel = dom.window.getSelection();
  const settings = { enabled: true, sentence: true, pronoun: true };
  const history = [], errors = [];
  function caret(node, offset = node.nodeType === 3 ? node.length : node.childNodes.length) {
    const r = doc.createRange(); r.setStart(node, offset); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
  }
  function insert(text) {
    const r = sel.getRangeAt(0); r.deleteContents();
    const n = doc.createTextNode(text); r.insertNode(n); caret(n);
    // Browser typing coalesces adjacent text; preserve caret after normalizing.
    const p = n.parentNode;
    let start = n, length = n.length;
    while (start.previousSibling?.nodeType === 3) { start = start.previousSibling; length += start.length; }
    // normalize() removes empty text nodes. Keep the first nonempty node,
    // including when Typora's pristine paragraph starts with an empty node.
    while (!start.length && start.nextSibling?.nodeType === 3) start = start.nextSibling;
    p.normalize(); caret(start, length);
  }
  const editor = { sourceView: { inSourceMode: false }, insertText(text) { history.push(root.innerHTML); insert(text); } };
  const adapter = attachAutoCaps({ root, editor, getSettings: () => settings, onError: e => errors.push(e) });
  root.focus(); caret(root.querySelector('p') ?? root.firstChild);
  function event(type, data, extras = {}) {
    const ev = new dom.window.InputEvent(type, { bubbles: true, cancelable: true, inputType: 'insertText', data, ...extras });
    (extras.target ?? root).dispatchEvent(ev); return ev;
  }
  function type(text) {
    for (const c of text) { const ev = event('beforeinput', c); if (!ev.defaultPrevented) insert(c); event('input', c); }
  }
  return { dom, doc, root, sel, settings, history, errors, editor, adapter, caret, event, type };
}
test('adapter inline period/question/exclamation and tentative word corrections', () => {
  const f = fixture(); f.type('hello. how? yes! iPhone and i am inside.');
  assert.equal(f.root.textContent, 'Hello. How? Yes! iPhone and I am inside.');
  assert.equal(f.errors.length, 0);
});
test('pristine first paragraph capitalizes immediately without a prior Enter or input event', () => {
  const f = fixture('<p cid="n0" mdtype="paragraph" contenteditable="true" class="md-end-block md-p md-focus"></p>');
  const empty = f.doc.createTextNode(''); f.root.firstChild.append(empty); f.caret(empty, 0);
  f.type('f'); assert.equal(f.root.textContent, 'F');
  f.type('antacy. dream? queue! i am here.');
  assert.equal(f.errors.length, 0, String(f.errors[0]?.stack));
  assert.equal(f.root.textContent, 'Fantacy. Dream? Queue! I am here.');
  assert.equal(f.errors.length, 0);
});
test('compact dotted text is protected; spaced sentences work in the same paragraph without Enter', () => {
  const f = fixture(); f.type('fantacy.derea.queue.');
  assert.equal(f.root.textContent, 'fantacy.derea.queue.');
  f.type(' fantasy. dream? queue! i am here.');
  assert.equal(f.errors.length, 0, String(f.errors[0]?.stack));
  assert.equal(f.root.textContent, 'fantacy.derea.queue. Fantasy. Dream? Queue! I am here.');
  assert.equal(f.root.children.length, 1);
  assert.equal(f.errors.length, 0);
});
const protectedMarkup = [
  '<code>i</code>', '<span class="md-inline-math"><span class="md-math-tex">i</span></span>',
  '<span md-inline="math">i</span>', '<span md-inline="code">i</span>',
  '<a href="x">i</a>', '<span md-inline="unknown">i</span>', '<span class="md-html">i</span>',
  '<span contenteditable="false">i</span>', '<span class="md-meta">i</span>',
];
for (const markup of protectedMarkup) test(`DOM protection: ${markup}`, () => {
  const f = fixture(`<p>${markup}</p>`);
  const n = f.root.querySelector('p').querySelectorAll('*');
  f.caret(n[n.length-1].firstChild, 0);
  assert.equal(f.event('beforeinput', 'i').defaultPrevented, false);
  assert.equal(f.history.length, 0);
});
for (const html of ['<pre class="md-fences">i</pre>', '<div class="md-math-block">i</div>', '<div class="md-rawblock">i</div>', '<div class="CodeMirror">i</div>']) test(`block protection: ${html}`, () => {
  const f = fixture(html); f.caret(f.root.firstChild.firstChild, 0);
  assert.equal(f.event('beforeinput', 'i').defaultPrevented, false);
});
test('mixed math remains opaque and prose after it works', () => {
  const f = fixture('<p>i think <span class="md-inline-math"><span class="md-math-tex">f(x)=ax+b</span></span> is linear. </p>');
  f.caret(f.root.firstChild.lastChild); f.type('it is.');
  assert.equal(f.root.querySelector('.md-math-tex').textContent, 'f(x)=ax+b');
  assert.ok(f.root.textContent.endsWith(' is linear. It is.'));
});
test('native insertion may promote earlier raw math into rendered DOM', () => {
  const f = fixture('<p cid="n1">I think $f(x)=ax+b$ </p>');
  f.caret(f.root.firstChild.firstChild);
  const insert = f.editor.insertText;
  let promoted = false;
  f.editor.insertText = text => {
    insert(text);
    if (!promoted) {
      const p = f.root.firstChild;
      p.innerHTML = p.innerHTML.replace('$f(x)=ax+b$', '<span class="md-inline-math"><script type="math/tex">f(x)=ax+b</script></span>');
      f.caret(p.lastChild); promoted = true;
    }
  };
  f.type('is interesting. it is linear.');
  assert.equal(f.errors.length, 0);
  assert.ok(f.root.textContent.endsWith(' is interesting. It is linear.'));
  assert.equal(f.root.querySelector('script').textContent, 'f(x)=ax+b');
});
test('new paragraph and list item have fresh context', () => {
  const f = fixture('<p>first</p><ul><li><p></p></li></ul>');
  f.caret(f.root.querySelector('li p')); f.type('second');
  assert.equal(f.root.querySelector('li').textContent, 'Second');
});
test('source mode, disabled toggle, unknown editor state fail closed', () => {
  const f = fixture();
  f.editor.sourceView.inSourceMode = true; assert.equal(f.event('beforeinput', 'i').defaultPrevented, false);
  delete f.editor.sourceView.inSourceMode; assert.equal(f.event('beforeinput', 'i').defaultPrevented, false);
  f.editor.sourceView.inSourceMode = false;
  f.settings.enabled = false; f.type('hello ');
  f.settings.enabled = true; f.type('i'); assert.equal(f.root.textContent, 'hello I');
});
test('composition and IME commits are untouched; English resumes', () => {
  const f = fixture();
  f.root.dispatchEvent(new f.dom.window.CompositionEvent('compositionstart', { bubbles: true }));
  assert.equal(f.event('beforeinput', 'i').defaultPrevented, false);
  f.root.dispatchEvent(new f.dom.window.CompositionEvent('compositionend', { bubbles: true }));
  assert.equal(f.event('beforeinput', 'i', { isComposing: true }).defaultPrevented, false);
  assert.equal(f.event('beforeinput', '中文', { inputType: 'insertCompositionText' }).defaultPrevented, false);
  f.type('hello'); assert.equal(f.root.textContent, 'Hello');
});
for (const inputType of ['historyUndo', 'historyRedo', 'deleteContentBackward', 'deleteContentForward', 'insertFromPaste', 'insertFromDrop', 'insertReplacementText', 'deleteByCut']) test(`native operation passes through: ${inputType}`, () => {
  const f = fixture(); f.type('i');
  assert.equal(f.event('beforeinput', 'a', { inputType }).defaultPrevented, false);
  assert.equal(f.history.length, 1);
});
test('selection replacement is untouched', () => {
  const f = fixture('<p>hello</p>'), r = f.doc.createRange(); r.selectNodeContents(f.root.firstChild); f.sel.removeAllRanges(); f.sel.addRange(r);
  assert.equal(f.event('beforeinput', 'i').defaultPrevented, false);
});
test('cursor movement invalidates tentative state', () => {
  const f = fixture(); f.type('i');
  f.root.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  f.type('n'); assert.equal(f.root.textContent, 'In'); // pre-existing capital left alone
});
test('Shift for a brand name does not invalidate tentative state', () => {
  const f = fixture(); f.type('i');
  f.root.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
  f.type('Phone'); assert.equal(f.root.textContent, 'iPhone');
});
test('Typora replacing a block with the same cid keeps word state', () => {
  const f = fixture('<p cid="n1"></p>'); f.type('i');
  const clone = f.root.firstChild.cloneNode(true); f.root.firstChild.replaceWith(clone);
  f.caret(clone.firstChild); f.type('Phone'); assert.equal(f.root.textContent, 'iPhone');
});
test('handled events never reach Typora bubbling beforeinput a second time', () => {
  const f = fixture(); let count = 0;
  f.root.addEventListener('beforeinput', () => count++);
  f.type('hello'); assert.equal(count, 4);
});
test('noncancelable input, missing insertion API and disposal do not swallow typing', () => {
  const f = fixture(); assert.equal(f.event('beforeinput', 'i', { cancelable: false }).defaultPrevented, false);
  f.editor.insertText = null; assert.equal(f.event('beforeinput', 'i').defaultPrevented, false);
  f.adapter.dispose(); assert.equal(f.event('beforeinput', 'i').defaultPrevented, false);
});
test('large block is skipped', () => {
  const f = fixture(`<p>${'a'.repeat(5000)}</p>`); f.caret(f.root.firstChild.firstChild);
  assert.equal(readContext(f.root, f.sel), null);
});
test('API failure pauses session without retrying a potentially partial edit', () => {
  const f = fixture(); f.editor.insertText = () => { throw new Error('fail'); };
  assert.equal(f.event('beforeinput', 'i').defaultPrevented, true);
  assert.equal(f.errors.length, 1);
  assert.equal(f.event('beforeinput', 'i').defaultPrevented, false);
});
