# Digiteq Reshape POC

Reshape an Android Automotive app from the **wide** display to the **portrait** display, in **design** (Figma) and in **code** (Android), with automatic checks.
POC for the Škoda demo (Sep/Oct 2026). **Invented content only – no Škoda data in this repo.**

```
rules/DESIGN-RULES.md ─────────────── the contract (used by people, the plugin, the LLM and the Android tests)
   │
   ├─ figma/      Digiteq Reshape Plugin + Digiteq Reshape Assistant   → reshaped Figma screens + check report
   │                       │ Export JSON / PNG
   │                       ▼
   ├─ design-exports/   reference data for the app
   │                       ▼
   └─ android/    TipsApp: layout/ (wide) + layout-port/ (portrait), IDs = Figma layer names → emulator + tests
```

## Repository layout

| Folder | What | Who works here |
|---|---|---|
| `rules/` | `DESIGN-RULES.md` – displays, grid, safety minimums, reflow rules R1–R7, checks | everybody |
| `figma/plugin/` | Figma plugin (import `manifest.json` in the Figma desktop app) | Jan |
| `figma/assistant/` | LLM assistant – one HTML file, open in a browser | Jan |
| `figma/*-src/`, `figma/build.mjs` | Sources of the generated HTML files | – |
| `figma/tests/` | Regression test of the plugin (Node, Figma mocked) | – |
| `design-exports/` | JSON + PNG exports of the POC screens | input for Android |
| `android/` | Android Studio project `TipsApp` (created by Claude Code) | Jan + Claude Code |
| `docs/` | Documentation (see below) | – |
| `CLAUDE.md` | Instructions for Claude Code | – |

**Why one repo and not two:** the plugin and the app share the rules, the layer/ID names and the exports. One repo keeps them in one commit history, so a rule change and its effect on design and code can be reviewed together. The two parts don't share any build tooling – `figma/` needs only Node, `android/` only Android Studio – so they stay independent in practice.

## Quick start

```bash
# Figma part (any machine with Node 18+ – Windows, macOS, Linux)
node figma/build.mjs            # rebuild the plugin UI + assistant after editing *-src or the rules
node figma/tests/simulate.js    # 29 regression checks – must pass before committing

# Android part (MacBook, see docs/android-setup-mac.md)
cd android/TipsApp && ./gradlew installDebug
```

## How to work with what

**Golden rules**
- `rules/DESIGN-RULES.md` is the contract. Change it only when Jan agrees; if code and rules disagree, stop and ask.
- **View ID = Figma layer name = Compose test tag** (`tip_steps`). Wide and portrait layouts use the same IDs and the same file names (`res/layout/` vs `res/layout-port/`).
- Invented content only. Never commit Škoda files.
- Small commits, one step at a time; run the tests of the part you touched first. Push only when asked.

**Branches and tags**
- `main` – the agreed state. Tag **`wide-baseline`** = the wide app exactly as approved (phase 2a, "the existing app").
- Reshape work happens on its own branch (portrait: `reshape-portrait`) and is merged only after review. `git diff wide-baseline --stat` then shows what the new display cost in code.

**Figma part** (Node only, any OS): edit `figma/plugin/code.js`, `figma/plugin-src/`, `figma/assistant-src/` or the rules – **never** the generated HTML files – then `node figma/build.mjs` and `node figma/tests/simulate.js` (must end with `0 failed`). Add a test for every bug fixed.

**Design exports** (`design-exports/`): JSON via the plugin (*Export JSON*), PNG via Figma (*Export → PNG, 1x*). Naming and sizes: `design-exports/README.md`. They are the reference for the app; Jan re-exports when the design changes.

**Android part** (MacBook, one emulator at a time – stop one before booting the other):
```bash
cd android/TipsApp
./gradlew installDebug                                  # build + install on the running emulator
adb shell am start -n cz.digiteq.tips/.HomeActivity     # other screens: adb root first (activities aren't exported)
adb exec-out screencap -d <id of EMU_display_0> -p > /tmp/shot.png   # id: adb shell dumpsys SurfaceFlinger --display-id
android/run-tests.sh                                    # layout-rule tests on both emulators + screenshots (docs/android-tests.md)
```
After a UI change, look at a screenshot next to the PNG in `design-exports/png/` and list the differences. The emulator window is smaller than the Figma frame (system bars): expect the app area to be about 80 dp wider and 64 dp lower on the wide emulator; fixed sizes must match exactly. More: `android/README.md`.

**Claude Code** reads `CLAUDE.md` first. Useful prompts: "do the next step of the spec and show it on the emulator", "compare the running screen with the Figma export", "explain why you did X".

## Docs

| Doc | For |
|---|---|
| [docs/kickoff.md](docs/kickoff.md) | Monday kickoff: demo definition, roles, questions, plan |
| [docs/figma-pipeline.md](docs/figma-pipeline.md) | How the Figma part works and what the POC showed |
| [docs/figma-howto.md](docs/figma-howto.md) | Step by step: plugin + assistant |
| [docs/android-setup-mac.md](docs/android-setup-mac.md) | Setting up the MacBook: Android Studio, emulators, Claude Code, GitHub |
| [docs/android-app-spec.md](docs/android-app-spec.md) | What Claude Code builds in `android/` |
| [docs/android-tests.md](docs/android-tests.md) | The automated checks on the app and `android/run-tests.sh` |
| [docs/reshape-tool.md](docs/reshape-tool.md) | Design of the reshape tool (repo link → exports → coding agent → PR) |

## Data rule

Real Škoda screens and code go **only** to the internal model (Assistant → internal endpoint) or stay script-only. Never commit Škoda files to this repo; keep them in the company environment.
