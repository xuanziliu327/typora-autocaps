# Release checklist

1. Finish the real Typora acceptance matrix in `TESTING.md`; record exact versions and failures. Keep the release marked prerelease until it passes.
2. Set the repository's real GitHub identity when available: add `repo: "owner/repository"` and `authorUrl` to `manifest.json`, update author attribution if appropriate. Local loading does not require those fields. Do not invent an owner or advertise a nonexistent marketplace entry.
3. Keep `package.json` and `manifest.json` versions equal; update CHANGELOG, README archive names and compatibility evidence.
4. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm run check`, `pnpm run build`, `test/installer.integration.ps1`, `pnpm run pack`, `scripts/verify-package.ps1`. Use the isolated native probe as documented in the source archive's `tools/native-probe/README.md`; it tests real editor integration without physical keyboard/IME acceptance.
5. Inspect the ZIPs. `plugin.zip` has `main.js` and `manifest.json` at its root; the Windows ZIP additionally has **two numbered root CMD entries**, bilingual READMEs, LICENSE, CHANGELOG, `installer/`, `docs/` and a manual test sample. The framework archive is not bundled: the first entry downloads the official pinned release and checks its SHA-256. No research files, host source, dependencies or personal settings belong in the packages.
6. Push code to your own GitHub repository, then tag `0.1.3` (or the current version). CI validates that the tag matches the manifest and creates a **draft prerelease** with runtime/Windows/source ZIPs and checksums. Review it and publish when ready. This project has not been pushed or published by the development session.
7. Optional marketplace publication: follow the host's [release guide](https://github.com/typora-community-plugin/typora-community-plugin/blob/main/docs/en-us/dev-guide/9-releasing.md) and submit the required metadata to [typora-plugin-releases](https://github.com/typora-community-plugin/typora-plugin-releases). Approval is outside this repository. Keep the conventional `plugin.zip` release asset for the framework updater.

## Maintainer guidance

- Runtime files are plain JavaScript; the fixed four-module build strips only known internal import/export declarations. No compiler/transpiler/minifier is required. Keep module order in `build.mjs` synchronized with imports.
- The framework namespace is an upstream runtime contract, verified against commit `7a19c63…`; minCoreVersion is conservative, not an assertion that future versions cannot break it.
- Never modify pasted/existing content to improve an individual test. Preserve no-op behavior on ambiguity.
- A regression in undo, math editing, IME or swallowed input blocks a stable release.
- Package generation overwrites only generated `dist` artifacts. Plugin setup backs up existing AutoCaps directories, checks directory identity and rejects reparse points inside the plugin. Framework setup only downloads the pinned official ZIP; no downloaded installer or executable is run.
- Verify the native appearance profile on fresh installs and upgrades from the 0.1.1 two-entry installer. Unrelated host settings and independently installed frameworks' appearance choices must remain intact.
- Fully removing AutoCaps means deleting its plugin files, own settings and unwanted backups. Shared framework config may retain a disabled plugin id; do not delete shared config to clean that up.
