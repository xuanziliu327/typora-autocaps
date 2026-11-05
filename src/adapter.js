import { planInput } from './rules.js';
import { blocked, readContext, replacementRange } from './context.js';

export function attachAutoCaps({ root, editor, getSettings, onError = () => {} }) {
  const doc = root.ownerDocument;
  let pending = null, block = null, composing = false, applying = false, failed = false;
  const cleanups = [];
  const reset = () => { pending = null; block = null; };
  const blockKey = el => el.getAttribute('cid') || el;
  const comparable = text => text.replace(/\u200b/gu, '').replace(/\u00a0/gu, ' ');
  function listen(target, event, callback, capture = false) {
    target.addEventListener(event, callback, capture);
    cleanups.push(() => target.removeEventListener(event, callback, capture));
  }
  function beforeInput(event) {
    if (applying) return;
    const settings = getSettings();
    if (failed || !settings.enabled || composing || event.isComposing || event.defaultPrevented
        || !event.cancelable || event.inputType !== 'insertText' || event.data?.length !== 1
        || editor?.sourceView?.inSourceMode !== false || blocked(event.target, root)
        || /^(INPUT|TEXTAREA)$/u.test(doc.activeElement?.tagName ?? '')) { reset(); return; }
    const selection = doc.defaultView.getSelection();
    const context = readContext(root, selection);
    if (!context) { reset(); return; }
    // Target ranges may differ from the visual caret (spellcheck, replacement).
    const targets = event.getTargetRanges?.() ?? [];
    if (targets.length && (targets.length !== 1 || !targets[0].collapsed
        || targets[0].startContainer !== context.range.startContainer
        || targets[0].startOffset !== context.range.startOffset)) { reset(); return; }
    if (block !== blockKey(context.block)) pending = null;
    const plan = planInput({ ...context, data: event.data, ...settings }, pending);
    if (!plan.edit) { pending = plan.pending; block = blockKey(context.block); return; }
    const range = replacementRange(context, plan.edit.back);
    if (!range || typeof editor.insertText !== 'function') { reset(); return; }
    // Use Typora's own insertion path and undo snapshots; no direct DOM writes.
    // Cancel only after all guards pass. If the API throws, disable this session
    // rather than retrying an operation that may already have partly committed.
    event.preventDefault();
    // Typora 1.14's bubbling handler does not check defaultPrevented and would
    // prepare the original lowercase input a second time after our transaction.
    event.stopImmediatePropagation();
    applying = true;
    try {
      selection.removeAllRanges(); selection.addRange(range);
      editor.insertText(plan.edit.text);
      const after = readContext(root, doc.defaultView.getSelection());
      // The native transaction can promote earlier raw math/links to opaque DOM
      // nodes. Validate the inserted tail, unchanged right side and block identity;
      // comparing the entire left DOM string would reject that legitimate redraw.
      if (!after || blockKey(after.block) !== blockKey(context.block)
          || !comparable(after.left).endsWith(comparable(plan.edit.text))
          || comparable(after.right) !== comparable(context.right)) throw new Error('Insertion postcondition failed');
      pending = plan.pending && { ...plan.pending, prefix: after.left.slice(0, -plan.pending.shown.length) };
      block = blockKey(after.block);
    } catch (error) {
      failed = true; reset(); onError(error);
    } finally { applying = false; }
  }
  listen(root, 'beforeinput', beforeInput, true);
  listen(root, 'input', event => {
    if (!applying && (event.inputType !== 'insertText' || event.isComposing)) reset();
  });
  listen(root, 'compositionstart', () => { composing = true; reset(); });
  listen(root, 'compositionend', () => { composing = false; reset(); });
  listen(root, 'blur', reset, true);
  listen(root, 'pointerdown', reset, true);
  // Clear tentative state after navigation/undo without a global key listener.
  listen(root, 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey
        || /^(Arrow|Home$|End$|Page|Backspace$|Delete$|Enter$|Tab$|Escape$)/u.test(event.key)) reset();
  }, true);
  return { reset, dispose() { cleanups.forEach(fn => fn()); reset(); } };
}
