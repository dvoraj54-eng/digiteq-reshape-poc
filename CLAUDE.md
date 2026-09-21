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
| `design-exports/json/`, `design-exports/png/` | Exports of the POC screens from Figma (`design-exports/README.md` says which are current) | No (Jan re-exports; never hand-edit) |
| `android/TipsApp/` | The Android test app (wide `layout/` + portrait `layout-port/`, same IDs) | Yes |
| `android/run-tests.sh` | One command: layout-rule tests on both emulators + screenshots | Yes |
| `tools/reshape-app/` | The reshape tool (planned – design in `docs/reshape-tool.md`) | Yes |
| `docs/` | Documentation | Keep in sync with changes |

## Commands

```bash
# Figma part
node figma/build.mjs                 # after editing figma/*-src or rules/DESIGN-RULES.md
node figma/tests/simulate.js         # must end with "0 failed" before committing figma/ changes

# Android part (run from android/TipsApp)
./gradlew assembleDebug
./gradlew installDebug
adb shell am start -n cz.digiteq.tips/.HomeActivity   # other screens are not exported: run `adb root` once first
./gradlew testDebugUnitTest          # JVM tests incl. Roborazzi screenshots
./gradlew recordRoborazziDebug       # (re)record golden screenshots – only when Jan approved the look
./gradlew verifyRoborazziDebug       # compare with goldens
./gradlew connectedDebugAndroidTest  # layout-rule tests (rules §10) on the running emulator
../run-tests.sh                      # both emulators in turn + screenshots + summary (docs/android-tests.md)

# Emulators (AVD names from docs/android-setup-mac.md)
emulator -list-avds                  # Wide_1920x1200, Portrait_1400x1840
emulator -avd Wide_1920x1200 -no-snapshot-save &
adb wait-for-device && adb shell getprop sys.boot_completed   # "1" when ready
adb shell dumpsys SurfaceFlinger --display-id                # the automotive emulator has 2 displays: use the id of EMU_display_0
adb exec-out screencap -d <id> -p > /tmp/shot.png            # -d is required, plain screencap returns a warning text; then Read the PNG
adb shell wm size; adb shell wm density                       # expect 160 dpi
```

**Look at your work.** After a UI change: install, launch, take a screenshot (`screencap -d`, see above), open it with the Read tool and compare with `design-exports/png/` (1x PNGs, Figma px = dp at 160 dpi). Say what differs. Don't claim a screen matches without having looked at it. Also compare numbers (view bounds vs the Figma JSON) – the emulator's app area is about 80 dp wider / 64 dp lower than the wide Figma frame (system bars), fixed sizes must match exactly.

## Golden rules

1. **The rules file is the contract.** Values (margins 24, gaps 16/32, touch target ≥ 76 dp, text ≥ 22 sp, header 132) come from `rules/DESIGN-RULES.md` and `docs/android-app-spec.md`. If code and rules disagree, stop and ask – don't silently pick one. If the spec and the Figma export disagree, follow the **newest Figma export/PNG** and update the spec (Jan agreed); say what you changed.
2. **View ID = Figma layer name = Compose test tag** (`tip_steps` ↔ `@+id/tip_steps` ↔ `testTag("tip_steps")`). Wide and portrait layouts use **the same IDs** and the same file names (`res/layout/` vs `res/layout-port/`).
3. **No Škoda data.** Invented content only. Never add files from Škoda/Digiteq projects to this repo. The repo is private but treat it as shareable.
4. **Generated files** (`figma/plugin/ui.html`, `figma/assistant/digiteq-reshape-assistant.html`) are rebuilt by `node figma/build.mjs`; never edit them by hand.
5. **Figma plugin sandbox:** no `import(` / `eval` / HTML comments anywhere in `code.js` – not even in comments. `simulate.js` scans for this.
6. **Versions:** use the versions the Android Studio template / `libs.versions.toml` gives you or the current stable ones – never invent version numbers. If unsure, check and say so.
7. **Small commits** with clear messages, one step at a time; run the relevant tests before each commit. Don't push unless Jan asks.
8. Keep `docs/` up to date when behaviour or commands change.

## Current phase: reshape tool and demo prep

Demo ≈ 2026-10-04, most likely a **recorded run**; it needn't be perfect, but real-life complexity must be flagged honestly.

**Done (merged to `main`):**
- **2a** wide app – tag **`wide-baseline`** (the approved wide app, start point for the demo diff).
- **2b** portrait layouts + R7 helper – tag **`portrait-manual`** (hand-made reference for comparing with the tool's PR). `git diff wide-baseline --stat -- android` = what the new display cost in code.
- **Phase 3 (slim)** 26 layout-rule tests (rules §10) on both displays + `android/run-tests.sh`; see `docs/android-tests.md`.

**Postponed:** 2c (Compose comparison, `docs/xml-vs-compose.md`), Roborazzi screenshot goldens, UI Automator check of the filter dropdown.

**Now:** the reshape tool (`tools/reshape-app/`): repo link + target display → app exports (PNG + JSON in the plugin format, current and target size) → pluggable coding agent with a system prompt → branch + PR + before/after report. Design: `docs/reshape-tool.md`. Full spec of the app: `docs/android-app-spec.md`.

**Working agreements:** small commits; bigger steps on a branch with a PR (Jan says when to merge); don't push to `main` unasked except docs/exports Jan asked for; run the relevant tests before each commit; tell Jan the exact result, including failures.

Status of the Figma part (phase 1) is described in `docs/figma-pipeline.md` – it's done; only touch it if Jan asks.

## Environment

MacBook Pro **Intel (x86_64)**, macOS 15.7, 16 GB RAM – emulator images x86_64, **only one emulator running at a time** (stop one before booting the other; builds are slower than on Apple Silicon, so avoid unnecessary clean builds). Android Studio with bundled JBR (Java 25 in the current Studio; `JAVA_HOME` set in `~/.zshrc`), SDK in `~/Library/Android/sdk`, Android Automotive emulator images "Google APIs" (no Play Store). Setup: `docs/android-setup-mac.md`. If the environment is missing something, tell Jan the exact step from that doc instead of working around it.
