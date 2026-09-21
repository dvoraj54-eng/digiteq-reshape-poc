# Start here – what this project is and how it fits together

Written for **Vaclav** (and anyone else who gets this repo). Reading time about 15 minutes; after that you know what exists, why, where to look, and how to run it.
Everything in this repo is **invented content – no Škoda data**. Please keep it that way.

---

## 1. The idea in one minute

A car maker changes an infotainment screen from a **wide** display (1840 × 1092 app area) to a **tall, portrait** one (1400 × 1532). Every app has to be re-designed and re-built for the new shape. That is slow, manual and hard to verify.

Digiteq Automotive (Jan leads the Škoda demo) wants to show that this can be **fast and trustworthy** with AI in the loop:

> **rules → AI plan → deterministic execution → automatic checks** – in the design (Figma) *and* in the code (Android).

The AI decides what should move where, ordinary code executes it, and automatic checks judge the result. This repo is the proof of concept (POC): a small invented app, **Tips**, reshaped from wide to portrait.

Important detail: this is *not* a 90° rotation. The screen gets 24 % narrower and 46 % taller. Side-by-side layouts often still fit; the real work is spending the extra height well and fixing what no longer fits in width.

## 2. The four parts

```
 rules/DESIGN-RULES.md ── the contract everybody uses (people, plugin, AI, tests)
        │
        ├─ figma/           1. Digiteq Reshape Plugin + Assistant   – reshape and check designs
        │                        │ Export JSON / PNG
        ├─ design-exports/  reference data from Figma (the source of truth for the app)
        │                        ▼
        ├─ android/         2. TipsApp – wide + portrait from ONE code base
        │                   3. automatic checks on the running app (26 tests, one command)
        └─ tools/reshape-app/  4. (next) the "reshape runner": repo link → AI → pull request
```

| # | Part | What it does | Status |
|---|---|---|---|
| 1 | **Figma plugin + Assistant** | Reshapes a Figma screen to the target size following the rules, checks it (touch targets, text size, overlaps, margins), and can ask an LLM for the harder cases. | Done |
| 2 | **Android app "Tips"** | 3 screens (Home, Category list–detail, Tip detail) running on two Android Automotive emulators: `Wide_1920x1200` and `Portrait_1400x1840`. Wide layouts in `res/layout/`, portrait in `res/layout-port/`. | Done |
| 3 | **Automatic checks** | 26 tests run the same rules on the *running* app on each display, plus screenshots. `android/run-tests.sh` does everything in one command. | Done |
| 4 | **Reshape runner** (tool) | Give it a link to an app repo: it photographs and measures the app, lets a coding agent rework the UI, checks the result, and opens a pull request with a before/after report. The agent is pluggable. | Designed (`docs/reshape-tool.md`), not built yet |

## 3. Key ideas (the parts that make it work)

**The rules file is the contract.** `rules/DESIGN-RULES.md` defines the displays, the grid (base unit 8, margins 24, gaps 16/32), the safety minimums (**touch targets ≥ 76 × 76 dp, gaps ≥ 16, text ≥ 22 sp** – never violated), the roles and priorities of elements, and the reflow rules:

| Rule | In plain words |
|---|---|
| R1 | Keep side-by-side if every pane still gets its minimum width (560 by default); the flexible pane absorbs the loss |
| R2 | If a pane would get too narrow, stack vertically – most important first, images on top, at most 40 % of the height |
| R3 | Use the extra height: more visible list rows, larger media; all rows keep one height |
| R4 | If the header row no longer fits, move the tabs to a second row |
| R5 | Settings-style content becomes a centred column, at most 1200 wide |
| R6 | Dropdowns stay attached to their trigger and inside the content area |
| R7 | Side-by-side panes end on the same line – the last whole list row |

Priorities decide what may give way: **P0** always fully visible; **P1** may move or scroll; **P2** may collapse.

**Same names everywhere.** A Figma layer named `tip_steps` = an Android view with `@+id/tip_steps` = (later) a Compose test tag. Wide and portrait layouts use the *same IDs and file names*. That makes design ↔ code traceable, lets the tests find elements, and lets an AI agent map a design element to code.

**Two displays, one code base.** Android picks resources by qualifier: on a portrait display it automatically uses `res/layout-port/` instead of `res/layout/`. Almost all Kotlin code is shared. The one display-dependent piece of logic (rule R7) is a small helper switched on by a resource setting.

**Checks judge, not opinions.** The tests read the Figma exports and the real view tree and report *what* is wrong, *where*, measured vs allowed – e.g. `tip_body is 616 dp wide, minimum 800`. They catch hard-rule violations; they do not know design intent (a legal but ugly layout passes). Screenshots next to the Figma PNGs cover that by eye.

## 4. Where to look (suggested reading order)

1. `README.md` – map of the repo and quick start.
2. `rules/DESIGN-RULES.md` – the contract (skim §1, §4, §5, §6, §7, §10).
3. `docs/figma-pipeline.md` – what the Figma part showed, and `docs/figma-howto.md` – how to use it.
4. `docs/android-app-spec.md` – what the app is and how the two layouts differ.
5. `docs/android-tests.md` – what the automatic checks cover (and don't).
6. `docs/reshape-tool.md` – the design of the next step, with the honest list of what is harder in a real app.
7. `design-exports/README.md` – which Figma exports are current, known differences.
8. `CLAUDE.md` – the instructions Claude Code follows in this repo (also a good summary of the working rules).

## 5. How to try it

**Figma part** (any machine with Node 18+; no Figma needed to run the tests)
```bash
node figma/build.mjs            # rebuild plugin UI + assistant after editing sources or rules
node figma/tests/simulate.js    # 29 regression checks – must end with "0 failed"
```
The plugin runs inside the Figma desktop app (import `figma/plugin/manifest.json`); the Assistant is one HTML file in `figma/assistant/` you open in a browser.

**Android part** (the MacBook setup is in `docs/android-setup-mac.md`; Android Studio + the two emulators)
```bash
cd android/TipsApp
./gradlew installDebug                                # build and install on the running emulator
adb shell am start -n cz.digiteq.tips/.HomeActivity   # start the app
../run-tests.sh                                       # both emulators in turn: tests + screenshots + summary
```
Things that surprised us (details in `android/README.md`): the automotive emulator has two displays, so screenshots need `adb exec-out screencap -d <id>`; only one emulator at a time on a 16 GB Mac; screens other than Home are not exported, so `adb root` is needed to start them from the shell.

**See the result without any setup:** the screenshots in `design-exports/png/` are the Figma designs (wide and portrait); `android/run-tests.sh` writes screenshots of the running app to `android/test-reports/`.

## 6. How we work

- **Branches and tags.** `main` = agreed state. Tag **`wide-baseline`** = the wide app exactly as approved (the "existing app"). Tag **`portrait-manual`** = the hand-made portrait reshape. `git diff wide-baseline --stat -- android` shows what the new display cost in code – that is a demo slide.
- **Small commits, PRs for bigger steps.** Jan decides when to merge. Run the relevant tests before committing.
- **Claude Code** did most of the Android work; `CLAUDE.md` tells it how to behave here. Good prompts: "do the next step of the spec and show it on the emulator", "compare the running screen with the Figma export", "explain why you did X".
- **Generated files** (`figma/plugin/ui.html`, `figma/assistant/*.html`) are never edited by hand – edit `figma/*-src/` and run `node figma/build.mjs`.
- **Exports** in `design-exports/` come from Figma and are re-exported by Jan, never hand-edited.
- **Data rule.** Real Škoda screens and code go only to the internal model or stay script-only. Never commit Škoda files here.

## 7. Where we are and what is next

Done: rules, Figma plugin + Assistant, Android app on two displays (`wide-baseline`, then the portrait reshape), 26 automatic checks on both displays.
Next: the **reshape runner** (milestones in `docs/reshape-tool.md`, about 6–7 working sessions), then repeated runs and a recorded demo run. Postponed: a Compose version of one screen for comparison, screenshot golden files.
Demo date: ask Jan (early autumn 2026; `docs/kickoff.md` has the original plan). It will probably be shown as a recording, not live.

**Honest caveats** (please repeat them when presenting): the app is tiny and invented; a real app has custom views, several modules, data-dependent states and a review process. The POC shows the *process* – measure, plan by rules, change, check – not that every real screen can be reshaped automatically.

## 8. Glossary

| Term | Meaning |
|---|---|
| AAOS | Android Automotive OS – Android running as the car's infotainment system |
| AVD | Android Virtual Device – an emulator profile (`Wide_1920x1200`, `Portrait_1400x1840`) |
| dp / sp | Density-independent pixels / scalable text pixels. Our emulators are 160 dpi, so **1 Figma px = 1 dp** |
| App area | Display minus the system bars; header bar (132) + content area |
| P0 / P1 / P2 | Element priorities (must stay visible / may move / may collapse) |
| R1–R7 | The reflow rules (table above) |
| Layer name = view ID | The naming convention that ties design and code together |
| Export JSON / PNG | Geometry + text from the Figma plugin / 1x screenshots from Figma |
| Roborazzi | A library for screenshot tests in the JVM (planned, not done yet) |
| Agent adapter | The plug-in that lets the reshape runner use any coding agent |

## 9. Access and questions

The repo is private (`dvoraj54-eng/digiteq-reshape-poc`): ask Jan for access. For anything that is unclear or looks wrong – the rules, a number, a design decision – ask Jan first; the rules file is only changed when Jan agrees.
