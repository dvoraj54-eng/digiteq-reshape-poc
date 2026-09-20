# Design exports

Reference data from the Figma file **Tips App POC** (personal Figma account, no Škoda data).
Claude Code uses these to build the Android layouts and to compare emulator screenshots against the design.

## Naming
`<Screen>_<W>x<H>.<autolayout|flat>.json` – exported with the Digiteq Reshape Plugin (**Export JSON**).
W×H is the **content area**; every screen frame = 132 header + content.

| File | What it is |
|---|---|
| `json/S1_Home_1400x1400.autolayout.json` | Home, square target, reshaped from the auto-layout page |
| `json/S2_Category_1400x1400.autolayout.json` / `.flat.json` | Category (list–detail), square |
| `json/S3_TipDetail_1400x1400.autolayout.json` / `.flat.json` | Tip detail, square |
| `json/S2_Category_1200x1800_llm.flat.json` | Category at a custom size, planned by Claude via the Assistant |
| `json/S3_TipDetail_1200x1600.flat.json` | Tip detail at a custom size |

## Still to add (Jan, from Figma)
1. **Wide originals as JSON**: select `S1_Home_Wide`, `S2_Category_Wide`, `S3_TipDetail_Wide` on page *01 Wide · Auto layout* → Export JSON → save as `json/S1_Home_1840x960.autolayout.json` etc.
2. **PNG of every screen** (wide + square): select the frame → right panel *Export* → PNG, **1x** → save to `png/` with the same base name (`png/S2_Category_1400x1400.png`). 1x keeps Figma px = Android dp at mdpi, so screenshots are directly comparable.

The JSON has geometry and text, not colours – colours and styles are in `docs/android-app-spec.md`.
