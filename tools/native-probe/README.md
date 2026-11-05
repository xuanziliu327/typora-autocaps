# Native editor integration probe

Development only. This is a second plugin for a disposable Typora copy/profile;
it replaces the test document repeatedly and must never be installed in your
normal profile or distributed inside AutoCaps release ZIPs. A marker-file guard
rejects ordinary profiles. It does not send keyboard events to the user's app.

1. Build AutoCaps: `node scripts/build.mjs`.
2. Download the host framework ZIP from its official Releases.
3. Run from the repository, using your actual Typora path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-native-test.ps1 -TyporaPath 'D:\Typora' -FrameworkZip '.\typora-community-plugin.zip' -Launch
```

The script creates a new `.test-output/native-*/` directory, copies application
files, adds read-only-by-convention resource junctions and changes only the copied
`window.html`. The real installation/profile remains untouched. It uses no network
downloads or remote-debugging flags. Review `fixture.json` for exact paths.

Allow about 15 seconds and inspect `profile/native-report.json`: `done` and `pass`
must be true, every case should pass and statuses during typing should remain ON.
The probe intentionally leaves the test preference OFF. Close only the copied
Typora instance and launch its copied executable again with the same
`--user-data-dir` value from `fixture.json`; `initialPreference` should be false.
Existing real Typora processes do not need to be closed.

The probe dispatches constructed `beforeinput` events with target ranges and uses
Chromium `execCommand` only to simulate the browser's default insertion for
characters the plugin did not handle. Corrections go through AutoCaps and the
actual Typora API, DOM renderer and undo stack. Framework settings use real disk
storage. This validates integration and DOM transitions; it does not replace
physical keyboard, IME candidates, shortcut delivery or timing acceptance.

The fixture uses the installer's native appearance settings. `appearance.pass`
checks that the ribbon and workspace DOM are absent, the native editor starts at
the left edge and the original sidebar header remains available. The input and
undo cases run with the workspace disabled.

`firstParagraph` runs before any `reloadContent()` in a fresh startup document:
it checks the very first character, compact dotted text and spaced sentences in
one paragraph without Enter. It records `skipped=true` if a restarted fixture
restored its previous nonempty document; use a new profile to exercise this case.

`initialCaretCases` explicitly varies the first insertion's selection and target:
empty text versus paragraph boundary, and root offsets before/after the empty
paragraph. It verifies the first Y and the rest of the sentence without Enter.
These are controlled DOM/target-range scenarios, not captured physical-keyboard
events; earlier probes forcing identical boundaries could not detect this bug.

Tests end with a disposable sample in the copied app. No private notes are loaded.
Stop its recorded process before removing the fixture. Resource directories are
junctions to the original install: never edit shared resources or recursively
follow these junctions when cleaning up. The preparation script never removes an
existing directory.
