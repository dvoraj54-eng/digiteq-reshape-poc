# Android tests – what they check and how to run them

The Android part is checked against the **same rules the Figma plugin checks** (`rules/DESIGN-RULES.md` §10), on the real view tree of the running app – once on the wide display, once on the portrait display. Same tests, different `res/` folder (`layout/` vs `layout-port/`), so a test that is green on both proves the reshape didn't break either display.

## One command

```bash
android/run-tests.sh             # wide, then portrait (about 6–8 minutes on the Intel Mac)
android/run-tests.sh portrait    # one display only
HEADLESS=1 android/run-tests.sh  # emulator without a window
```

Per display it stops any running emulator, boots the AVD (`Wide_1920x1200`, `Portrait_1400x1840`), runs `connectedDebugAndroidTest`, takes a screenshot of S1/S2/S3 and shuts the emulator down (16 GB RAM: one emulator at a time). At the end it prints one line per display and, for each failure, **what** is wrong and **where**:

```
  Wide_1920x1200       26/26 passed
  Portrait_1400x1840   22/26 passed   <-- FAILED
      x TipDetailRulesTest.bodyColumnWidthIsWithinLimits
          - tip_body is 616 dp wide, minimum 800
```

Results (test XML, Gradle log, screenshots, HTML report) are in `android/test-reports/<timestamp>/` (git-ignored). Exit code 0 = everything passed.

Already have an emulator running? `cd android/TipsApp && ./gradlew connectedDebugAndroidTest`, or one class: `-Pandroid.testInstrumentationRunnerArguments.class=cz.digiteq.tips.rules.CategoryRulesTest`.

## What is checked

Every screen (`HomeRulesTest`, `CategoryRulesTest`, `TipDetailRulesTest`) runs the same base checks (`ScreenRulesTest` + `ScreenChecker`, `app/src/androidTest/.../rules/`):

| Rules §10 | Test | How |
|---|---|---|
| 2, 9 traceability | `everyFigmaLayerExistsAsViewId` | Reads the Figma export for the current display (`design-exports/json/`, wide: `*_1840x960.flat.json`, portrait: `*_1400x1400.*.json`) and asserts every layer named `home_*` / `category_*` / `tip_*` exists as a view id. The dropdown (a PopupWindow) is excluded. |
| 1 P0 visible | `p0ElementsAreFullyVisible` | P0 elements (rules §7) exist, are shown, not clipped and inside the app area (window minus system bars) |
| 4 touch size | `touchTargetsAreAtLeast76` | every clickable view ≥ 76 × 76 dp (the switch graphic isn't clickable – the row is) |
| 3 touch gaps | `touchTargetsAreAtLeast16Apart` | no two clickable views (different parents included) overlap or are closer than 16 dp; the tab row and the segmented control are exempt (§4) |
| 6, 9 text | `textIsAtLeast22spAndNotTruncated` | every visible TextView ≥ 22 sp, not truncated, not clipped by its own view |
| 9 geometry | `nothingOverlapsOrSticksOut` | siblings don't overlap, children stay inside their parent (scroll content and stacked FrameLayouts excluded) |
| 5, 8 margins | `contentStaysInsideTheAppAreaWithMargins` | header and content stay inside the app area; the panes keep 24 dp to its edges |

Screen specific:

| Screen | Test | Rule |
|---|---|---|
| S2 | `allListRowsAre104dpHigh` | R3: one row height |
| S2 | `previewKeepsAtLeast560dp` | R1: preview pane ≥ 560 |
| S2 | `listAndPreviewEndOnOneLine` | R7: both panes end on one line; in portrait the list is a whole number of rows |
| S3 | `bodyColumnWidthIsWithinLimits` | R5: ≥ 800 wide, single column ≤ 1200 |
| S3 | `portraitColumnIsStackedAndCentred` | R2 + R5: image above body, both centred, image ≤ 40 % of the content height (portrait only) |

Sizes are dp; the emulators run at 160 dpi, so 1 dp = 1 Figma px.

## What is *not* checked (yet)

- **Design intent.** The tests catch violations of the hard rules, not "does this look like the Figma design". Example: the unreshaped *wide* Home layout on the portrait display passes every rule, although the design wants it stacked. Visual comparison stays with the screenshots vs `design-exports/png/` (and later golden screenshots).
- **The filter dropdown overlay** (§10.7) – it lives in a separate window; needs UI Automator.
- P1/P2 existence beyond what the Figma export lists, driver side (§8) and the tab-row reflow R4 (not triggered at 1400).

## Evidence that the tests can fail

- Injecting four faults (a 60 dp button, a 20 sp title, 12 dp between header buttons, a renamed `tip_steps` id) failed exactly the five matching tests, each with a message naming the element and the measured value.
- Hiding `layout-port/` and running on the portrait display (= the app *before* the reshape) failed 4 tests: truncated row titles on S2, S3 column not centred, `tip_body` 616 dp wide (< 800), clipped step texts. With `layout-port/` all 26 pass.

## Adding a check

Add a method to `ScreenChecker` that returns a list of violation strings (empty = passed), call it from `ScreenRulesTest` (all screens) or a screen subclass. Keep messages in the form *what is wrong, which element, measured vs. allowed* – the run summary prints them.
