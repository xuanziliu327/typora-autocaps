# Typora AutoCaps

Local, lightweight English sentence and pronoun **I** capitalization for Typora, with conservative math and code protection.

[中文](README.md) · [Testing](docs/TESTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Changelog](CHANGELOG.md)

**0.1.1 is a prerelease. Extract the Windows ZIP, run its two root setup entries and restart Typora: AutoCaps starts enabled automatically. Automated and Typora 1.14.10 programmatic integration tests pass; physical keyboard, shortcut and IME acceptance remains pending.**

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

Download **`typora-autocaps-0.1.1-windows.zip`** from this project's Releases and extract it completely. Choose the Windows installer ZIP; GitHub's Source code/source ZIP is for developers and requires a build.

The extracted root has two prominent entries:

- **`1-安装框架.cmd`** — install the framework once.
- **`2-安装AutoCaps.cmd`** — install and enable AutoCaps once.

Save your work, quit all Typora windows and run those two entries in order. Then restart Typora: **AutoCaps: ON** appears automatically. No plugin checkbox or further visit to the download folder is needed. After successful installation, the extracted folder can be moved or deleted.

Entry 1 detects the installation path, downloads the pinned official framework ZIP, verifies SHA-256, deploys JS/CSS/JSON into the Typora user-data directory and adds the standard loader to the backed-up `window.html`. It requests Windows UAC consent only when the application directory requires elevation. Compatible existing installations are retained. Downloaded installer scripts and executables are not run.

Entry 2 copies AutoCaps and merges the framework/plugin configuration to enable startup loading. Other plugin settings and independent sentence/pronoun preferences are preserved. The installer remembers your chosen Typora path; it asks only if it cannot select an installation automatically.

No Node.js, Python or environment/config editing is needed. The execution-policy option applies only to the launched PowerShell process. Both entries may be rerun safely. If a Typora upgrade replaces the loader hook, rerun entry 1; do not restore old HTML over a newer Typora version.

For offline setup, download the official [2.10.86 framework ZIP](https://github.com/typora-community-plugin/typora-community-plugin/releases/download/2.10.86/typora-community-plugin.zip), place it in the extracted root as `typora-community-plugin.zip`, and run entry 1. Its pinned SHA-256 is still verified.

`plugin.zip` retains the standard standalone format for existing framework users and future marketplace distribution. Manual copying still requires manual activation; ordinary users should use the two root entries. AutoCaps is not yet listed in the marketplace.

## Controls

Click the status label, use **Ctrl+Alt+U** in the editor, or run **Typora AutoCaps: Toggle** in the framework command palette (F1). The status control supports Enter/Space.

- **Settings → AutoCaps**: independently toggle sentence/pronoun rules.
- **Settings → Hotkeys**: customize `Typora AutoCaps: Toggle`.
- Allow about one second after changing settings before quitting. Preferences follow the framework's global/vault scope. Open windows do not synchronize immediately.
- **PAUSED** means an editor API failure stopped processing for this session. Check the last character, restart Typora and file an issue.

## Update, restore, remove

Quit Typora and run the new release's root entry 2. It installs and enables AutoCaps while retaining independent feature choices and unrelated settings. Advanced users wanting to retain OFF can use `installer/Install.cmd`. Files and configuration backups are under `<framework>/autocaps-backups/`. Use `installer/Restore.cmd` to restore a plugin backup.

Program HTML backups are under `<Typora user data>/autocaps-framework-backups/`. `installer/RestoreFramework.cmd` restores the saved HTML (run as administrator if needed), rejecting HTML changed by a later Typora upgrade. Framework files remain for recovery or separate removal.

Run `installer/Uninstall.cmd` or use the framework's Uninstall button. For complete cleanup, remove AutoCaps' `<framework>/settings/data/typora-autocaps.json` (or use `Manage.ps1 -Action Uninstall -PurgeSettings`), any vault-specific `.typora/data/typora-autocaps.json`, and unwanted AutoCaps backups. Reset its custom shortcut through Hotkeys; do not delete shared configuration files. Uninstalling the host itself is a separate operation covered by its official documentation.

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

On Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File test/installer.integration.ps1`, then `pnpm run pack` and `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-package.ps1`. Outputs: `dist/plugin.zip`, `dist/typora-autocaps-0.1.1-windows.zip`, `dist/typora-autocaps-0.1.1-source.zip`, `dist/SHA256SUMS.txt`.

The runtime bundle is **15,270 bytes (14.91 KiB)** with no runtime npm packages. `jsdom` is the only direct development dependency. A reproducible isolated editor integration probe is documented in the source archive's `tools/native-probe/README.md`. CI tests pushes/PRs and creates a **draft**, prerelease GitHub Release for version tags. See [RELEASING.md](docs/RELEASING.md) for repository identity and marketplace registration; no fictitious GitHub owner is embedded in the manifest.

## Report a problem

Open **Issues → Bug report** in the repository you downloaded this from. Include Typora/core/AutoCaps versions, OS, IME, exact steps and a minimal sanitized example. Do not upload private notes. Turn AutoCaps off before continuing if typing behaves unexpectedly.

MIT License.
