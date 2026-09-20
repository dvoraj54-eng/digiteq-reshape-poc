# Tips App – Layout Rules (POC) · v2

Rules for adapting the Tips app from the **wide** app canvas (landscape display) to the **square** app canvas (portrait display).
Written to be read by people *and* by AI tools: every rule is concrete, and every rule in §10 is checkable.

> v2 is aligned with the Škoda HMI masters (`13_6_HM_master`). Values marked **[PLACEHOLDER]** still need confirming.

---

## 1. Displays & what the app owns

The system draws the **status bar** (top), **nav bar** and **climate bar** (bottom). The app never draws or moves these.
The app owns two areas: the **header bar** and the **content area**.

| | Landscape display (source) | Portrait display (target) |
|---|---|---|
| Full display | **[PLACEHOLDER]** | **1400 × 1840** |
| App area ("basic" template, no header) | 1840 × 1092 (derived) | **1400 × 1532** |
| Header bar | **132**, full width (assumed same as portrait) | **132**, full width |
| Content area ("content_only") | **1840 × 960** | **1400 × 1400** |
| Aspect of content | 1.92 : 1 (wide) | 1 : 1 (square) |
| Change vs. source | – | width −24 %, height +46 % |
| Density | Figma px = dp for the POC **[PLACEHOLDER]** | Figma px = dp for the POC **[PLACEHOLDER]** |
| Driver side | LHD default; RHD = mirrored variant (§8) | same |

**Key consequence:** this is *not* a 90° rotation. The app gets narrower and much taller. Side-by-side layouts often still fit; the main job is redistributing height and fixing what no longer fits in width.

## 2. Visual language (for the POC app)

- Background: full-bleed warm gradient (dark brown → copper), provided by the theme, not by screens.
- Surfaces: rounded cards (radius 12), dark translucent fill (~black 30 %), no borders.
- Accent: green (`#4ADE80`-like) for selected state, active tab underline, primary action (e.g. call button), toggles and sliders.
- Text: white primary, ~60 % white secondary.
- Controls in use: tabs with underline, segmented control (pill), slider with −/+ buttons, toggle, radio, list row with leading icon/avatar and trailing chevron.

## 3. Grid & spacing

- **Base unit: 8.** All paddings, gaps and sizes are multiples of 8 (4 allowed inside components).
- Outer margins inside the content area: **24** left/right/top/bottom (both canvases) **[PLACEHOLDER]**.
- Gaps: **16** between list rows and between related controls, **32** between panes/sections.
- **Max readable width for single-column content** (settings-style lists): **1200** on the square canvas, centred. Never stretch a list row across the full 1840.

## 4. Touch & readability (driver-safety rules – never violated)

- Minimum touch target: **76 × 76** **[PLACEHOLDER – verify against Škoda spec]**.
- Minimum gap between two touch targets: **16**.
- **Grouped controls count as one target:** a tab row, a segmented control or a radio group is checked as a whole; its segments may touch or sit closer than 16, but each segment must still be ≥ 76 in height.
- **Toggle rows:** the whole row is the touch target (≥ 76 high); the switch graphic itself may be smaller.
- Text sizes: Title 40 · Heading 32 · Body 26 · Caption 22 (sp). **Nothing below 22.**
- No truncation of P0 text. Ellipsis allowed only on P2 elements.

## 5. Element roles & priorities

Every element has exactly one **role** and one **priority**. Adaptation decides from these, not from pixel positions.

| Role | Meaning |
|---|---|
| `header` | Elements in the header bar: title, back, settings, search, selectors |
| `nav` | In-app navigation (tabs, category lists) |
| `primary` | Main content the screen exists for |
| `secondary` | Supporting content |
| `media` | Image / illustration |
| `action` | Buttons that do something |
| `overlay` | Dropdowns, popups anchored to a trigger |

| Priority | Rule on the target canvas |
|---|---|
| **P0** | Fully visible without scrolling. Never hidden or truncated. |
| **P1** | Present; may move, reflow, or require scrolling. |
| **P2** | May collapse, truncate, or move to overflow if space is short. |

## 6. Reflow patterns (wide → square)

Decide by **available width first**. Pick one pattern per region; if none fits, stop and flag.

**R1 – Keep side-by-side, re-split width**
If every pane still gets ≥ its min width on 1400 − margins, keep panes side by side. **Min width = 560 by default; a screen table in §7 can set a higher min for a pane** (e.g. settings-style card columns). Re-split proportionally; the pane with fixed-size content (e.g. dialpad) keeps its width, the flexible pane (list) absorbs the loss.

**R2 – Side-by-side → Stacked**
If a pane would drop below its min width: stack vertically. Order = priority (P0 first); media goes on top capped at **40 %** of content height.

**R3 – Use the extra height**
Content that scrolled on the wide canvas gets more visible rows (list), or larger media. Never add empty space just because height is available – fill to the first scroll or leave the rest to the background.
All rows of a list share **one height**. When a title wraps in a narrower pane, every row grows to the tallest row (content stays vertically centred) – text never overlaps and is never cut.

**R4 – Header overflow**
The landscape header holds everything in one row (e.g. settings · device selector · tabs · search).
**Measure first:** row width = padding + sum of child widths + gaps. Only if that exceeds the target width (1400): keep `header` P0 elements in the header row, move **tabs to a second row** directly under the header (still full width, same order). P2 header items go to overflow. If it fits, the header stays unchanged.

**R5 – Single-column content → centred column**
Settings-style content (stacked cards with controls) becomes a centred column, max width 1200, cards keep their internal layout.

**R6 – Overlays follow their trigger**
Dropdowns stay anchored to their trigger, open downward, keep their width, and must stay fully inside the content area (shift horizontally if needed).

**R7 – Side-by-side panes end on one line**
When a list pane cannot be filled exactly with whole rows, the panes next to it end at the list's **last visible row**; the remaining height stays free at the bottom of the content area. No pane runs past the end of its neighbour's content.

## 7. Screens (POC Tips app)

### S1 – Home
| Element ID | Role | Prio | Wide (1840 × 960) | Square (1400 × 1400) |
|---|---|---|---|---|
| `home_title` | header | P0 | Header, left | Header, left |
| `home_settings_button` | header | P1 | Header, left of title | Header, left of title |
| `home_featured_tip` | primary | P0 | Left pane, 800 wide, full height, **min width 800** | R2 → top block, full width |
| `home_category_cards` | secondary | P1 | Right pane, 2×2 card grid | R2 + R3 → below featured, 2×2 grid, taller cards |

### S2 – Category (list-detail, like the Phone/Dial screen)
| Element ID | Role | Prio | Wide | Square |
|---|---|---|---|---|
| `category_back_button` | header | P0 | Header, left | Header, left |
| `category_title` | header | P0 | Header, after back button | Header, after back button |
| `category_filter_button` | header | P1 | Header, after title (opens dropdown) | Header, after title |
| `category_tabs` | nav | P0 | Header row, centre | R4 → second row if it doesn't fit |
| `category_search_button` | header | P1 | Header, right | Header, right |
| `category_tip_list` | nav | P0 | Right pane, ~60 %, scrollable rows | R1 → right pane, narrower; R3 → more rows visible |
| `category_tip_preview` | primary | P0 | Left pane, ~40 % | R1 → left pane, width kept if ≥ 560 |
| `category_filter_dropdown` | overlay | P2 | Anchored to trigger in header | R6 |

### S3 – Tip detail (settings-style, like Exterior lighting)
| Element ID | Role | Prio | Wide | Square |
|---|---|---|---|---|
| `tip_title` | header | P0 | Header, left | Header, left (max 2 lines) |
| `tip_save_button` | header | P2 | Header, right group | Header, right group or overflow |
| `tip_back_button` / `tip_search_button` | header | P0 / P1 | Header, right group | Header, right group |
| `tip_image` | media | P1 | Left pane, 704 wide | R2 → top, ≤ 40 % height |
| `tip_body` | primary | P0 | Right pane (column of cards), **min width 800** | R2 + R5 → centred column below image |
| `tip_steps` | primary | P0 | Right column, 4 step cards | R5 → centred column below image |
| `tip_distance_setting` | action | P1 | Card with segmented control (Close / Medium / Far) | same card, in column |
| `tip_helpful_toggle` | action | P1 | Card row with toggle | same card, in column |
| `tip_prev_button` / `tip_next_button` | action | P0 | Bottom of right pane | Bottom of column, prev left / next right |

## 8. Driver side (LHD / RHD)

- Header: title on the driver side, utility buttons (back, search) on the passenger side.
- RHD variant = horizontal mirror of pane order and header order. Text, icons, sliders and number pads are **not** mirrored.
- Treat LHD/RHD as a separate, later step – the wide → square adaptation is done on LHD first.

## 9. Naming & traceability

- **Figma layer name = Android view ID = Compose test tag.** Example: `tip_steps` ↔ `@+id/tip_steps` ↔ `Modifier.testTag("tip_steps")`.
- IDs are `snake_case`, prefixed with the screen (`home_`, `category_`, `tip_`).
- The square variant **reuses the same IDs**.
- Figma frames: `S<n>_<ScreenName>_<Wide|Square>`, e.g. `S3_TipDetail_Square`.
- Implementation:
  - **XML:** wide in `res/layout/`, square in a qualifier folder (e.g. `res/layout-port/` or `res/layout-w1400dp/`), same file name.
  - **Compose:** one screen composable branching on window size / aspect.

## 10. Acceptance checks (automatable)

A reshaped screen passes when **all** hold on the target canvas:

1. Every P0 element is fully visible inside the content or header area, without scrolling.
2. Every P0 and P1 element from the source exists in the target (same ID).
3. No two touch targets overlap; gap ≥ 16 (segments inside one grouped control are exempt, §4).
4. Every touch target ≥ 76 × 76 (switch graphics inside a toggle row are exempt, §4).
5. Outer margins respected (§3); single-column content ≤ 1200 wide.
6. No text below 22 sp; no P0 text truncated.
7. Overlays are fully inside the content area.
8. Nothing drawn outside the app areas (status, nav and climate bars untouched).
9. Text never overlaps other elements and stays inside its container; list rows have one height (R3).
10. Side-by-side panes end on the same line (R7).

## 11. Layout plan format (AI output before executing)

The plan is executed by the Figma plugin ("Import LLM result"). Pane coordinates are relative to the content area; every pane of the content area appears exactly once. Decisions quote **measured** numbers, never estimates.

```json
{
  "screen": "S2_Category_Wide",
  "target": { "w": 1400, "h": 1400 },
  "mode": "side",
  "r4": false,
  "panes": [
    { "name": "category_tip_preview", "x": 24, "y": 24, "w": 560, "h": 1352, "card": "vertical" },
    { "name": "category_tip_list", "x": 616, "y": 24, "w": 760, "h": 1352 }
  ],
  "overrides": [],
  "decisions": [
    "R4 not triggered: header needs 1312 of 1400",
    "R1 side by side: 560 + 560 = 1120 <= 1320 usable; preview drops to its min 560, list gets 760"
  ],
  "open_questions": []
}
```
