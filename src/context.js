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
  const range = selection.getRangeAt(0);
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
  if (unsafe || caret === null || text.length > MAX_CONTEXT) return null;
  return { block, left: text.slice(0, caret), right: text.slice(caret), caret, parts, range };
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
