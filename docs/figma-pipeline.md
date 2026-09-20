# Figma reshape pipeline – how it works and what the POC showed

**Task 1 of the Škoda demo:** take the Figma layouts of an Android Automotive app made for the wide display and reshape them – ideally automatically – for a new display, so the result still makes sense from a UI point of view.

This document describes the tools built in the POC (19–20 Sep 2026), how they work, what was tested and where the limits are.

---

## 1. The problem in one picture

| | Wide display (source) | Portrait display (target) |
|---|---|---|
| Full display | [placeholder] | 1400 × 1840 |
| App area (header + content) | 1840 × 1092 | 1400 × 1532 |
| Header | 132 | 132 |
| **Content area** | **1840 × 960** | **1400 × 1400** |

It is **not a 90° rotation**: the content gets 24 % narrower and 46 % taller. Most side-by-side layouts still fit, some must stack, headers may overflow, lists get more rows. The system bars (status, nav, climate) belong to the system and are never touched.

## 2. Architecture

```
            rules/DESIGN-RULES.md  (the contract: displays, grid, safety minimums, R1–R7, checks)
                     │
   ┌─────────────────┼──────────────────────────────┐
   ▼                 ▼                              ▼
Figma file ──► Digiteq Reshape Plugin ──────────► reshaped frame + check report
   │            (measure → plan → execute → check)   ▲
   │                 │ Export JSON                    │ Import LLM result
   │                 ▼                                │
   │         Digiteq Reshape Assistant ──► LLM ──► JSON plan / fixes
   │         (browser app: rules + facts + prompt; Claude API, internal model or copy-paste)
   ▼
Android app (layout/ + layout-port/, view IDs = Figma layer names)  ← phase 2
```

**Design principle:** the *decision* (which layout) and the *execution* (moving and resizing layers) are separated.
- Decisions come either from the plugin's rule engine or from an LLM – both produce the same small **plan** (pane positions, stack/side, tabs move, card orientation).
- Execution is always deterministic plugin code. A wrong decision can never corrupt the file; the worst case is a rejected plan or a failed check.
- The **checks** judge every result the same way, whoever planned it.

## 3. The tools

### 3.1 Digiteq Reshape Plugin (`figma/plugin/`)
Figma development plugin (desktop app). Runs locally – no MCP, no API quota, no Figma seat needed beyond edit access.

| Action | What it does |
|---|---|
| Reshape + check | Clone the selected screen → measure → plan by the rules → execute → run checks on source and output |
| Check only | Run all checks on the selected screen |
| Export JSON | Screen as JSON (names, types, positions, sizes, auto-layout settings, texts) |
| Import LLM result | Apply a plan (new frame) or fixes (in place) produced by an LLM, then check |

Target sizes: Wide 1840 × 960, Square 1400 × 1400, or custom (width 960–2560, height 600–2000, multiples of 8, aspect 0.5–3). Impossible targets are refused with a reason (e.g. *"Header needs 1058 > 960 and has no tabs to move"*).

Works on **auto-layout** files (uses Figma's layout engine) and on **flat** files (rebuilds the auto-layout behaviour: inferred constraints, spacers, stacks, tiles, text reflow).

### 3.2 Digiteq Reshape Assistant (`figma/assistant/digiteq-reshape-assistant.html`)
Single HTML file, opens in any browser. Builds the prompt from the screen JSON + the (editable) design rules + **measured facts** (header width, pane sizes, lists, cards), sends it to:
- Claude API (key in the browser),
- an internal OpenAI-compatible model (for Škoda data – nothing leaves the network),
- or nobody: *Manual* mode, copy-paste into any chat.

The answer is validated (pane names, bounds, overlaps, tab move, 8-grid) before it can be copied into the plugin. Prompt size for a typical screen ≈ 5 000 tokens.

### 3.3 Design rules (`rules/DESIGN-RULES.md`)
The single source of truth for people, the plugin and the LLM:
- displays and app areas, 8-grid, margins 24, pane gap 32, max column 1200
- driver-safety minimums: touch target 76, gap 16, text ≥ 22 sp
- element roles and priorities (P0 never hidden, P1 may move, P2 may collapse)
- reflow patterns **R1–R7** (below), per-screen tables, naming conventions, acceptance checks

| Pattern | Rule |
|---|---|
| R1 | Keep panes side by side if every pane keeps its min width (default 560, screen tables can raise it) |
| R2 | Otherwise stack – media first, capped at 40 % of the height |
| R3 | Use extra height (more list rows); all list rows share one height, wrapped text never overlaps |
| R4 | Header too wide (measured!) → tabs move to the first content row |
| R5 | Settings-style content becomes a centred column, max 1200 |
| R6 | Dropdowns stay anchored to their trigger |
| R7 | Side-by-side panes end at the list's last visible row |

## 4. The checks

| # | Check |
|---|---|
| 1–2 | Every P0 element visible and inside; every P0/P1 element still present (same ID) |
| 3–4 | Touch targets ≥ 76 × 76, gap ≥ 16 (grouped controls and toggle rows count as one target) |
| 5 | Margins respected, single column ≤ 1200 |
| 6 | No text below 22 sp |
| 7–8 | Overlays inside, nothing drawn outside the app area |
| 9 | No overlapping siblings (e.g. wrapped text running into a subtitle) |
| 10 | No element sticking out of its parent (e.g. an icon pushed over a card edge) |
| 11 | Lists use the available height (no room left for another row) |
| 12 | Buttons keep their size (they hug their label – a reshape should only move them) |
| 13 | Side-by-side panes end on one line (R7) |

Checks run on the **source and the output**. A failure only in the output was caused by the reshape; a failure in both is a rule/design conflict (e.g. the original wide design breaks R7).

## 5. What the POC showed

POC file: *Tips App POC* (personal Figma account, invented content, no Škoda data) – three screen types modelled on real Škoda screens: Home (cards), Category (list–detail like *Phone/Dial*), Tip detail (settings-style like *Exterior lighting*). Each exists as an auto-layout and as a flat (no auto layout) version.

| Test | Result |
|---|---|
| 3 screens × auto layout → Square | ✅ passes all checks |
| 3 screens × flat → Square | ✅ passes; numerically identical to the auto-layout result (±1 px rounding) |
| Custom sizes (1200 × 1600, 1200 × 1800) | ✅ incl. tabs moving out of the header (R4), text wrapping, R7 |
| Impossible sizes (960 × 600, 12 × 5) | ✅ refused with a reason |
| Round trip square → wide | ✅ |
| LLM round trip (Claude via Assistant, S2 → 1200 × 1800) | ✅ Claude chose the **same layout as the rule engine**, citing the measured numbers, and predicted the text wrapping |
| Regression suite (`figma/tests/simulate.js`) | 29 checks, run before every change |

### Lessons (each one is now a rule, a check or a test)
1. **Plan from measurements, not estimates.** The first plan guessed the header wouldn't fit. Measured: 1312 ≤ 1400. → the plugin and the Assistant always measure first.
2. **Auto layout in the source files matters.** The auto-layout screens worked on the first try; all bugs found were in rebuilding behaviour from flat files (spacers, button stretching, list clones, text wrap, row scaling). → Ask designers to keep auto layout; it lowers the cost of every future display.
3. **Checks must catch what humans see.** Twice the checks passed on a visibly broken screen. Each time a new check was added (10, 11, 12, 13) – the checks are what makes the pipeline trustworthy on screens nobody looks at.
4. **Judgement calls need a rule.** "Feels too narrow" became a per-pane min width; "the list should end with the card" became R7. The rules file grows with every surprise.
5. **Two planners, one answer.** Script and LLM reached the same layout from the same rules → the rules are clear enough to automate. Where they disagree on real screens, the rules have a gap.
6. **Figma constraints:** the Figma MCP on a free/View seat allows only a few calls per month (round 1 used them up) → the plugin approach needs no MCP at all. The plugin sandbox rejects some code patterns (e.g. `import(` even in a comment) → covered by the test suite.

## 6. Limits and open points for the real Škoda files

| Topic | Status / what's needed |
|---|---|
| Layer naming | The plugin relies on names: `…_header`, `…_content`, panes as direct content children, `…_image`, `…_tabs`, `…_row_<n>`, `…_button`, `…_dropdown`. Real files will need a naming pass or a small mapping table. |
| Components / instances | Instances are moved/resized but their insides are not rebuilt (needs component variants per display, or detaching). |
| Real content | Images, icons from libraries, variable-length and translated texts (German, Czech are longer) – text reflow handles wrapping, not truncation rules yet. |
| LHD / RHD | Not part of the POC (rules §8 prepared). |
| Hints per screen | Min widths / column panes are listed in the rules and mirrored in `code.js` (`HINTS`). New screens need entries. |
| Data governance | Real screens go only to the internal model (Assistant → OpenAI-compatible endpoint) or stay script-only. |
| Figma seats | Plugin: edit access is enough. MCP-based workflows need Dev/Full seats on a paid plan. |

## 7. Files

| Path | Content |
|---|---|
| `rules/DESIGN-RULES.md` | The contract |
| `figma/plugin/` | Plugin to import in Figma (`manifest.json`, `code.js`, `ui.html`) |
| `figma/plugin-src/`, `figma/assistant-src/` | Sources of the generated HTML (`node figma/build.mjs`) |
| `figma/assistant/` | The Assistant (open in a browser) |
| `figma/tests/simulate.js` | Regression test (`node figma/tests/simulate.js`) |
| `design-exports/` | JSON/PNG exports of the POC screens (reference for the Android app) |
| `docs/figma-howto.md` | Step-by-step use of plugin and Assistant |
