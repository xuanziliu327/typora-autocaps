# Architecture and investigation

Investigation date: 2026-11-05. Upstream source was inspected locally at these commits (not copied into the distribution):

- [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin/tree/5c3206e1581332426673b0302498221387ffb97e), `5c3206e1581332426673b0302498221387ffb97e`.
- [typora-community-plugin](https://github.com/typora-community-plugin/typora-community-plugin/tree/7a19c63cd8a5bcfae639b521774485bf890fcfff), `7a19c63cd8a5bcfae639b521774485bf890fcfff`, core package version 2.10.86.

## Framework comparison

| Concern | obgnail/typora_plugin | Typora Community Plugin |
| --- | --- | --- |
| Loading | `BasePlugin`, CommonJS `{ plugin: Class }`; configured plugin loader calls prepare/init/process and registers UI/hotkeys | ESM `main.js` default Plugin subclass, `manifest.json`; plugin manager dynamically imports it |
| Installation | Copy framework `plugin/` into the directory containing `window.html`, run its Windows installer | Official script installs loader/core in user storage and injects a loader into `window.html`; external plugins are separate directories |
| UI/config | Context menu, action buttons, preferences and hotkey hub; TOML settings/user space | Status bar item, command palette, editor-scoped hotkey, Settings tab and PluginSettings |
| Editing/events | `eventHub`, editor DOM events, `File.editor` helpers, existing symbol-pairing plugin | Markdown load/edit events, lifecycle-managed DOM listeners; Markdown insertion API is intended for broader inserts |
| Update/removal | Framework updater and install/uninstall scripts, alongside bundled enhancement plugins | Individual plugin enable/disable/uninstall, marketplace updates after registration, independent `plugin.zip` releases |
| Compatibility evidence | Loader rejects versions before 0.9.98; Windows/Linux installation documented; not an AutoCaps compatibility guarantee | Upstream README reports Windows 10 testing on Typora 1.1.x–1.14.x; not an AutoCaps compatibility guarantee |
| Runtime cost | Broad framework with many optional/default features | Broad framework with own editor services and observers; not a minimal injection shim |

**Decision:** Community Plugin, for its independent packaging, lifecycle, status/settings UI and user-directory installation. Neither framework's total CPU/RAM was benchmarked, so this is not a claim that Community Plugin is universally lighter. A single AutoCaps bundle adds no library or DOM observer. Users can disable unwanted host core plugins/UI in its settings. The host's existing editor service uses a MutationObserver; AutoCaps does not subscribe to its high-frequency `edit` stream or add another observer.

References supporting the implementation:

- [Plugin lifecycle, settings and status bar API](https://github.com/typora-community-plugin/typora-community-plugin/blob/7a19c63cd8a5bcfae639b521774485bf890fcfff/packages/core/src/plugin/plugin.ts).
- [Settings persistence](https://github.com/typora-community-plugin/typora-community-plugin/blob/7a19c63cd8a5bcfae639b521774485bf890fcfff/packages/core/src/settings/settings.ts), [configuration paths](https://github.com/typora-community-plugin/typora-community-plugin/blob/7a19c63cd8a5bcfae639b521774485bf890fcfff/packages/core/src/common/constants.ts).
- [Commands](https://github.com/typora-community-plugin/typora-community-plugin/blob/7a19c63cd8a5bcfae639b521774485bf890fcfff/docs/en-us/dev-guide/3-command.md), [packaging and marketplace](https://github.com/typora-community-plugin/typora-community-plugin/blob/7a19c63cd8a5bcfae639b521774485bf890fcfff/docs/en-us/dev-guide/9-releasing.md).
- [Runtime exports used by upstream bundler](https://github.com/typora-community-plugin/typora-community-plugin/blob/7a19c63cd8a5bcfae639b521774485bf890fcfff/packages/rollup-plugin/index.js).
- [obgnail loader](https://github.com/obgnail/typora_plugin/blob/5c3206e1581332426673b0302498221387ffb97e/plugin/global/core/index.js), [native insertion helper](https://github.com/obgnail/typora_plugin/blob/5c3206e1581332426673b0302498221387ffb97e/plugin/global/core/utils/index.js), [symbol pairing / undo use](https://github.com/obgnail/typora_plugin/blob/5c3206e1581332426673b0302498221387ffb97e/plugin/cjk_symbol_pairing.js).

## Data flow

```text
#write beforeinput (single character, collapsed selection, no IME)
    → source-mode / active-element / ancestor guards
    → current block (≤4096 UTF-16 units, ≤256 DOM nodes)
    → opaque placeholders for math/code/links; raw unfinished-markup guard
    → pure rule planner and current-word state
    → minimal current-range replacement through Typora editor.insertText
    → verify caret/text postcondition; otherwise pause session
```

`src/rules.js` is pure. It knows nothing about Typora, storage or DOM. It returns a replacement ending at the caret and transient word state. Existing words are not normalized. Sentence initials are immediate; a mid-sentence `i` is tentative until subsequent input disambiguates it. A later character can restore only a first letter that this uninterrupted edit changed. Known abbreviations and dotted initials suppress new sentence detection.

`src/context.js` checks caret ancestry first, including CodeMirror and Typora math/raw/inline metadata. Unknown inline kinds fail closed. A bounded walk of the closest paragraph/list item/table cell collects local context; protected subtrees are represented by one opaque character, never read. Replacement cannot cross text-node boundaries. A small local scanner protects raw markup before Typora has promoted it to structured DOM. It is a secondary guard, not a document-wide regex location guess.

`src/adapter.js` owns seven listeners on `#write`: beforeinput, input, compositionstart/end, blur, pointerdown, keydown. The last is local and only invalidates transient state on navigation or commands; it never produces text. No global key listener, timer, observer, file read or network activity is in the typing path. Framework shortcuts are separately editor-scoped.

`src/main.js` uses the framework's Plugin, PluginSettings, SettingTab, status bar, commands and cleanup hooks. Preferences are written by the framework after a debounce (about one second); AutoCaps adds no persistence loop. Disabling/unloading removes listeners and clears transient state.

## Native editor inspection and transaction choice

The locally installed Typora 1.14.10 `resources/appsrc/window/frame.js` was read, not modified or redistributed. Findings:

- `File.editor.insertText` delegates to Typora's own `UserOp.pasteHandler` with text/selection-preserving flags.
- Its insertion path builds and registers Typora undo commands and refreshes relevant editor nodes.
- The bubbling `beforeinput` handler performs preparation/snapshots without checking `defaultPrevented`. AutoCaps therefore stops propagation **only for an input it has taken over**, preventing a duplicate native preparation pass.
- Inline math uses `.md-inline-math`, an editable `script` child, preview containers and specialized math logic. Code fences/source mode use CodeMirror; raw blocks use `.md-rawblock`.
- Empty content can include U+200B. Postcondition checks tolerate that placeholder and NBSP normalization. A stable Typora `cid`, plus current text verification, allows a DOM redraw without treating a different block as the same edit.

This API was preferred over direct `textContent` mutation, synthetic Backspace, full-document replacement and Chromium `execCommand` (which would use a different undo stack). Programmatic tests subsequently exercised the real Typora renderer and undo stack, separately from physical keyboard acceptance. The test-only harness uses `execCommand` for browser default input that AutoCaps leaves untouched; the shipped plugin never does.

Native insertion may promote earlier raw `$...$` to rendered math DOM within the transaction. After insertion, AutoCaps validates the inserted tail, the unchanged right side and the stable block identity. It then rebuilds the current-word prefix from the new DOM. Comparing the entire old/new left context would wrongly treat legitimate math promotion as a failed insertion. A regression test covers this transition.

Native insertion may create extra undo groups. API failure pauses the session instead of retrying a possibly committed edit; a triggering character can require manual re-entry. The isolated probe recovered the full sample after undoing to an empty document and redoing all steps; it does not establish identical grouping for physical keyboard input.

## Limits and future work

At most one bounded block read per eligible input, and a second only after a correction. Candidate token length ≤128. Pure rule evaluation is linear in this bounded context. A block can contain fewer English characters than UTF-16 code units. No total memory/latency claim is made for the host framework.

Next priorities: physical keyboard/IME/shortcut acceptance, broader Typora version coverage, documented host-native transaction hook if one becomes available, cross-platform installer validation and optional abbreviation exceptions. The reusable native integration probe lives under `tools/native-probe`; it requires a marked disposable profile and is excluded from the runtime ZIP. Avoid expanding heuristics at the cost of formulas or input safety.
