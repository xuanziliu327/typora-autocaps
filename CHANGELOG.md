# Changelog

## 0.1.0 — 2026-11-05 (prerelease)

- Initial standalone Typora Community Plugin extension; Windows / Typora 1.14.x target.
- Immediate English sentence and pronoun I capitalization with reversible current-word tracking.
- Conservative DOM, source mode, unfinished math/Markdown, IME and technical-token guards.
- Framework status control, editor shortcut, settings page and persisted preferences.
- Windows installer, backups, rollback, uninstall, reproducible packaging and SHA-256 hashes.
- Pure-rule, DOM-event, framework-contract and installer-fixture tests.
- Added an isolated real-editor integration probe and extracted-package installation verification.
- Fixed a native raw-math-to-rendered-DOM transition that could pause processing and retain a tentative I after a formula.
- Programmatic Typora 1.14.10/core 2.10.86 input, native undo/redo, formula, source-mode and restart-persistence checks pass. Physical keyboard/IME acceptance remains pending; see `docs/TESTING.md`.
