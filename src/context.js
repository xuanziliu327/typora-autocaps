import { MAX_CONTEXT } from './rules.js';

export const PROTECTED = [
  'pre', 'code', 'a', 'img', 'svg', 'math', 'mjx-container', 'input', 'textarea', 'script',
  '.CodeMirror', '.md-fences', '.md-math', '.md-inline-math', '.md-inline-math-container',
  '.md-math-block', '.md-math-tex', '.md-rawblock', '.md-htmlblock', '.md-html',
  '.md-meta', '.md-link', '.md-url', '.md-image', '.md-autolink', '.md-footnote',
  '.md-def-link', '.md-def-footnote', '.md-def-url', '.md-def-name', '.md-def-title',
  '.md-meta-block', '.md-comment', '.md-front-matter', '[contenteditable="false"]',
  '[md-inline="math"]', '[md-inline="code"]', '[md-inline="link"]',
  '[md-inline="image"]', '[md-inline="html"]',
].join(',');
const BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,td,th';
const SAFE_INLINE = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'DEL', 'MARK', 'SUB', 'SUP']);
const SAFE_MD = new Set(['plain', 'strong', 'em', 'del', 'highlight', 'sub', 'sup']);

export function elementOf(node) { return node?.nodeType === 1 ? node : node?.parentElement; }

export function blocked(node, root) {
  const el = elementOf(node);
  if (!el || !root.contains(el) || el.closest(PROTECTED)) return true;
  for (let cur = el; cur && cur !== root; cur = cur.parentElement) {
    const kind = cur.getAttribute('md-inline');
    if (kind && !SAFE_MD.has(kind)) return true;
  }
  return false;
}

// Read only the current small block, preserving opaque inline nodes as markers.
// Never read math/code text or walk the whole document. A hard node budget also
// prevents pathological spans from turning every keystroke into a large scan.
export function readContext(root, selection) {
  if (!selection || selection.rangeCount !== 1 || !selection.isCollapsed) return null;
  let range = selection.getRangeAt(0);
  let rootBoundary = false;
  // Chromium can leave the pristine caret on #write rather than inside its
  // single empty paragraph. Normalize only that unambiguous empty-block case.
  if (range.startContainer === root && root.childNodes.length === 1
      && root.firstChild.nodeType === 1 && root.firstChild.matches(BLOCK)) {
    range = range.cloneRange();
    range.setStart(root.firstChild, 0); range.collapse(true);
    rootBoundary = true;
  }
  const anchor = range.startContainer;
  if (blocked(anchor, root)) return null;
  const block = elementOf(anchor).closest(BLOCK);
  if (!block || !root.contains(block) || block.closest(PROTECTED)) return null;
  let text = '', caret = null, count = 0, unsafe = false;
  const parts = [];
  function walk(node) {
    if (++count > 256 || text.length > MAX_CONTEXT) { unsafe = true; return; }
    if (node.nodeType === 3) {
      if (node === anchor) caret = text.length + range.startOffset;
      parts.push({ node, start: text.length, length: node.data.length });
      text += node.data;
      return;
    }
    if (node.nodeType !== 1) return;
    if (node !== block && (blocked(node, root) || node.matches(BLOCK))) { text += '\ufffc'; return; }
    if (node !== block && node.tagName !== 'BR' && !SAFE_INLINE.has(node.tagName)) {
      unsafe = true; return;
    }
    if (node.tagName === 'BR') { text += '\n'; return; }
    for (let i = 0; i <= node.childNodes.length; i++) {
      if (node === anchor && i === range.startOffset) caret = text.length;
      if (i < node.childNodes.length) walk(node.childNodes[i]);
      if (unsafe) return;
    }
  }
  walk(block);
  if (unsafe || caret === null || text.length > MAX_CONTEXT
      || (rootBoundary && text.replace(/\u200b/gu, '') !== '')) return null;
  return { block, left: text.slice(0, caret), right: text.slice(caret), caret, parts, range };
}

export function readInputContext(root, selection, targets = []) {
  const visual = readContext(root, selection);
  if (!visual || !targets.length) return visual;
  if (targets.length !== 1 || !targets[0].collapsed) return null;
  const target = targets[0];
  if (target.startContainer === visual.range.startContainer && target.startOffset === visual.range.startOffset) return visual;
  // A browser target at <p>,0 and a caret at its empty text node,0 denote
  // the same insertion. Compare safe local positions, not node identity alone.
  try {
    const range = root.ownerDocument.createRange();
    range.setStart(target.startContainer, target.startOffset); range.collapse(true);
    const actual = readContext(root, { rangeCount: 1, isCollapsed: true, getRangeAt: () => range });
    const normalized = text => text.replace(/\u200b/gu, '');
    if (!actual || actual.block !== visual.block || normalized(actual.left) !== normalized(visual.left)
        || normalized(actual.right) !== normalized(visual.right)) return null;
    return actual;
  } catch { return null; }
}

export function replacementRange(context, back) {
  const range = context.range.cloneRange();
  if (!back) return range;
  const offset = context.caret - back;
  const part = context.parts.find(p => offset >= p.start && offset < p.start + p.length);
  if (!part) return null;
  // Never replace a span crossing markup/format boundaries.
  if (part.node !== range.startContainer) return null;
  range.setStart(part.node, offset - part.start);
  return range;
}
