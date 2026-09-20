# Kickoff – Monday 21 Sep 2026

**Goal of the meeting:** agree on what the demo shows, who does what, and get the answers that unblock the next two weeks.
**Demo:** week of 28 Sep (note: **Mon 28 Sep is a public holiday** in CZ, so we have four working days that week).

---

## 1. What Škoda asked for → what we will show

| # | Ask | Demo definition (proposal) |
|---|---|---|
| 1 | AI reshaping of Figma layouts wide → new display | A real app screen (or 2–3 of them) reshaped in Figma by the **Digiteq Reshape Plugin**, with the **Digiteq Reshape Assistant** (LLM) as the route for harder screens. Every result carries a **check report** (touch targets, text sizes, overlaps, margins…). |
| 2 | Apply the changes in the app code, show it on an emulator | The same screens running in the Android Automotive emulator on **two AVDs: wide and portrait**, from the **same code base** (`layout/` + `layout-port/`). View IDs = Figma layer names, so design and code can be traced 1:1. |
| 3 | Minimal automated tests | Screenshot tests of both variants + **layout rule tests** that check the running app with the same rules as the Figma checks (IDs present, touch targets ≥ 76 dp, text ≥ 22 sp, no overlaps). |

**Story for management (2 min):** *rules → AI plan → deterministic execution → automatic checks*, in design and in code. The AI decides, code executes, checks judge – so it is fast **and** trustworthy.

## 2. What is already done (weekend POC, invented content only)

- `rules/DESIGN-RULES.md` – layout rules R1–R7 + 13 automatable checks, aligned with the Škoda HMI masters (portrait app area 1400 × 1532, content 1400 × 1400).
- **Digiteq Reshape Plugin** (Figma) – reshape, check, export, import LLM result. Works on auto-layout and flat files.
- **Digiteq Reshape Assistant** (browser) – builds the prompt from rules + measured facts, talks to Claude API, an **internal OpenAI-compatible model**, or manual copy-paste; validates the answer.
- Tested on 3 screen types (Home, list–detail, settings-style) × 2 file styles × several target sizes; LLM and rule engine produced the same layout. 27 regression checks.
- Details: `docs/figma-pipeline.md`.

Next (this week, Jan): the POC Tips app in Android (XML views, one screen also in Compose) on the MacBook emulator – proves step 2 and 3 before we touch the real app.

## 3. Roles (proposal)

| Who | Role in the demo |
|---|---|
| **Jan** | Lead, story and demo, owns the Figma tools and the POC app |
| **Vašek** | Solution architecture; how the real app handles layouts (qualifiers, fragments, custom views); implements the code part on the real app with the app developer |
| **Tomáš** | Test part: screenshot + layout rule tests, how to run them (CI or local), reuse of existing tests |
| **Karolína** (+ app developer) | Picks the demo app/screens, provides a buildable app and a developer who knows it |
| **Zdeněk** + designers | Figma files: naming, auto layout, portrait masters, LHD/RHD experience from his tool; reviews the reshaped screens |

## 4. Questions to answer on Monday

**Karolína / app developer**
1. Which app and which 2–3 screens? (Ideal: one card screen, one list–detail, one settings-style.)
2. Does the app build and run on the **AAOS emulator** without car signals / backend? If not, what needs stubbing?
3. Who is the developer for two weeks, and how many days do they have?
4. Access: repo, build instructions, signing – can it run on a machine where we can install Android Studio?

**Vašek**
5. XML views or Compose? (Mixed?) How are layouts organised today – one layout per display via resource qualifiers, or runtime logic?
6. Do view IDs relate to Figma layer names in any way? Would a mapping table be acceptable for the demo?
7. What density/dp does the real portrait display use? (We assume Figma px = dp for now.)

**Zdeněk / designers**
8. Can we get the real Figma files for the chosen screens (copy in a project where we have **edit access**)?
9. Do those files use **auto layout** and consistent layer names? (Auto layout made everything work on the first try in the POC; flat files needed a lot of inference.)
10. Are there already portrait versions of any screens (to compare AI vs. designer result)?
11. Which design rules from his RHD/LHD tool can we reuse (margins, touch targets, text sizes)? Please review `rules/DESIGN-RULES.md` [PLACEHOLDER] values.

**Tomáš**
12. Existing test setup for the app (Espresso, screenshot tests, CI)? What can we reuse?
13. Screenshot tests on JVM (Roborazzi/Robolectric) acceptable, or must tests run on the emulator?

**IT / data (whoever knows)**
14. **Internal model endpoint** for Škoda data: URL, OpenAI-compatible? Allows browser calls (CORS)? Supports JSON output / tool calling? Context size?
15. Figma seats: who has Full/Dev seats? (The plugin needs only edit access; the Figma MCP needs a paid seat.)

## 5. Risks

| Risk | Mitigation |
|---|---|
| Real Figma files are flat / badly named | Naming pass on 2–3 screens only; mapping table in the plugin; LLM route for the rest |
| Real app doesn't run on the emulator | Decide on Monday; fall back to the POC Tips app for step 2–3 and show the real screens in Figma only |
| Data governance (real screens to a cloud LLM) | Real data only via the internal model or the script-only plugin; POC uses invented content |
| Internal model weaker than Claude | The plan format is small and validated; the rule engine is the fallback; test with the model early (Tue) |
| Time (4 working days in the demo week) | Freeze the scope on Thursday 24 Sep; demo script + recorded backup video on Friday 2 Oct at the latest |
| Management expects "one click" | Show the honest pipeline: AI + checks + human review; show the numbers (time per screen before/after) |

## 6. Plan to the demo

| Day | Design (Figma) | Code | Tests |
|---|---|---|---|
| Mon 21 | Kickoff; get files + access | Get app + access | Existing setup |
| Tue 22 | Naming pass on chosen screens; first plugin run; internal model test | POC Tips app XML (Jan) | – |
| Wed 23 | Fix rules/hints for real screens | Real app builds on AAOS emulator (wide) | Screenshot test POC |
| Thu 24 | Reshaped screens reviewed by designers · **scope freeze** | `layout-port` for screen 1 | Layout rule test POC |
| Fri 25 | – | Screens 2–3 | Tests on the real app |
| Mon 28 | *holiday* | | |
| Tue 29 | Final polish | Fixes from review | Tests green |
| Wed 30 | **Dry run** with the team | | |
| Thu 1 / Fri 2 | **Demo** (+ recorded backup video) | | |

## 7. Success criteria

- 2–3 real screens reshaped in Figma, all checks green or explained.
- The same screens run on the portrait emulator from one code base, visually matching Figma.
- One command runs the tests; report shows both displays.
- Numbers for management: time per screen manual vs. with the pipeline; what still needs a human.
