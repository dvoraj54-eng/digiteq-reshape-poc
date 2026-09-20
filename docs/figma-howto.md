# Digiteq Reshape Plugin (Figma) + Digiteq Reshape Assistant (LLM app)

Two tools, one pipeline:

```
Digiteq Reshape Plugin: Export JSON ──► Digiteq Reshape Assistant (rules + target + LLM) ──► JSON ──► Digiteq Reshape Plugin: Import LLM result ──► checks
```

The plugin can also reshape on its own (script rules, no LLM). The LLM route is for screens the script doesn't handle well, or to fix what the checks flag.

---

## A. Digiteq Reshape Plugin (Figma)

Figma **desktop app**, logged in with the account that can edit the file.

### Install / update
1. The plugin lives in `figma/plugin/` (`manifest.json`, `code.js`, `ui.html`).
2. **Plugins → Development → Import plugin from manifest…** → `manifest.json` (only once; later just replace the files).
   After the rename to *Digiteq Reshape Plugin*: if the old name still shows, remove the plugin under **Plugins → Development → Manage plugins in development** and import `manifest.json` again.
   The window loads the Figtree font from Google Fonts (allowed in the manifest); offline it falls back to the system font.

### Use
1. Run **Plugins → Development → Digiteq Reshape Plugin**. The window stays open.
2. Click a screen frame on the canvas (header 132 + content).
3. Choose the target content area: **Wide 1840 × 960**, **Square 1400 × 1400** or **Custom** (width 960–2560, height 600–2000, multiples of 8, aspect 0.5–3; the 132 header is added).
4. Actions:
   - **Reshape + check** – script reshape into a new frame `<Screen>_<W>x<H>` (placed right of everything, outputs stack below each other) + checks.
   - **Check only** – checks on the selected frame.
   - **Export JSON** – the selected screen as JSON (input for the Digiteq Reshape Assistant).
   - **Import LLM result** – paste the JSON (or the model's whole answer) and **Apply JSON**:
     - a **plan** (has `panes`) → select the **source** screen; creates `<Screen>_<W>x<H>_llm` + checks,
     - **fixes** (only `overrides`) → select the **reshaped** screen; changes it in place (Ctrl/Cmd+Z undoes) + checks.
5. The status chip next to *Report* summarises the result (Checks passed / N checks failed / Not possible). **Copy report** copies the full JSON.

### Checks in the report
1–8 from DESIGN-RULES §10, plus: 9 overlapping siblings · 10 element sticks out of its parent · 11 list has room for more rows · 12 button changed size · 13 side-by-side panes do not end on one line (R7).
`checks.source` vs `checks.output`: a failure only in the output was caused by the reshape.

---

## B. Digiteq Reshape Assistant (`digiteq-reshape-assistant.html`)

`figma/assistant/digiteq-reshape-assistant.html` – double-click to open it in Chrome/Edge/Safari. No install, no server.

1. **Model**
   - *Claude API*: API key from platform.claude.com (Settings → API keys) + model. The key stays in your browser (tick “Remember keys” only on your own machine).
   - *Internal model*: any OpenAI-compatible chat-completions URL (e.g. `http://localhost:8000/v1/chat/completions`). The server must allow browser requests (CORS) – ask the model owner.
   - *Manual*: no key needed. Build the prompt, **Copy prompt**, paste it into any chat, paste the whole answer back in step 5.
2. **Task & target** – *Reshape plan* (source screen → new size) or *Fix failed checks* (reshaped screen + plugin report → small fixes).
3. **Screen JSON** – paste the plugin's Export JSON. The app shows the **measured facts** it sends to the model (header width, panes, lists…) and compresses the tree (~26 000 → ~3 000 characters).
4. **Design rules** – pre-filled with DESIGN-RULES.md, editable; edits are kept in the browser. *Reset* restores the default.
5. **Build prompt → Send to model** (or copy it). The answer is read automatically.
6. **Result** – the app validates the answer (pane names, bounds, overlaps, header/tabs, grid) before you copy it. **Copy JSON for plugin** is only enabled when there are no errors.

### What the model is allowed to do
- Place every pane of the content area (`mode` side/stack, `x, y, w, h`, card orientation), move tabs (`r4`).
- Optional `overrides` for single elements (`path` like `card_name/icon_bg`, `x/y/w/h/visible`).
- It never positions everything by hand – the plugin reflows the inside of panes deterministically, then the checks judge the result.

### Try it
1. Plugin: select `S2_Category_1400x1400` → Export JSON → copy.
2. App: Manual (or Claude API), Reshape plan, Wide 1840 × 960, paste → Build prompt → run → Read answer → Copy JSON.
3. Plugin: keep `S2_Category_1400x1400` selected → Import LLM result → Apply JSON → compare with the script result.

---

## C. Changing the tools

- Edit **sources**, not generated files: `figma/plugin-src/ui.template.html`, `figma/assistant-src/app.template.html`, `rules/DESIGN-RULES.md`, `figma/assets/digiteq-logo.png`.
- Then run `node figma/build.mjs` (regenerates `figma/plugin/ui.html` and `figma/assistant/digiteq-reshape-assistant.html`).
- `figma/plugin/code.js` is edited directly. After every change: `node figma/tests/simulate.js` (must end with `0 failed`).
- Rule values used by the plugin (margins, min widths, hints, P0/P1 lists) are constants at the top of `code.js` – keep them in sync with `rules/DESIGN-RULES.md`.
