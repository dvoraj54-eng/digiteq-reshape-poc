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

## Docs

| Doc | For |
|---|---|
| [docs/kickoff.md](docs/kickoff.md) | Monday kickoff: demo definition, roles, questions, plan |
| [docs/figma-pipeline.md](docs/figma-pipeline.md) | How the Figma part works and what the POC showed |
| [docs/figma-howto.md](docs/figma-howto.md) | Step by step: plugin + assistant |
| [docs/android-setup-mac.md](docs/android-setup-mac.md) | Setting up the MacBook: Android Studio, emulators, Claude Code, GitHub |
| [docs/android-app-spec.md](docs/android-app-spec.md) | What Claude Code builds in `android/` |

## Data rule

Real Škoda screens and code go **only** to the internal model (Assistant → internal endpoint) or stay script-only. Never commit Škoda files to this repo; keep them in the company environment.
