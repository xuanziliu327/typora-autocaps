import test from 'node:test';
import assert from 'node:assert/strict';
import { planInput, sentenceStart, rawProtected, MAX_CONTEXT } from '../src/rules.js';

function type(text, options = {}, prefix = '') {
  let left = prefix, pending;
  for (const data of text) {
    const result = planInput({ left, data, ...options }, pending);
    left = result.edit ? left.slice(0, left.length - result.edit.back) + result.edit.text : left + data;
    pending = result.pending;
  }
  return left;
}
const cases = [
  ['hello world.', 'Hello world.'],
  ['hello. how are you?', 'Hello. How are you?'],
  ['are you okay? i am fine.', 'Are you okay? I am fine.'],
  ['yes! that is correct.', 'Yes! That is correct.'],
  ['hello.  how are you?', 'Hello.  How are you?'],
  ['first paragraph\nsecond paragraph', 'First paragraph\nSecond paragraph'],
  ['“hello.” (how are you?)', '“Hello.” (How are you?)'],
  ['the value is 3.14 and 2.0.', 'The value is 3.14 and 2.0.'],
  ['dr. smith met mr. jones.', 'Dr. smith met mr. jones.'],
  ['e.g. this and i.e. that.', 'e.g. this and i.e. that.'],
  ['i am a student.', 'I am a student.'],
  ['today i feel happy.', 'Today I feel happy.'],
  ['you and i', 'You and I'],
  ['i think i understand.', 'I think I understand.'],
  ["i'm happy. i've finished. i'll go. i'd like to try.", "I'm happy. I've finished. I'll go. I'd like to try."],
  ['i’m happy. i’ve finished. i’ll go. i’d like to try.', 'I’m happy. I’ve finished. I’ll go. I’d like to try.'],
  ['with inside light initial', 'With inside light initial'],
  ['iPhone iPad iOS', 'iPhone iPad iOS'],
  ['https://example.com/i', 'https://example.com/i'],
  ['hello@example.com', 'hello@example.com'],
  ['my_variable i_count i123', 'my_variable i_count i123'],
  ['i think the function $f(x)=ax+b$ is interesting. it is linear.', 'I think the function $f(x)=ax+b$ is interesting. It is linear.'],
  ['$i$ and i', '$i$ and I'],
  ['$$\nf(x)=ax+b i\n$$\nhello', '$$\nf(x)=ax+b i\n$$\nHello'],
  ['\\[ \\int_a^b f(x)\\,dx i \\]\nhello', '\\[ \\int_a^b f(x)\\,dx i \\]\nHello'],
  ['`i = f(x)` and i', '`i = f(x)` and I'],
  ['```js\nconst i = 3;\n```\nhello', '```js\nconst i = 3;\n```\nHello'],
  ['[label](https://example.com/i) and i', '[label](https://example.com/i) and I'],
  ['<span title="i am">hello</span>', '<span title="i am">hello</span>'],
];
for (const [input, expected] of cases) test(`typing: ${JSON.stringify(input)}`, () => assert.equal(type(input), expected));
test('first letter is immediate, no need for a trailing space', () => assert.equal(type('h'), 'H'));
test('Typora empty paragraph placeholder', () => assert.equal(type('hello', {}, '\u200b'), '\u200bHello'));
test('pronoun tentative I reverses when the word continues', () => {
  assert.equal(type('i', {}, 'you and '), 'you and I');
  assert.equal(type('inside', {}, 'go '), 'go inside');
});
test('manual capitals remain untouched', () => assert.equal(type('iPhone', {}, 'HELLO '), 'HELLO iPhone'));
test('options operate independently', () => {
  assert.equal(type('hello. i am.', { sentence: false }), 'hello. I am.');
  assert.equal(type('hello. i am. and i', { pronoun: false }), 'Hello. I am. And i');
  assert.equal(type('hello i', { sentence: false, pronoun: false }), 'hello i');
});
test('local editing uses caret context', () => {
  assert.equal(planInput({ left: 'hello. ', right: 'world', data: 'h' }).edit, null);
  assert.deepEqual(planInput({ left: 'hello. ', right: ' world', data: 'h' }).edit, { back: 0, text: 'H' });
  assert.equal(planInput({ left: 'w', right: 'th', data: 'i' }).edit, null);
});
test('stale transient state cannot rewrite old text', () => {
  const p = planInput({ left: '', data: 'i' }).pending;
  assert.equal(planInput({ left: 'old I', data: 'n' }, p).edit, null);
});
test('bounded work and no paste conversion', () => {
  assert.equal(planInput({ left: 'a'.repeat(MAX_CONTEXT + 1), data: 'i' }).edit, null);
  assert.equal(planInput({ left: '', data: 'hello i' }).edit, null);
});
test('raw protection: incomplete syntax, escaped delimiters, closed math', () => {
  for (const text of ['$i', '$$i', '\\(i', '\\[i', '`i', '[x](i', '<img title="i']) assert.equal(rawProtected(text), true, text);
  for (const text of ['$i$ ', '\\(i\\) ', '\\[i\\] ', '`i` ', '\\$50 ']) assert.equal(rawProtected(text), false, text);
});
test('abbreviations, initials, non-sentence periods', () => {
  for (const text of ['e.g. ', 'i.e. ', 'Dr. ', 'Mr. ', 'A. ', 'U.S. ', '3.']) assert.equal(sentenceStart(text), false, text);
  assert.equal(sentenceStart('3.14. '), true);
});
