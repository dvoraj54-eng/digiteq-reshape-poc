# CLAUDE.md – Digiteq Reshape POC

You are helping Jan (area manager at Digiteq Automotive, leads a Škoda demo) build a proof of concept:
**reshape an Android Automotive app from a wide display to a portrait display – in Figma and in code – with automatic checks.**
Jan is learning Android and modern UI workflows along the way: explain briefly *why* when you make a non-obvious choice, keep answers short, and prefer small working steps he can see on the emulator over big batches. He writes informally (often voice-to-text) – read charitably.

## Repo map

| Path | What | Edit? |
|---|---|---|
| `rules/DESIGN-RULES.md` | **The contract**: displays, grid, safety minimums, reflow rules R1–R7, per-screen tables, checks | Only when Jan agrees – ask first |
| `figma/plugin/code.js`, `manifest.json` | Figma plugin (runs in Figma's sandbox) | Yes, carefully (see rules below) |
| `figma/plugin/ui.html`, `figma/assistant/*.html` | **Generated** – do not edit | No → edit `figma/*-src/` and run the build |
| `figma/plugin-src/`, `figma/assistant-src/` | Sources of the generated HTML | Yes |
| `figma/tests/simulate.js` | Plugin regression test (Figma API mocked) | Yes – add a test for every bug fixed |
| `design-exports/json/`, `design-exports/png/` | Exports of the POC screens from Figma | No (Jan re-exports) |
| `android/TipsApp/` | The Android test app – **your main work area now** | Yes |
| `docs/` | Documentation | Keep in sync with changes |

## Commands

```bash
# Figma part
node figma/build.mjs                 # after editing figma/*-src or rules/DESIGN-RULES.md
node figma/tests/simulate.js         # must end with "0 failed" before committing figma/ changes

# Android part (run from android/TipsApp)
./gradlew assembleDebug
./gradlew installDebug
adb shell am start -n cz.digiteq.tips/.HomeActivity
./gradlew testDebugUnitTest          # JVM tests incl. Roborazzi screenshots
./gradlew recordRoborazziDebug       # (re)record golden screenshots – only when Jan approved the look
./gradlew verifyRoborazziDebug       # compare with goldens
./gradlew connectedDebugAndroidTest  # layout-rule tests on the running emulator

# Emulators (AVD names from docs/android-setup-mac.md)
emulator -list-avds                  # Wide_1920x1200, Portrait_1400x1840
emulator -avd Wide_1920x1200 -no-snapshot-save &
adb wait-for-device && adb shell getprop sys.boot_completed   # "1" when ready
adb exec-out screencap -p > /tmp/shot.png                     # then Read the PNG to look at it
adb shell wm size; adb shell wm density                       # expect 160 dpi
```

**Look at your work.** After a UI change: install, launch, take a screenshot with `adb exec-out screencap`, open it with the Read tool and compare with `design-exports/png/` (1x PNGs, Figma px = dp at 160 dpi). Say what differs. Don't claim a screen matches without having looked at it.

## Golden rules

1. **The rules file is the contract.** Values (margins 24, gaps 16/32, touch target ≥ 76 dp, text ≥ 22 sp, header 132) come from `rules/DESIGN-RULES.md` and `docs/android-app-spec.md`. If code and rules disagree, stop and ask – don't silently pick one.
2. **View ID = Figma layer name = Compose test tag** (`tip_steps` ↔ `@+id/tip_steps` ↔ `testTag("tip_steps")`). Wide and portrait layouts use **the same IDs** and the same file names (`res/layout/` vs `res/layout-port/`).
3. **No Škoda data.** Invented content only. Never add files from Škoda/Digiteq projects to this repo. The repo is private but treat it as shareable.
4. **Generated files** (`figma/plugin/ui.html`, `figma/assistant/digiteq-reshape-assistant.html`) are rebuilt by `node figma/build.mjs`; never edit them by hand.
5. **Figma plugin sandbox:** no `import(` / `eval` / HTML comments anywhere in `code.js` – not even in comments. `simulate.js` scans for this.
6. **Versions:** use the versions the Android Studio template / `libs.versions.toml` gives you or the current stable ones – never invent version numbers. If unsure, check and say so.
7. **Small commits** with clear messages, one step at a time; run the relevant tests before each commit. Don't push unless Jan asks.
8. Keep `docs/` up to date when behaviour or commands change.

## Current phase: Android (phase 2 → 3)

Full spec: **`docs/android-app-spec.md`**. Order:

- **2a – Wide app only (the "existing app").** Project `android/TipsApp`, XML Views, 3 screens (S1 Home, S2 Category, S3 Tip detail) + navigation, **wide layouts in `layout/` only**, on the `Wide_1920x1200` emulator. Step by step: project + theme → S1 → S2 → S3 → navigation; show each on the emulator before moving on. When done: commit and tag **`wide-baseline`**. This simulates the real Škoda app before the new display.
- **2b – Apply the reshape.** Add `layout-port/` from the reshaped Figma screens (`design-exports/json/*_1400x1400*`) + the rules, on the `Portrait_1400x1840` emulator. Goal: as few changes outside `layout-port/` as possible (e.g. one R7 helper). `git diff wide-baseline` is then the demo of "what the reshape changed in code" – keep it clean.
- **2c – Compose comparison.** S3 Tip detail once more in Jetpack Compose (one composable branching on window shape), same test tags, own launcher entry. Then a short comparison note for Jan (`docs/xml-vs-compose.md`): code size, effort, how each handles two displays.
- **3 – Minimal automated tests.** Roborazzi screenshots of every screen in both sizes (JVM, deterministic), layout-rule tests on the emulator (IDs from the Figma export present, touch targets, text sizes, overlaps, R7), a one-command script. Details in the spec. (Screenshot + rule tests for the wide variant can already be set up at the end of 2a – they then prove the reshape didn't break wide.)

Status of the Figma part (phase 1) is described in `docs/figma-pipeline.md` – it's done; only touch it if Jan asks.

## Environment

MacBook (Apple Silicon), Android Studio with bundled JBR (`JAVA_HOME` set in `~/.zshrc`), SDK in `~/Library/Android/sdk`, Android Automotive emulator images "Google APIs" (no Play Store). Setup: `docs/android-setup-mac.md`. If the environment is missing something, tell Jan the exact step from that doc instead of working around it.
