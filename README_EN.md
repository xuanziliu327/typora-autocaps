# Typora AutoCaps

Local, lightweight English sentence and pronoun **I** capitalization for Typora, with conservative math and code protection.

[中文](README.md) · [Testing](docs/TESTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Changelog](CHANGELOG.md)

**0.1.0 is a prerelease. Automated tests and programmatic integration tests in Typora 1.14.10 pass, including math/prose transitions, native undo/redo and restart persistence. Physical keyboard, shortcut and IME candidate-window acceptance remains pending. Try the manual checklist in a disposable document first.**

| Typed | Result |
| --- | --- |
| `hello. how are you?` | `Hello. How are you?` |
| `today i feel happy.` | `Today I feel happy.` |
| `i'm happy. i've finished.` | `I'm happy. I've finished.` |
| `you and i` | `You and I` |
| `i think $f(x)=ax+b$ is linear. it is simple.` | `I think $f(x)=ax+b$ is linear. It is simple.` |

## Features and scope

- Immediate sentence initials after `. ? !`, consecutive spaces, opening quotes/brackets, new paragraphs and list items.
- Standalone `i` and straight/curly-apostrophe contractions. Tentative capitalization reverses as the current word becomes `iPhone`, `iPad`, a URL, email or identifier.
- Skips inline/block math, inline/fenced code, HTML, links, source mode and unknown structures, including unfinished raw markup.
- Status bar **AutoCaps: ON / OFF**, **Ctrl+Alt+U**, separate sentence/pronoun options, framework-managed preferences.
- No runtime npm dependencies, network calls, telemetry, background services, polling, global keyboard hooks or full-document scans.

Target: **Windows 10/11, Typora 1.14.x, Typora Community Plugin 2.10.86+ compatible releases**. Local source inspection and programmatic editor integration used Typora 1.14.10/core 2.10.86. The target range is not a fully tested compatibility matrix. macOS, Linux and earlier Typora versions are not claimed as supported.

Typora has no official stable plugin API. The host framework has its own overhead and is not included in this package. Do not install a second injection framework just to run AutoCaps alongside another framework.

## Install

### Framework — once

1. Save your work and quit all Typora windows.
2. Download and extract `typora-community-plugin.zip` from the framework's [Releases](https://github.com/typora-community-plugin/typora-community-plugin/releases).
3. **Back up Typora's `resources/window.html` somewhere safe.** Locate the actual installation directory; do not assume a fixed path. The framework installer changes this file.
4. Follow the [official Windows instructions](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/docs/en-us/user-guide/1a-installation.md) and run `install-windows.ps1`. Follow its path and permission prompts.
5. Start Typora, verify that **Ctrl+.** opens plugin settings, then quit it.

If framework installation fails, quit Typora and restore your backup to its original location **only for the same Typora version**. After a Typora upgrade, follow the framework upgrade instructions instead of restoring old HTML. AutoCaps does not download or run a framework installer.

### AutoCaps

1. Download `typora-autocaps-0.1.0-windows.zip` from this project's Releases and **extract the entire archive**.
2. Quit Typora and double-click `installer/Install.cmd`.
3. Restart Typora → **Ctrl+. → Installed Plugins → enable Typora AutoCaps**.

The installer detects `%USERPROFILE%\.typora\community-plugins` or `%APPDATA%\Typora\plugins`, or asks for a custom directory containing `loader.js`. It changes no application binaries or unrelated settings. No Node.js/Python/config editing is needed. Its PowerShell execution-policy option applies only to the launched process.

Manual/offline option: extract `main.js` and `manifest.json` from `plugin.zip` directly into `<framework>/plugins/typora-autocaps/`, then enable it. There must be no extra nested directory. AutoCaps is **not yet listed in the marketplace**; no ZIP-import UI is claimed.

## Controls

Click the status label, use **Ctrl+Alt+U** in the editor, or run **Typora AutoCaps: Toggle** in the framework command palette (F1). The status control supports Enter/Space.

- **Settings → AutoCaps**: independently toggle sentence/pronoun rules.
- **Settings → Hotkeys**: customize `Typora AutoCaps: Toggle`.
- Allow about one second after changing settings before quitting. Preferences follow the framework's global/vault scope. Open windows do not synchronize immediately.
- **PAUSED** means an editor API failure stopped processing for this session. Check the last character, restart Typora and file an issue.

## Update, restore, remove

Quit Typora and run the new release's `Install.cmd`. Only the two plugin files are replaced; preferences are retained. Previous files are backed up to `<framework>/autocaps-backups/<timestamp>/` with the path printed by the installer. Run `Restore.cmd` and supply that path to roll back.

Run `Uninstall.cmd` or use the framework's Uninstall button. For complete cleanup, remove AutoCaps' `<framework>/settings/data/typora-autocaps.json` (or use `Manage.ps1 -Action Uninstall -PurgeSettings`), any vault-specific `.typora/data/typora-autocaps.json`, and unwanted AutoCaps backups. Reset its custom shortcut through Hotkeys; do not delete shared configuration files. Uninstalling the host itself is a separate operation covered by its official documentation.

## Limitations

- Current character-by-character typing only. Existing text, paste/drop, selected-text replacement, spellcheck replacement and IME composition/commits are left alone, including English committed by an IME.
- `i` initially appears as `I`; typing `n` next restores mid-sentence `in`, and `Phone` restores `iPhone`. Navigation, clicks, deletion, paste, blur, IME and format boundaries end this tracking. Continuing a word after such an interruption may retain its tentative capital.
- Heuristics are not grammar analysis. An abbreviation at a real sentence end can suppress capitalization. Bare mathematical `i` in prose is indistinguishable from the pronoun: use math/code markup or disable that rule.
- No search for the first English word anywhere within Chinese prose. Link labels are skipped too. Current blocks over 4096 UTF-16 characters or 256 DOM nodes, words over 128 characters, unknown structures and cross-node corrections are skipped.
- Native insertion creates editing transactions. Undo groups may be smaller than normal typing. Native undo-stack integration tests returned to an empty document and restored the original text; physical Ctrl+Z/Ctrl+Y delivery remains unverified. If the editor API fails, the triggering character may need retyping. No uncertain insertion is retried.
- Framework DOM/API changes and interactions with other plugins/themes require manual acceptance. No universal compatibility guarantee is implied.

## Develop and release

Use Node.js 20+ and pnpm 11.25.0 (subject to pnpm's own Node requirements; CI uses Node 24). End users need neither.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run check
pnpm run build
```

On Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File test/installer.integration.ps1`, then `pnpm run pack` and `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-package.ps1`. Outputs: `dist/plugin.zip`, `dist/typora-autocaps-0.1.0-windows.zip`, `dist/typora-autocaps-0.1.0-source.zip`, `dist/SHA256SUMS.txt`.

The runtime bundle is **15,270 bytes (14.91 KiB)** with no runtime npm packages. `jsdom` is the only direct development dependency. A reproducible isolated editor integration probe is documented in the source archive's `tools/native-probe/README.md`. CI tests pushes/PRs and creates a **draft**, prerelease GitHub Release for version tags. See [RELEASING.md](docs/RELEASING.md) for repository identity and marketplace registration; no fictitious GitHub owner is embedded in the manifest.

## Report a problem

Open **Issues → Bug report** in the repository you downloaded this from. Include Typora/core/AutoCaps versions, OS, IME, exact steps and a minimal sanitized example. Do not upload private notes. Turn AutoCaps off before continuing if typing behaves unexpectedly.

MIT License.
