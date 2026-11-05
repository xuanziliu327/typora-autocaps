// Pure keystroke planner. Offsets are UTF-16 offsets, like DOM Range.
export const MAX_CONTEXT = 4096;
const ABBREVIATIONS = new Set([
  'e.g.', 'i.e.', 'dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'sr.', 'jr.',
  'vs.', 'etc.', 'fig.', 'eq.', 'no.', 'st.', 'approx.', 'dept.', 'inc.',
]);
const OPENING = /[\s"'“‘([{]*$/u;
const TOKEN_CHAR = /^[A-Za-z0-9'’._:/@\\?&=%#+-]$/u;

export function sentenceStart(left) {
  left = left.replace(/\u200b/gu, ''); // Typora's empty-block placeholder
  const clean = left.replace(OPENING, '');
  if (!clean || /\n[ \t]*["'“‘([{]*$/u.test(left)) return true;
  // A delimiter must be followed by actual whitespace (quotes may intervene).
  const match = left.match(/([.!?])["'”’\])}]*[ \t\u00a0]+["'“‘([{]*$/u);
  if (!match) return false;
  if (match[1] !== '.') return true;
  const ending = left.slice(0, match.index + 1).match(/[A-Za-z.]+$/u)?.[0] ?? '';
  return !ABBREVIATIONS.has(ending.toLowerCase()) && !/^(?:[A-Za-z]\.)+$/u.test(ending);
}

// Secondary guard for markup not yet promoted to Typora DOM nodes.
// DOM ancestry is the primary guard. Ambiguous/unclosed syntax fails closed.
export function rawProtected(left) {
  let mode = '', ticks = 0;
  for (let i = 0; i < left.length; i++) {
    const c = left[i], next = left[i + 1];
    if (mode === 'tick') {
      if (c === '`') {
        let n = 1;
        while (left[i + n] === '`') n++;
        if (n === ticks) mode = '';
        i += n - 1;
      }
      continue;
    }
    if (mode === '$' || mode === '$$') {
      if (c === '\\') { i++; continue; }
      if (left.startsWith(mode, i)) { i += mode.length - 1; mode = ''; }
      continue;
    }
    if (mode === '\\)' || mode === '\\]') {
      if (left.startsWith(mode, i)) { i++; mode = ''; }
      continue;
    }
    if (mode === 'html') { if (c === '>') mode = ''; continue; }
    if (mode === 'link') { if (c === ')') mode = ''; continue; }
    if (mode === 'bracket') {
      if (c === ']') { mode = next === '(' ? 'link' : ''; if (next === '(') i++; }
      continue;
    }
    if (c === '\\') {
      if (next === '(' || next === '[') mode = next === '(' ? '\\)' : '\\]';
      i++;
    } else if (c === '$') {
      mode = next === '$' ? '$$' : '$';
      if (next === '$') i++;
    } else if (c === '`') {
      ticks = 1;
      while (left[i + ticks] === '`') ticks++;
      mode = 'tick'; i += ticks - 1;
    } else if (c === '<') mode = 'html';
    else if (c === ']' && next === '(') { mode = 'link'; i++; }
    else if (c === '[') mode = 'bracket';
  }
  return !!mode;
}

function technical(token) {
  // Internal capitals (iPhone), digits, identifiers, paths, URLs and addresses.
  return /[0-9_:/@\\&=%#+-]/u.test(token) || /[a-z][A-Z]/u.test(token)
    || /\.[A-Za-z]/u.test(token);
}

function desiredToken(raw, sentence, pronoun) {
  if (technical(raw)) return raw;
  const isI = /^i(?:['’](?:m|ve|ll|d)?)?[.!?]*$/u.test(raw)
    || /^i['’](?:v|l)$/u.test(raw); // unfinished contractions
  return (sentence || (pronoun && isI)) ? raw[0].toUpperCase() + raw.slice(1) : raw;
}

/**
 * pending records only the current word started in this uninterrupted edit.
 * Return a minimal replacement ending at the caret, plus new transient state.
 * Never transform pre-existing words, paste, selection replacements or IME text.
 */
export function planInput({ left, right = '', data, sentence = true, pronoun = true }, pending = null) {
  const none = { edit: null, pending: null };
  if (typeof data !== 'string' || data.length !== 1 || left.length > MAX_CONTEXT) return none;
  if (rawProtected(left)) return none;
  if (pending && left !== pending.prefix + pending.shown) pending = null;
  if (pending && TOKEN_CHAR.test(data)) {
    const raw = pending.raw + data;
    if (raw.length > 128) return none;
    const shown = desiredToken(raw, pending.sentence && sentence, pronoun);
    const before = pending.shown + data;
    return {
      edit: shown === before ? null : { back: pending.shown.length, text: shown },
      pending: { ...pending, raw, shown },
    };
  }
  if (!/^[a-z]$/u.test(data) || /[\p{L}\p{N}_'’./:@\\-]$/u.test(left)
      || /^[\p{L}\p{N}_'’./:@\\-]/u.test(right)) return none;
  const atStart = sentence && sentenceStart(left);
  if (!atStart && !(pronoun && data === 'i')) return none;
  const shown = data.toUpperCase();
  return {
    edit: { back: 0, text: shown },
    pending: { prefix: left, raw: data, shown, sentence: atStart },
  };
}
