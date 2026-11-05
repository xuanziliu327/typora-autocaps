# Changelog

## 0.1.2 — 2026-11-05 (prerelease)

- Fixed the installer enabling the host's default ribbon and multi-tab workspace. Fresh installations now retain Typora's native sidebar and editor layout through host settings.
- Entry 2 also repairs installations made by the 0.1.1 two-entry installer, with a backup of the original host preferences. Unrelated settings and independently installed frameworks' appearance choices are preserved.
- Added appearance migration, backup and malformed-configuration regression tests, and real Typora layout/input verification with the workspace disabled.
- The AutoCaps typing runtime remains unchanged.

## 0.1.1 — 2026-11-05 (prerelease)

- Added two prominent Windows ZIP root entries: install the framework, then install/enable AutoCaps.
- Framework setup detects Typora, downloads a pinned official ZIP with SHA-256 verification, backs up program HTML, installs the standard startup hook and requests UAC only when required.
- AutoCaps setup merges host/plugin settings to enable loading on every normal Typora startup. Installed files live in the user-data directory, independent of the extracted download folder.
- Added idempotent setup, configuration backups, installation rollback, guarded framework HTML restoration and failure propagation.
- The typing runtime is unchanged from the verified 0.1.0 bundle. Added installation and startup integration evidence.

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
