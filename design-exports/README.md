# Design exports

Reference data from the Figma file **Tips App POC** (personal Figma account, no Škoda data).
Claude Code uses these to build the Android layouts and to compare emulator screenshots against the design.

## Naming
`<Screen>_<W>x<H>.<autolayout|flat>.json` – exported with the Digiteq Reshape Plugin (**Export JSON**).
W×H is the **content area**; every screen frame = 132 header + content.

| File | What it is |
|---|---|
| `json/S1_Home_1840x960.flat.json` | **Home, wide source** (the original design) |
| `json/S2_Category_1840x960.flat.json` | **Category (list–detail), wide source** |
| `json/S3_TipDetail_1840x960.flat.json` | **Tip detail, wide source** |
| `json/S1_Home_1400x1400.autolayout.json` | Home, square target, reshaped from the auto-layout page |
| `json/S2_Category_1400x1400.autolayout.json` / `.flat.json` | Category (list–detail), square |
| `json/S3_TipDetail_1400x1400.autolayout.json` / `.flat.json` | Tip detail, square |
| `json/S2_Category_1200x1800_llm.flat.json` | Category at a custom size, planned by Claude via the Assistant |
| `json/S3_TipDetail_1200x1600.flat.json` | Tip detail at a custom size |

## PNGs (Figma export, 1x)
`png/<Screen>_<Wide|Square>_<W>x<H>.png` – the whole screen frame (header + content) at 1x, so **1 Figma px = 1 dp** on the 160 dpi emulators.

| File | Size |
|---|---|
| `png/S1_Home_Wide_1840x1092.png`, `png/S2_Category_Wide_1840x1092.png`, `png/S3_TipDetail_Wide_1840x1092.png` | 1840 × 1092 (wide) |
| `png/S1_Home_Square_1400x1400.png`, `png/S2_Category_Square_1400x1400.png`, `png/S3_TipDetail_Square_1400x1400.png` | 1400 × 1532 (square content, 1400 × 1400 + 132 header) |

To export: select the frame → right panel *Export* → PNG, **1x**.

The JSON has geometry and text, not colours – colours and styles are in `docs/android-app-spec.md`.
Exports without a `layout` field come from the flat page; the geometry is identical to the auto-layout page.
