# Android test app – spec (for Claude Code)

**What:** the *Tips* app from the Figma POC as a real Android Automotive app, running on two emulators – **wide** and **portrait** – from one code base.
**Why:** proves steps 2 and 3 of the Škoda demo (apply the reshaped design in code, run minimal automated tests) before we touch the real app, and lets Jan compare XML Views with Compose.

Sources of truth, in this order: `rules/DESIGN-RULES.md` → this spec → `design-exports/` (JSON geometry + PNGs) → Figma file *Tips App POC* (Jan).

---

## 1. Project

| | |
|---|---|
| Location | `android/TipsApp/` (Android Studio template *Empty Views Activity*, Kotlin, Gradle Kotlin DSL, version catalog) |
| Package / applicationId | `cz.digiteq.tips` |
| App name | `Tips (POC)` |
| minSdk / target | minSdk 29, target/compile = latest stable the template offers (≥ 35) |
| UI | **XML Views + ViewBinding** (phase 2a); Compose added in phase 2c for S3 only |
| Dependencies | AndroidX core/appcompat/material/constraintlayout from the template. Nothing else in 2a. |
| Data | Static, in Kotlin (`data/TipsRepository.kt`) – texts in §6. No network, no database, no car APIs. |
| Theme | `Theme.Material3.Dark.NoActionBar` based; **no ActionBar/Toolbar** – the 132 dp header is part of each layout |
| Font | **Inter** (OFL licence) bundled in `res/font/` (Regular, Medium, SemiBold, Bold). Downloadable fonts may not work on the Google APIs emulator image. Fallback: `sans-serif` / `sans-serif-medium`. |
| Icons | Material Symbols vector drawables (*New → Vector Asset*): `settings`, `arrow_back`, `search`, `bookmark`, `expand_more`, `chevron_right`, `lightbulb`, `image`, `directions_car`, `airline_seat_recline_normal`, `eco`, `shield` |

### Android Automotive specifics
Add to the manifest:
```xml
<uses-feature android:name="android.hardware.type.automotive" android:required="false" />
```
- The app is a normal (non-distraction-optimised) app: it is visible only while the car is **parked**. The emulator starts parked – see setup doc if the app vanishes.
- Don't set `screenOrientation`; AAOS ignores it and our layouts are chosen by resource qualifiers.
- Activities: `HomeActivity` (launcher), `CategoryActivity`, `TipDetailActivity`; phase 2c adds `TipDetailComposeActivity` with its own launcher entry `Tip (Compose)`. One activity per screen keeps tests simple (`ActivityScenario`).

## 2. Two displays, one code base

**Order of work – like the real project:**
1. **2a – wide only.** Build all three screens for the wide display (`layout/`), navigation included, as if this were the existing app. Commit and `git tag wide-baseline`.
2. **2b – apply the reshape.** Add `layout-port/` from the reshaped Figma screens. Aim: the change is (almost) only new files in `layout-port/` plus the R7 helper; Kotlin screen code stays the same because the IDs are the same. `git diff --stat wide-baseline` becomes a demo slide: *"this is what the new display cost in code"*.
Design the wide layouts in 2a with this in mind: IDs exactly as in Figma, no layout logic in Kotlin that depends on the display, tokens in `values/`.


| Emulator | Window (approx.) | Resource folder | Figma frame |
|---|---|---|---|
| `Wide_1920x1200` (landscape, 160 dpi) | ~1920 × (1200 − system bars) | `res/layout/` | `S*_Wide`: 1840 × 1092 (header 132 + content 960) |
| `Portrait_1400x1840` (portrait, 160 dpi) | 1400 × (1840 − system bars) | `res/layout-port/` | `S*_1400x1400`: 1400 × 1532 (header 132 + content 1400) |

- **Same file name, same view IDs** in both folders (`activity_home.xml` in `layout/` and `layout-port/`).
- Figma px = **dp** (160 dpi → 1 px = 1 dp). Use the Figma numbers directly, text sizes in **sp**.
- The emulator window is not exactly the Figma frame (system bars differ). Therefore: **fixed sizes for components** (buttons, rows, icons, pane widths that the rules fix), **constraints/weights for what fills the window** (content area, the flexible pane). Never hard-code 960 or 1400 as content height.
- Shared pieces (header buttons, list row, category card, step card) as `<include>` layouts or small custom views in `res/layout/` only (no `-port` copy) – only screen layouts differ between displays.
- Tokens in `values/colors.xml`, `values/dimens.xml`, `values/styles.xml` (text appearances). Only put a value in `values-port/` if it really differs.

## 3. Visual tokens (from the Figma file)

| Token | Value |
|---|---|
| Screen background | Linear gradient, diagonal top-left → bottom-right, `#231915` → `#9A5A36` (`drawable/bg_screen.xml`, set on the root) |
| Header | Height **132**, fill black 15 % (`#26000000`), padding 24 (S3: left 40), item spacing 24, content vertically centred |
| Icon button | **76** circle, white 10 % (`#1AFFFFFF`), icon 32 white |
| Title | Inter Bold **40** sp white (S3 header title 36 sp, max 2 lines) |
| Filter pill (S2) | White 10 %, radius 38, height 76, padding L32 / R24, label Medium 26 sp + `expand_more` 28 |
| Tabs (S2) | Each tab height 96, padding 40 horiz., label 26 sp. Selected: `#4ADE80` SemiBold + 4 dp underline `#4ADE80` at the bottom. Others: Medium, white 85 % |
| Content area | Padding **24**, gap between panes **32** |
| Card | Black 30 % (`#4D000000`), radius 16, padding 32, inner gap 20 |
| Media placeholder | White 8 %, radius 12, centred `image` icon 64 (S3: 96), white 40 % |
| Label "TIP OF THE DAY" / meta | SemiBold 22 sp `#4ADE80` (meta text white 60 %) |
| Card title | Bold 40 sp white (featured / preview) |
| Body text | 26 sp white 65 % |
| Primary button | Fill `#4ADE80`, height **76**, radius 38, padding horiz. 48, label SemiBold 26 sp `#1E1512`. **Wraps its label** – never stretched |
| Category card (S1) | Card style; icon background 76 circle `#4ADE80` at 16 % (`#294ADE80`) with icon 36 `#4ADE80`; title SemiBold 32 sp; count 22 sp white 60 %; padding 32; title/count at the bottom |
| List row (S2) | Height **104**, black 30 %, radius 16, padding 24, gap 24; leading 56 circle white 10 % with `lightbulb` 28; title SemiBold 26 sp; subtitle 22 sp white 60 %; trailing `chevron_right` 28; rows **16** apart. Selected row: 2 dp stroke `#4ADE80` |
| Scrollbar (S2) | 6 wide, track white 12 %, thumb 180 high white 90 %, 16 right of the rows (custom drawable is fine; must be visible, not auto-hiding) |
| Dropdown (S2) | `PopupWindow` anchored below the filter pill, width 452, fill `#F51F1F1F`, radius 16, padding 16; options 420 × 88, radius 12, white 6 %, gap 12; label 26 sp; radio 28 (checked = `#4ADE80`) |
| Step card (S3) | Card style with padding 16 / 24, height 88; number circle 56 with 2 dp stroke `#4ADE80`, number SemiBold 26 sp; text 26 sp white 90 %; cards 16 apart |
| Segmented control (S3) | Container white 8 %, radius 44, padding 6; options height 76, radius 38, equal widths; selected option: 2 dp stroke `#4ADE80`, label SemiBold |
| Toggle row (S3) | Card style, height 96, label 26 sp; switch 88 × 48 track `#4ADE80`, knob 40 `#1E1512` (a styled `MaterialSwitch` is fine). **The whole row is the touch target** |
| Prev / Next (S3) | Prev: white 12 %, padding L32 / R48, `arrow_back` + "Previous". Next: `#4ADE80`, padding L48 / R32, "Next tip" + arrow forward |

Touch targets ≥ **76 × 76 dp**, gap ≥ 16 (rules §4). Text ≥ **22 sp** everywhere.

## 4. Screens

Geometry below is the content area (below the 132 header), in dp, from the Figma frames. Exact numbers: `design-exports/json/*` – wide sources are `*_1840x960.flat.json`, portrait targets `*_1400x1400.*`.

### S1 Home – `activity_home.xml`
Header: `home_settings_button`, `home_title` ("Tips"), left-aligned.

| | Wide (`layout/`) | Portrait (`layout-port/`) |
|---|---|---|
| Arrangement | Side by side (R1) | Stacked (R2) |
| `home_featured_tip` | Left, **800** wide, full height. **Vertical card:** image on top (full width, 340 high), then label, title, body, spacer, `home_featured_tip_open_button` at the bottom | Top, full width, **600** high. **Horizontal card:** image left (568 wide, full height), text column right: label, title, body, spacer, button at the bottom |
| `home_category_cards` | Right, fills the rest (960), 2 × 2 grid, gaps 32 | Below, fills the rest (1352 × 720), 2 × 2 grid, gaps 32 |
| Card IDs | `home_category_card_driving`, `_comfort`, `_efficiency`, `_safety` (+ `…_title`, `…_count`) | same |

Tap a category card → `CategoryActivity` (Driving). Tap "Read tip" → `TipDetailActivity`.

### S2 Category – `activity_category.xml` (list–detail)
Header, one row: `category_back_button`, `category_title` ("Driving"), `category_filter_button` ("Newest"), `category_tabs` (All · Assistants · Parking · Winter, "Assistants" selected) centred in the free space, `category_search_button` right.
The header was measured to fit in 1400 (1312 ≤ 1400), so **tabs stay in the header in both variants** (R4 not triggered). If Jan later tests a narrower display, R4 moves `category_tabs` to a row under the header.

| | Wide | Portrait |
|---|---|---|
| Arrangement | Side by side (R1) | Side by side (R1 – both panes keep ≥ 560) |
| `category_tip_preview` (card) | Left, **704** wide: image (full width × 300), meta, title, body, spacer, `category_open_button` at the bottom | Left, **560** wide: image 496 × 344, same order |
| `category_tip_list` | Right, fills the rest (1056): `category_tip_list_rows` + `category_tip_list_scrollbar` | Right, fills the rest (760) |
| Rows visible | 7 | 11 (R3: extra height = more rows) |

- Rows: a vertical `LinearLayout` in a `ScrollView` with **11 static rows** `category_tip_row_1 … _11` (IDs matching Figma; `…_title`, `…_subtitle` inside). Row 1 selected. (A RecyclerView would lose the 1:1 IDs; for 11 static items this is simpler and fine.)
- **R7 in code:** after layout, set the list pane height to a whole number of rows (`n = floor((available + 16) / 120)`, `h = n × 120 − 16`) and give the preview card the same height, so both panes end on one line. Put it in a small reusable helper (`RowAlignedPanes` / `doOnLayout`) – it is a demo point: *the rule from the rules file is implemented once and works on both displays*.
- Filter pill → `category_filter_dropdown` (PopupWindow, options `category_filter_option_1..3`), anchored under the pill (R6), must stay inside the window.
- Tap a row → selects it and updates the preview. "Open tip" → `TipDetailActivity`.

### S3 Tip detail – `activity_tip_detail.xml` (settings-style)
Header: `tip_title` (left, padding 40, 36 sp, max 2 lines), right group `tip_header_actions`: `tip_save_button`, `tip_back_button`, `tip_search_button` (gap 16).

| | Wide | Portrait |
|---|---|---|
| Arrangement | Side by side | Stacked (R2 + R5): centred column **max 1200** wide |
| `tip_image` | Left, **704** × full height | Top, 1200 × **448** (≤ 40 % of height) |
| `tip_body` (column) | Right, fills the rest (1056) | Below the image, 1200 wide, fills the rest |

`tip_body` contents, top to bottom, gap 16: `tip_steps` (4 step cards `tip_step_1..4` with `tip_step_n_number`, `tip_step_n_text`) · `tip_distance_setting` (card: label + `tip_distance_segmented` with `tip_distance_option_close|medium|far`, "Medium" selected) · `tip_helpful_toggle` (row with `switch`) · flexible space · `tip_nav` (`tip_prev_button` left, `tip_next_button` right) at the bottom.

Back → finish. Segmented control and toggle work locally (state only). Next/Previous cycle through tips.

## 5. Phase 2c – Compose comparison (S3 only)

- Add Compose to the project (BOM + `ui`, `material3`, `ui-tooling-preview`, `activity-compose`; versions from the current stable BOM – don't guess).
- `TipDetailComposeActivity` → `TipDetailScreen()`: **one composable** that decides wide vs portrait from the window (`BoxWithConstraints` or `LocalConfiguration`: width > height → side by side, else column max 1200). Same tokens (a small `TipsTheme`).
- Every element gets `Modifier.testTag("<same id as XML>")`; set `semantics { testTagsAsResourceId = true }` on the root so UI Automator / screenshots see the same IDs.
- Two `@Preview`s with `widthDp/heightDp` = 1840 × 1092 and 1400 × 1532.
- Then write `docs/xml-vs-compose.md` (one page): lines of code per variant, what changed between wide and portrait in each, previews, testing, what we'd recommend for the real app **given it is XML today**.

## 6. Content (invented – no Škoda data)

- **Featured tip:** label "TIP OF THE DAY", title "Let adaptive cruise control handle stop-and-go traffic", body "In traffic jams, ACC can bring the car to a full stop and move off again. Tap Resume or the accelerator to continue.", button "Read tip".
- **Categories:** Driving 14 tips · Comfort 9 tips · Efficiency 11 tips · Safety 8 tips.
- **Tips (list rows, subtitle "<Tab> · <n> min"):** Stop-and-go with adaptive cruise control · Keep your lane with Lane Assist · Park hands-free with Park Assist · Use the area view camera · Pre-heat the cabin before winter drives · Clear foggy windows fast · Adjust the steering assist level · + 4 more of your own in the same style (11 total).
- **Preview (row 1):** meta "ASSISTANTS · 2 MIN READ", body "ACC keeps a set distance to the car ahead and can brake to a full stop in traffic jams.", button "Open tip".
- **Tip detail steps:** 1 "Press the ACC button on the steering wheel." · 2 "Set your speed with SET, then choose a following distance." · 3 "In a jam, the car stops and waits behind the vehicle ahead." · 4 "Tap RES or the accelerator to move off again." Setting "Try it: following distance" (Close / Medium / Far). Toggle "Show this tip again next time". Buttons "Previous", "Next tip".

Strings in `res/values/strings.xml`.

## 7. Phase 3 – minimal automated tests

Keep it small and demo-able. Three kinds:

**a) Screenshot tests – JVM, deterministic (Roborazzi + Robolectric)**
- One test class per screen; each captures **both** variants via Robolectric qualifiers:
  wide `@Config(qualifiers = "w1840dp-h1092dp-land-mdpi")`, portrait `@Config(qualifiers = "w1400dp-h1532dp-port-mdpi")` – exactly the Figma app areas, so the images line up with `design-exports/png/`.
- Goldens in `android/TipsApp/app/src/test/screenshots/` (committed). `recordRoborazziDebug` only after Jan approved the look; `verifyRoborazziDebug` in the test run.
- Bonus (report, not pass/fail): a side-by-side image *Figma PNG | app screenshot | diff* per screen into `build/reports/figma-compare/`.

**b) Layout-rule tests – instrumented, on the emulator** (`app/src/androidTest/`)
The same rules the Figma plugin checks (rules §10), now on the running app. A small helper walks the view tree of each Activity and asserts:
1. **Traceability:** every Figma layer name from `design-exports/json/<screen>_1400x1400.autolayout.json` that matches `^(home|category|tip)_` exists as a view ID (exclude the dropdown subtree, which only exists when open). Make the JSON files available via `sourceSets["androidTest"].assets.srcDir("../../../design-exports/json")`.
2. P0 elements (rules §7) visible and fully inside the window.
3. Every clickable view ≥ 76 × 76 dp; gap between clickable siblings ≥ 16 dp (segments of one control and toggle rows exempt, §4).
4. Every TextView ≥ 22 sp.
5. No overlapping siblings; no child sticking out of its parent (clipping by design, e.g. scroll content, excluded).
6. S2: list pane and preview card end on the same line (R7), all rows 104 dp.
7. S3 portrait: body column ≤ 1200 dp and centred.
Run on each emulator: `./gradlew connectedDebugAndroidTest`. The test reads the display shape at runtime and asserts the variant-specific rules.

**c) Compose (2c):** `createAndroidComposeRule<TipDetailComposeActivity>()` – same IDs by test tag, `assertHeightIsAtLeast(76.dp)` for buttons, one screenshot per variant.

**One command for the demo:** `android/run-tests.sh` – runs the JVM tests, then for each AVD (`Wide_1920x1200`, `Portrait_1400x1840`): boot → wait for `sys.boot_completed` → `connectedDebugAndroidTest` → screenshot of each screen → shut down. Prints a short summary (passed/failed per display) and the path to the reports.

## 8. Definition of done

- [ ] `./gradlew assembleDebug` builds with no warnings from our code.
- [ ] 2a: all three screens run on the wide emulator; tag `wide-baseline` set.
- [ ] 2b: all three screens run on **both** emulators; navigation Home → Category → Tip detail → back works.
- [ ] Emulator screenshots match `design-exports/png/` closely (same arrangement, sizes within a few dp; fonts may differ slightly) – checked by looking, differences listed.
- [ ] Same view IDs in `layout/` and `layout-port/`; layer names from the Figma export all found (test 7b-1).
- [ ] S3 in Compose with the same test tags; `docs/xml-vs-compose.md` written.
- [ ] `android/run-tests.sh` green on both displays.
- [ ] `docs/` updated (how to run, what the tests check).

## 9. Working style for this phase

1. Before step 1: check the environment (`adb`, `emulator -list-avds`, `java -version`) and ask Jan to add the missing wide JSON + PNG exports if `design-exports/png/` is empty (you can start with the portrait JSON and the wide numbers in this spec).
2. 2a first, wide only – don't create `layout-port/` before Jan says the wide app is done. Then one screen at a time: build → install → screenshot → compare → show Jan → commit.
3. When the rules don't answer a layout question, ask – that question probably belongs in `rules/DESIGN-RULES.md` too.
