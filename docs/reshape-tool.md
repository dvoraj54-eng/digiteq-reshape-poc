# Reshape tool – design (draft for Jan)

**One sentence:** give it a link to an Android app repo and a target display; it measures and photographs the app in its current state and at the target size, lets a coding agent rework the UI following our design rules, checks the result automatically, and opens a **pull request** with a before/after report.

Demo ≈ 2026-10-04, most likely as a recorded run. The POC runs on our small Tips app; every "real app" caveat is listed in §9 so it can be said out loud.

---

## 1. Why this tool

| Today (by hand) | With the tool |
|---|---|
| Figma reshape → JSON/PNG → Claude Code reads them → code | The **app itself** is the input: no Figma file needed for the code step |
| One person, one session, not repeatable | One command, same steps every time, every run leaves evidence |
| "It looks right" | Rule checks before/after (rules §10) + screenshots + a diff stat |
| Tied to Claude Code | The agent is a plug-in: any coding agent that can take a prompt file and edit files |

It is the code-side counterpart of the Figma plugin + Assistant: same rules file, same JSON format, same layer-name = view-ID convention.

## 2. Flow

```
 repo URL + ref (tag/branch)  +  target display (Portrait_1400x1840)  +  app config
        │
   1 CHECKOUT      git worktree in ~/reshape-runs/<run-id>/   (never inside this repo)
        │
   2 BUILD         ./gradlew assembleDebug (+ test APK)
        │
   3 CAPTURE  A    current display (Wide AVD):   per screen → PNG + JSON (plugin format)
   3 CAPTURE  B    same build on the TARGET AVD: per screen → PNG + JSON   ← "how it breaks"
        │
   4 CHECK  before rules §10 on B  → list of violations (the agent's to-do list)
        │
   5 CONTEXT       bundle folder: rules, app conventions, A + B exports, violations, screen→file map
        │
   6 AGENT         runs in the worktree with the system prompt (adapter: claude-code | command | manual)
        │      ┌──────────────────────────────────────────────┐
   7 VERIFY ◄──┘  build → tests on target AVD + regression on current AVD → CAPTURE C (after)
        │   fail? → violations go back to the agent (max N rounds)
   8 GUARDRAILS    only allowed paths changed? tests/rules/exports untouched?
        │
   9 PR + REPORT   new branch, draft PR, report.html (before/after images, rule table, diff stat, agent notes)
```

## 3. Inputs and outputs

| In | Notes |
|---|---|
| Repo URL + ref | e.g. `…/digiteq-reshape-poc` @ `wide-baseline` (the ref must be the un-reshaped state) |
| Target display | AVD name + size; the current display is the AVD the app was designed for |
| App config `reshape-app.json` | Screens (activity, ID prefix, P0 element IDs, grouped controls) – small, checked in next to the app or passed on the command line |
| Rules | `rules/DESIGN-RULES.md` (the contract, unchanged) |
| Agent | adapter name + options in `reshape.config.json` |

| Out | Where |
|---|---|
| Branch `reshape/<target>-<timestamp>` + **draft PR** | the app repo (base branch created from the ref) |
| `report.html` | run folder, linked from the PR |
| Exports A / B / C (PNG + JSON) | run folder |
| Agent transcript + `reshape-notes.md` | run folder |

## 4. Key decisions

### D1 – How the tool exports "Figma-style" JSON from a running app
| Option | + | – |
|---|---|---|
| **A. Instrumented exporter** (a test the tool injects into the worktree; walks the real view tree, writes JSON) | Exact: IDs, bounds, text, **font size in sp**; reuses our `ScreenChecker` code; needs no extra tools | Needs the app to build a test APK; the injected file is never committed |
| B. `uiautomator dump` | No changes to the app at all | No font sizes/colours; text rule (≥ 22 sp) can't be checked |
| C. Robolectric in the JVM | No emulator, deterministic | Adds a test setup to the app; heavier for a real app |

**Recommendation: A** for the POC (we already have it), B as a fallback when the app can't build tests. PNGs come from `adb screencap -d <main display>` in both cases.

JSON = the plugin's format (so the Assistant and our checks read both): `{ name, type: FRAME|TEXT, x, y, w, h, text?, fontSize?, children[] }`, `x/y` relative to the parent, `name` = view ID, only views with an ID that matches a configured prefix (plus their parents) are exported.

### D2 – Where the agent works
In a **git worktree outside this repo**. The tool never touches our repo's history. Consequence for real use: customer code stays in the customer's checkout, only reports/PNGs leave it.

### D3 – Agent adapters
One small interface: `run({ workdir, systemPromptFile, contextDir, task, timeoutMin }) → { exitCode, transcript }`.

| Adapter | What it does |
|---|---|
| `claude-code` | Runs Claude Code non-interactively in the worktree with the system prompt file (exact flags to be verified when implementing) |
| `command` | Any CLI agent: a command template such as `myagent --prompt {promptFile} --cwd {workdir}` |
| `manual` | Writes the bundle and waits – a person (or an IDE agent) does the work, then presses Enter |

The system prompt is **agent-neutral Markdown** (no tool names); each adapter only adds a thin header. Choosing the agent = one line in the config, like the model choice in the Assistant.

### D4 – Plan first, then code (stretch)
The agent must write `reshape-plan.md` before editing: per screen, which reflow rule (R1–R7) applies to which element and why (the format of rules §11 is the model). It ends up in the PR description. Validating the plan automatically with the plugin's checks is a stretch goal.

### D5 – Verification loop
After the agent finishes: build → layout-rule tests on the **target** AVD → regression tests on the **current** AVD (the reshape must not break the old display) → capture C. Failures (message = element, measured value, limit – exactly what `run-tests.sh` prints today) go back to the agent, at most **3 rounds**. Every round is recorded.

### D6 – Guardrails (enforced by the tool, not by trust)
- Allowed to change: `res/layout-*/`, `res/values-*/`, and a small number of Kotlin lines (reported in the PR).
- **Never** changed: tests, screenshot goldens, `rules/`, `design-exports/`, build files except dependency-free config. If touched → the tool reverts those paths and marks the run *failed*.
- No new dependencies, no invented content, all view IDs preserved (the traceability test proves it).
- Branch + **draft** PR only; never `main`.

### D7 – Output: PR and report
PR description is generated from a template: what changed per screen, rules applied, `git diff --stat` split into "new qualifier files" vs "other files", rule table before/after, links to before/after images, **open questions the agent listed**, run cost (time, rounds).
`report.html`: for each screen a row *current | target-before | target-after* with the rule violations under each; readable without GitHub – the demo hero page.

## 5. System prompt – outline (the file is written in milestone M3 and reviewed with you)

`tools/reshape-app/prompts/system.md`, sections:

1. **Role and goal** – reshape this app's UI for the target display, following the contract, with minimal change.
2. **What you get** – the context bundle: layout of the folder, how to read the JSON, what "before at target" shows.
3. **The contract** – priorities in order: safety minimums (touch ≥ 76, gap ≥ 16, text ≥ 22 sp, never violated) → P0 elements visible → reflow rules R1–R7 → margins/grid → looks like the design. The rules file is quoted verbatim, not paraphrased.
4. **This codebase's conventions** – view ID = layer name, same IDs and file names in `layout/` and `layout-port/`, tokens in `values/`, no display-dependent logic in Kotlin except a reusable helper when a rule needs it, don't duplicate what a resource qualifier can express.
5. **Procedure** – read evidence → write the plan → implement per screen → build → run the checks → look at the after-images → fix → stop when all checks pass or the round limit is reached.
6. **Hard constraints** – the guardrails of D6, stated as rules with the reason.
7. **When unsure** – write the question to `questions.md` and choose the least risky option; never invent data.
8. **Final output** – `reshape-notes.md`: changes per screen, rules applied, what you are unsure about, what you did *not* do.

Principles: short, concrete, checkable; each rule says *why*; examples taken from our own screens; no praise or role-play filler.

## 6. Repository layout

```
tools/reshape-app/
  reshape.mjs            CLI:  node tools/reshape-app/reshape.mjs --repo <url> --ref <ref> --target Portrait_1400x1840
  lib/checkout.mjs  build.mjs  capture.mjs  verify.mjs  guardrails.mjs  pr.mjs  report.mjs
  lib/agents/            claude-code.mjs  command.mjs  manual.mjs
  exporter/              ExportScreens.kt  (injected into the worktree, not committed there)
  prompts/system.md
  templates/             pr-body.md  report.html
  reshape.config.json    agent, max rounds, AVD names, paths
  README.md
```
Node (like `figma/`), no extra dependencies where possible; `adb`, `emulator`, `gradlew`, `git`, `gh` are called as external commands. Run folders live in `~/reshape-runs/`, never in the repo.

## 7. Milestones

| # | Result | Acceptance | Sessions |
|---|---|---|---|
| M1 | **Capture**: run the app on an AVD, per screen PNG + JSON in the plugin format | Layer names of our 3 screens ⊇ the names in `design-exports/json`; sizes match the earlier comparison | 1 |
| M2 | **Skeleton**: checkout → build → capture A and B → "before" rule check → context bundle | One command produces the run folder for `wide-baseline` → Portrait | 1 |
| M3 | **Agent**: system prompt, adapters (`claude-code`, `command`, `manual`), verify loop, guardrails | A run ends with all 26 tests green on both AVDs, or a clear failure list | 1–2 |
| M4 | **PR and report**: branch, draft PR, `report.html` | PR opens with the template filled; report readable offline | 1 |
| M5 | **Runs and polish**: ≥ 3 runs from `wide-baseline`; compare with tag `portrait-manual` (diff stat, tests, images); tune the prompt; record the best run; "real app" slide | A comparison table run-vs-manual; one recording | 2 |

≈ 6–7 sessions; the demo is in ~2 weeks, so there is buffer. If time runs short, the cut line is: keep M1–M3 + a simple text report, drop the HTML report and the plan validation.

## 8. Demo

Not live (agent runs vary and take minutes). Show: the command, the run folder, the report page (current | target-before | target-after), the PR on GitHub with its diff stat, then the comparison with the hand-made version. Keep 2–3 real runs as evidence that the process repeats, including one that needed a second round.

## 9. What is harder in a real app (to say out loud)

- Custom views, fragments/navigation graphs, several modules and product variants; not "one activity per screen".
- Data-dependent states (empty, long text, errors, loading) – the tool captures the states the config lists, not all of them.
- Layout code in Kotlin or Compose instead of XML; existing themes and design systems; RTL/LHD-RHD (rules §8).
- Long builds, flaky emulators, and a review process – the PR is a proposal, a human owns it.
- Code and screenshots must not leave the customer environment: the agent adapter decides where the code goes (local/on-prem agent vs cloud).
- Visual quality beyond the rules (the tests don't know design intent – see `docs/android-tests.md`).

## 10. Out of scope (POC)

Compose apps, pushing results back into Figma, non-Android apps, automatic screen discovery (screens come from the config), parallel emulators, learning from earlier runs.

## 11. Open questions for you

1. **Exporter (D1):** OK with option A (injected instrumented test) as the default, uiautomator as fallback?
2. **Second agent for the demo:** should the `command` adapter be shown with another agent your team could use? If yes, which one is realistic to have on the demo laptop?
3. **Name:** "Digiteq Reshape Runner"? (folder is `tools/reshape-app/` either way.)
4. **PR target for the demo:** our own repo with a base branch created from `wide-baseline` – OK, or a separate demo repo so `main` stays untouched?
5. **Screens config:** fine to keep it as a small JSON next to the app, filled by hand for the POC?
