// Digiteq Reshape Plugin (POC)
// Select a screen frame (header 132 + content), pick a target content size, then:
//   Reshape + check : clone -> measure -> plan (rules R1–R7) -> execute -> checks (§10 + 9–13)
//   Import          : apply a plan or fixes produced by an LLM (Digiteq Reshape Assistant)
//   Check only      : run the checks on the selected screen
//   Export JSON     : dump the screen as JSON (input for an LLM / other tools)
// Works on auto-layout screens and on flat (absolutely positioned) screens.
// Plain Figma Plugin API only.

// ---------- rules (mirror DESIGN-RULES.md) ----------

const HEADER = 132;          // header bar height (§1)
const M = 24;                // outer margin (§3)
const GAP = 32;              // gap between panes (§3)
const ROW_GAP = 16;          // gap between tabs row and panes
const MAXCOL = 1200;         // max single-column width (§3, R5)
const MINPANE = 560;         // default pane min width (R1)
const LIMITS = { minW: 960, maxW: 2560, minH: 600, maxH: 2000, minAspect: 0.5, maxAspect: 3 };

// Per-element hints from the screen tables (§7). Unknown screens use defaults.
const HINTS = {
  home_featured_tip: { min: 800 },
  tip_body: { min: 800, column: true },
};

// P0 / P1 lists for checks 1–2, detected by a marker element on the screen.
const SCREENS = {
  S1: { marker: 'home_title',
        p0: ['home_title', 'home_featured_tip'], p1: ['home_settings_button', 'home_category_cards'] },
  S2: { marker: 'category_tabs',
        p0: ['category_back_button', 'category_title', 'category_tabs', 'category_tip_list', 'category_tip_preview'],
        p1: ['category_filter_button', 'category_search_button', 'category_filter_dropdown', 'category_open_button'] },
  S3: { marker: 'tip_steps',
        p0: ['tip_title', 'tip_back_button', 'tip_steps', 'tip_prev_button', 'tip_next_button'],
        p1: ['tip_search_button', 'tip_image', 'tip_distance_setting', 'tip_helpful_toggle'] },
};
const CHECK = { minTarget: 76, minGap: 16, minText: 22,
  groups: ['category_tabs', 'tip_distance_segmented'], toggleRows: ['tip_helpful_toggle'] };

// ---------- small helpers ----------

const r8 = v => Math.round(v / 8) * 8;
const rnd = v => Math.round(v);
const isAL = n => 'layoutMode' in n && n.layoutMode !== 'NONE';
const isOverlay = n => /_dropdown$/.test(n.name);
const flowKids = n => n.children.filter(k => k.visible && k.layoutPositioning !== 'ABSOLUTE' && !isOverlay(k));
const isMedia = n => /_image$/.test(n.name);
const directImage = n => 'children' in n ? n.children.find(k => isMedia(k)) : null;
const textWrap = n => n.children.find(k => k.type === 'FRAME' && /_text$/.test(k.name));
const isSpacer = n => n.visible && (n.name === 'spacer' ||
  (n.type === 'FRAME' && n.children.length === 0 && n.width <= 2 && !(n.fills || []).some(f => f.visible !== false)));

function validateTarget(w, h) {
  const e = [];
  if (!Number.isInteger(w) || !Number.isInteger(h)) e.push('Width and height must be whole numbers.');
  if (w < LIMITS.minW || w > LIMITS.maxW) e.push(`Width must be ${LIMITS.minW}–${LIMITS.maxW} (got ${w}).`);
  if (h < LIMITS.minH || h > LIMITS.maxH) e.push(`Height must be ${LIMITS.minH}–${LIMITS.maxH} (got ${h}).`);
  if (w % 8 || h % 8) e.push('Use multiples of 8.');
  if (w / h < LIMITS.minAspect || w / h > LIMITS.maxAspect) e.push(`Aspect ${(w / h).toFixed(2)} outside ${LIMITS.minAspect}–${LIMITS.maxAspect}.`);
  return e;
}

function screenParts(s) {
  if (!s) return { error: 'Select a screen frame on the canvas…' };
  if (s.type !== 'FRAME') return { error: `Select a screen FRAME (selected: ${s.type.toLowerCase()} "${s.name}")` };
  const kids = s.children.filter(k => !isOverlay(k));
  const header = kids.find(k => /_header$/.test(k.name)) || kids[0];
  const content = kids.find(k => /_content$/.test(k.name)) || kids[1];
  if (!header || !content || header === content || !('children' in content))
    return { error: `"${s.name}" is not a screen: needs a header and a content frame` };
  if (Math.abs(header.height - HEADER) > 1)
    return { error: `"${s.name}": header must be ${HEADER} high (found ${rnd(header.height)})` };
  return { header, content, al: isAL(s) };
}

async function loadFonts(root) {
  const fonts = new Map();
  for (const t of root.findAll(n => n.type === 'TEXT')) {
    if (t.fontName !== figma.mixed) fonts.set(JSON.stringify(t.fontName), t.fontName);
    else for (const seg of t.getStyledTextSegments(['fontName'])) fonts.set(JSON.stringify(seg.fontName), seg.fontName);
  }
  await Promise.all([...fonts.values()].map(f => figma.loadFontAsync(f)));
}

function newALFrame(dir, name) {
  const f = figma.createFrame();
  f.name = name; f.fills = []; f.clipsContent = false;
  f.layoutMode = dir; f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'AUTO';
  return f;
}

// ---------- normalize (undo earlier reshapes so every screen starts the same) ----------

function normalize(s, parts) {
  const { header, content, al } = parts;
  const notes = [];
  // 1. panes wrapper inside content -> unwrap
  const wrap = content.children.find(k => k.type === 'FRAME' && /_panes$/.test(k.name));
  if (wrap) {
    let idx = content.children.indexOf(wrap);
    for (const k of wrap.children.slice()) {
      const ax = k.x + wrap.x, ay = k.y + wrap.y;
      content.insertChild(idx++, k);
      if (!al) { k.x = ax; k.y = ay; }
    }
    wrap.remove();
    notes.push('unwrapped ' + wrap.name);
  }
  // 2. tabs moved into content by an earlier R4 -> back into the header
  const tabs = content.children.find(k => /_tabs$/.test(k.name));
  if (tabs) {
    if (isAL(header)) {
      header.insertChild(Math.max(0, header.children.length - 1), tabs);
      tabs.layoutSizingHorizontal = 'HUG';
      tabs.fills = []; tabs.cornerRadius = 0;
    } else {
      header.appendChild(tabs);
      tabs.x = (header.width - tabs.width) / 2; tabs.y = (HEADER - tabs.height) / 2;
    }
    notes.push('moved ' + tabs.name + ' back to header');
  }
  return notes;
}

// ---------- measure + plan ----------

function headerNeed(header) {
  const kids = flowKids(header);
  if (isAL(header))
    return header.paddingLeft + header.paddingRight + kids.reduce((a, k) => a + k.width, 0) + header.itemSpacing * Math.max(0, kids.length - 1);
  return 2 * M + kids.reduce((a, k) => a + k.width, 0) + 24 * Math.max(0, kids.length - 1);
}

function sortPanes(panes) {
  return panes.slice().sort((a, b) => Math.abs(a.x - b.x) > 8 ? a.x - b.x : a.y - b.y);
}

// Allocate widths proportionally to the source widths, then lift every pane to its min.
function allocate(src, mins, avail) {
  const n = src.length;
  let w = src.map(v => v * avail / src.reduce((a, b) => a + b, 0));
  const fixed = new Array(n).fill(false);
  for (let iter = 0; iter < n; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) if (!fixed[i] && w[i] < mins[i]) { w[i] = mins[i]; fixed[i] = true; changed = true; }
    if (!changed) break;
    const rest = avail - w.reduce((a, v, i) => a + (fixed[i] ? v : 0), 0);
    const srcFree = src.reduce((a, v, i) => a + (fixed[i] ? 0 : v), 0);
    for (let i = 0; i < n; i++) if (!fixed[i]) w[i] = srcFree ? src[i] * rest / srcFree : rest;
  }
  w = w.map(r8);
  w[n - 1] = avail - w.slice(0, -1).reduce((a, b) => a + b, 0);
  return w;
}

function makePlan(parts, T) {
  const { header, content } = parts;
  const plan = { target: `${T.w}x${T.h}`, input: parts.al ? 'auto layout' : 'flat', decisions: [], errors: [] };

  // Header (R4)
  const need = headerNeed(header);
  const tabs = flowKids(header).find(k => /_tabs$/.test(k.name));
  plan.headerNeed = rnd(need);
  plan.r4 = need > T.w && !!tabs;
  if (need <= T.w) plan.decisions.push(`R4 not triggered: header needs ${rnd(need)} of ${T.w}`);
  else if (plan.r4) {
    plan.decisions.push(`R4: header needs ${rnd(need)} > ${T.w} -> tabs to first content row`);
    const need2 = need - tabs.width - (isAL(header) ? header.itemSpacing : 24);
    if (need2 > T.w) plan.errors.push(`Header still needs ${rnd(need2)} without tabs – too wide for ${T.w}`);
  } else plan.errors.push(`Header needs ${rnd(need)} > ${T.w} and has no tabs to move`);
  plan.tabsNode = plan.r4 ? tabs : null;

  // Panes
  const panes = sortPanes(flowKids(content));
  if (!panes.length) { plan.errors.push('Content has no panes'); return plan; }
  const top = M + (plan.r4 ? tabs.height + ROW_GAP : 0);
  const usableW = T.w - 2 * M;
  const usableH = T.h - top - M;
  const info = panes.map(p => {
    const h = HINTS[p.name] || {};
    return { node: p, name: p.name, srcW: p.width, min: h.min || MINPANE, column: !!h.column,
             media: isMedia(p), card: !isMedia(p) && !!directImage(p) };
  });
  plan.column = info.some(p => p.column);

  const avail = usableW - GAP * (info.length - 1);
  const mins = info.map(p => p.min);
  const minSum = mins.reduce((a, b) => a + b, 0);
  if (info.length > 1 && minSum <= avail) {
    plan.mode = 'side';
    plan.decisions.push(`R1 keep side by side: mins ${mins.join('+')} = ${minSum} <= ${avail}`);
    const w = allocate(info.map(p => p.srcW), mins, avail);
    let x = M;
    info.forEach((p, i) => { Object.assign(p, { w: w[i], h: usableH, x, y: top }); x += w[i] + GAP; });
    if (usableH < 300) plan.errors.push(`Height ${usableH} too small for panes`);
  } else {
    plan.mode = 'stack';
    if (info.length > 1) plan.decisions.push(`R2 stack: mins ${mins.join('+')} = ${minSum} > ${avail}`);
    // media first, then source order
    info.sort((a, b) => (b.media ? 1 : 0) - (a.media ? 1 : 0));
    const colW = plan.column ? Math.min(MAXCOL, usableW) : usableW;
    if (plan.column) plan.decisions.push(`R5 centred column ${colW}`);
    let y = top, used = 0;
    info.forEach((p, i) => {
      const last = i === info.length - 1;
      let h;
      if (!last) h = p.media ? r8(0.32 * T.h) : r8(0.43 * T.h);
      else h = usableH - used - GAP * (info.length - 1);
      if (p.min > colW) plan.errors.push(`${p.name} needs >= ${p.min}, only ${colW} available`);
      Object.assign(p, { w: colW, h, x: M + (usableW - colW) / 2, y });
      y += h + GAP; used += h;
    });
    const lastH = info[info.length - 1].h;
    if (lastH < 240) plan.errors.push(`Stacked layout leaves only ${lastH} for ${info[info.length - 1].name}`);
  }
  info.forEach(p => { if (p.card) p.card = p.w >= 1000 ? 'horizontal' : 'vertical'; });
  info.filter(p => p.card).forEach(p => plan.decisions.push(`${p.name}: ${p.card} card (width ${p.w})`));
  plan.panes = info;
  return plan;
}

function planForReport(plan) {
  return {
    target: plan.target, input: plan.input, mode: plan.mode, headerNeed: plan.headerNeed, r4: plan.r4,
    column: plan.column, decisions: plan.decisions, errors: plan.errors,
    panes: (plan.panes || []).map(p => ({ name: p.name, x: rnd(p.x), y: rnd(p.y), w: rnd(p.w), h: rnd(p.h), card: p.card || undefined, media: p.media || undefined })),
  };
}

// ---------- geometry for flat frames ----------

function resizeText(t, w) {
  if (t.textAutoResize === 'WIDTH_AND_HEIGHT') return;
  const mode = t.textAutoResize;
  t.resize(Math.max(1, w), t.height);
  if (mode === 'HEIGHT') t.textAutoResize = 'HEIGHT';
}

// children that tile a frame along an axis (grid rows, cards in a row, segmented options)
function tileInfo(node, axis) {
  const kids = node.children.filter(k => k.visible);
  if (kids.length < 2 || kids.some(k => k.type === 'TEXT')) return null;
  const P = axis === 'x' ? 'x' : 'y', S = axis === 'x' ? 'width' : 'height', CS = axis === 'x' ? 'height' : 'width';
  const s = kids.slice().sort((a, b) => a[P] - b[P]);
  const padA = s[0][P], padB = node[S] - (s[s.length - 1][P] + s[s.length - 1][S]);
  if (padA < 0 || padA > 40 || Math.abs(padA - padB) > 2) return null;
  const gaps = [];
  for (let i = 0; i < s.length - 1; i++) { const g = s[i + 1][P] - (s[i][P] + s[i][S]); if (g < -0.5) return null; gaps.push(g); }
  if (Math.max(...gaps) - Math.min(...gaps) > 2) return null;
  if (Math.max(...gaps) > 40) return null;   // big gap = pinned to both edges (space-between), not tiles
  if (s.some(k => k[CS] < 0.8 * node[CS])) return null;
  return { kids: s, padA, padB, gaps };
}

// Distribute tiled children; small ones (<= 40, e.g. a scrollbar) keep their size
function distribute(tile, oldSize, newSize) {
  const S = tile.axis === 'x' ? 'width' : 'height';
  const small = k => k[S] <= 40;
  const fixedSum = tile.kids.filter(small).reduce((a, k) => a + k[S], 0);
  const gapSum = tile.gaps.reduce((a, b) => a + b, 0);
  const oldAvail = oldSize - tile.padA - tile.padB - gapSum - fixedSum;
  const newAvail = newSize - tile.padA - tile.padB - gapSum - fixedSum;
  const out = new Map();
  let pos = tile.padA;
  tile.kids.forEach((k, i) => {
    const size = small(k) ? k[S] : k[S] * newAvail / oldAvail;
    out.set(k.id, { pos, size });
    pos += size + (tile.gaps[i] || 0);
  });
  return out;
}

// Vertical stacks with even gaps (list rows, cards in a column) move as one group
function yRuns(node) {
  const kids = node.children.filter(k => k.visible).sort((a, b) => a.y - b.y);
  const runOf = new Map();
  let run = [kids[0]], gap = null;
  const close = () => {
    if (run.length >= 2) {
      const top = run[0].y, bottom = Math.max(...run.map(k => k.y + k.height));
      run.forEach(k => runOf.set(k.id, { top, bottom }));
    }
  };
  for (let i = 1; i < kids.length; i++) {
    const prev = run[run.length - 1], k = kids[i];
    const g = k.y - (prev.y + prev.height);
    const xOverlap = Math.min(prev.x + prev.width, k.x + k.width) - Math.max(prev.x, k.x) > 0;
    if (g >= -0.5 && g <= 40 && xOverlap && (gap === null || Math.abs(g - gap) <= 2)) { run.push(k); if (gap === null) gap = g; }
    else { close(); run = [k]; gap = null; }
  }
  close();
  return runOf;
}

// Resize a frame and its children: tiled children are distributed, others follow
// inferred constraints (wide = stretch, centred = centre, near right/bottom = anchor there).
function reflow(node, newW, newH) {
  if (node.type === 'TEXT') { resizeText(node, newW); return; }
  const W = node.width, H = node.height, dW = newW - W, dH = newH - H;
  const hasKids = 'children' in node && node.name !== 'icon' && node.type !== 'INSTANCE';
  const tx = hasKids && dW ? tileInfo(node, 'x') : null; if (tx) tx.axis = 'x';
  // list rows have a fixed height – never distribute them (after R7 they fill their container exactly)
  const ty = hasKids && dH && !isListContainer(node) ? tileInfo(node, 'y') : null; if (ty) ty.axis = 'y';
  const dx = tx ? distribute(tx, W, newW) : null, dy = ty ? distribute(ty, H, newH) : null;
  const runs = hasKids && dH && !ty && node.children.length > 1 ? yRuns(node) : new Map();
  // Spacer = empty flexible element (from auto layout). It absorbs the height change:
  // everything above it stays at the top, everything below moves with the bottom edge.
  const spacer = hasKids && dH ? node.children.find(isSpacer) : null;
  const spTop = spacer ? spacer.y : 0, spBottom = spacer ? spacer.y + spacer.height : 0;
  // Runs that would no longer fit when centred are anchored to the top instead
  const fitsCentred = r => (r.bottom - r.top) <= newH - 2 * Math.min(r.top, H - r.bottom) + 0.5;
  if ('resizeWithoutConstraints' in node) node.resizeWithoutConstraints(Math.max(1, newW), Math.max(1, newH));
  else node.resize(Math.max(1, newW), Math.max(1, newH));
  if (!hasKids) return;
  for (const c of node.children) {
    const L = c.x, R = W - (c.x + c.width), T = c.y, B = H - (c.y + c.height);
    let nx = c.x, ny = c.y, nw = c.width, nh = c.height;
    if (dx && dx.has(c.id)) { nx = dx.get(c.id).pos; nw = dx.get(c.id).size; }
    else if (dW) {
      if (c.width >= 0.5 * W) nw = c.width + dW;
      else if (Math.abs(L - R) <= 2) nx = c.x + dW / 2;
      else if (R < L) nx = c.x + dW;
    }
    if (dy && dy.has(c.id)) { ny = dy.get(c.id).pos; nh = dy.get(c.id).size; }
    else if (spacer) {
      if (c === spacer) nh = Math.max(1, c.height + dH);
      else if (c.y >= spBottom - 0.5) ny = c.y + dH;
      // above the spacer: stays at the top
    }
    else if (dH && runs.has(c.id)) {
      const r = runs.get(c.id), RT = r.top, RB = H - r.bottom;
      if (Math.abs(RT - RB) <= 2 && fitsCentred(r)) ny = c.y + dH / 2;
      else if (RB < RT - 2) ny = c.y + dH;
    }
    else if (dH) {
      if (c.height >= 0.5 * H && c.type !== 'TEXT') nh = c.height + dH;
      else if (Math.abs(T - B) <= 2) ny = c.y + dH / 2;
      else if (B < T) ny = c.y + dH;
    }
    if (Math.abs(nw - c.width) > 0.01 || Math.abs(nh - c.height) > 0.01) reflow(c, nw, nh);
    c.x = nx; c.y = ny;
  }
}

function vstack(nodes, x, y, gap, width) {
  let cy = y;
  for (const n of nodes) {
    if (width) { if (n.type === 'TEXT') resizeText(n, width); else reflow(n, width, n.height); }
    n.x = x; n.y = cy; cy += n.height + gap;
  }
  return cy - gap;
}

// Card = frame with an image child + texts + buttons (featured tip, preview)
function layoutCardFlat(card, w, h, orient) {
  const P = 32;
  card.resizeWithoutConstraints(w, h);
  const wrap = textWrap(card);
  if (wrap) {
    for (const k of wrap.children.slice()) { const ax = k.x + wrap.x, ay = k.y + wrap.y; card.appendChild(k); k.x = ax; k.y = ay; }
    wrap.remove();
  }
  const img = directImage(card);
  const buttons = card.children.filter(k => k.visible && /_button$/.test(k.name));
  const texts = card.children.filter(k => k.visible && k.type === 'TEXT').sort((a, b) => a.y - b.y);
  const spacers = card.children.filter(isSpacer);
  let tx, tw, ty;
  if (orient === 'horizontal') {
    const iw = r8((w - 2 * P - 32) * 0.45);
    reflow(img, iw, h - 2 * P); img.x = P; img.y = P;
    tx = P + iw + 32; tw = w - tx - P; ty = P;
  } else {
    const ih = r8(Math.min(340, 0.38 * (h - 2 * P)));
    reflow(img, w - 2 * P, ih); img.x = P; img.y = P;
    tx = P; tw = w - 2 * P; ty = P + ih + 20;
  }
  const textBottom = vstack(texts, tx, ty, 20, tw);
  let bx = tx;
  buttons.forEach(b => { b.x = bx; b.y = h - P - b.height; bx += b.width + 16; });
  // spacer between text and buttons (like auto layout): absorbs later height changes
  const btnTop = buttons.length ? Math.min(...buttons.map(b => b.y)) : h - P;
  spacers.forEach(k => { k.x = tx; k.y = textBottom + 20; k.resizeWithoutConstraints(1, Math.max(1, btnTop - 20 - k.y)); });
}

function execFlat(s, parts, plan, T) {
  const { header, content } = parts;
  const srcHW = header.width;
  s.resizeWithoutConstraints(T.w, HEADER + T.h);
  header.resizeWithoutConstraints(T.w, HEADER); header.x = 0; header.y = 0;
  content.resizeWithoutConstraints(T.w, T.h); content.x = 0; content.y = HEADER;

  if (plan.r4) { content.appendChild(plan.tabsNode); plan.tabsNode.x = M; plan.tabsNode.y = M; }

  // header: left / middle / right groups by position in the source header
  const hk = flowKids(header).sort((a, b) => a.x - b.x);
  const left = [], mid = [], right = [];
  hk.forEach(k => { const cx = k.x + k.width / 2; (cx < srcHW / 3 ? left : cx > 2 * srcHW / 3 ? right : mid).push(k); });
  right.forEach(k => { k.x = T.w - (srcHW - k.x); });
  if (mid.length) {
    const leftEnd = Math.max(M, ...left.map(k => k.x + k.width));
    const rightStart = Math.min(T.w - M, ...right.map(k => k.x));
    const bx = mid[0].x, bw = mid[mid.length - 1].x + mid[mid.length - 1].width - bx;
    const start = leftEnd + (rightStart - leftEnd - bw) / 2;
    mid.forEach(k => { k.x += start - bx; });
  }

  for (const p of plan.panes) {
    if (p.card) layoutCardFlat(p.node, p.w, p.h, p.card);
    else reflow(p.node, p.w, p.h);
    p.node.x = p.x; p.node.y = p.y;
  }
}

// ---------- auto layout ----------

function layoutCardAL(card, orient) {
  const img = directImage(card);
  let wrap = textWrap(card);
  const padX = card.paddingLeft + card.paddingRight, padY = card.paddingTop + card.paddingBottom;
  if (orient === 'horizontal') {
    if (!wrap) {
      wrap = newALFrame('VERTICAL', card.name + '_text'); wrap.itemSpacing = 20;
      card.appendChild(wrap);
      for (const k of card.children.slice()) if (k !== img && k !== wrap) wrap.appendChild(k);
    }
    card.layoutMode = 'HORIZONTAL'; card.itemSpacing = 32; card.counterAxisAlignItems = 'MIN';
    img.resize(r8((card.width - padX - 32) * 0.45), img.height);
    img.layoutSizingVertical = 'FILL';
    wrap.layoutSizingHorizontal = 'FILL'; wrap.layoutSizingVertical = 'FILL';
  } else {
    card.layoutMode = 'VERTICAL'; card.itemSpacing = 20; card.counterAxisAlignItems = 'MIN';
    img.resize(img.width, r8(Math.min(340, 0.38 * (card.height - padY))));
    img.layoutSizingHorizontal = 'FILL'; img.layoutSizingVertical = 'FIXED';
    if (wrap) { wrap.layoutSizingHorizontal = 'FILL'; wrap.layoutSizingVertical = 'FILL'; }
  }
}

// Text layers must hug their height after direction changes (round 1 lesson 2)
function fixTexts(s) {
  for (const t of s.findAll(n => n.type === 'TEXT' && n.textAutoResize === 'HEIGHT')) {
    if (!isAL(t.parent)) continue;
    try {
      if (t.parent.layoutMode === 'VERTICAL') t.layoutSizingHorizontal = 'FILL';
      t.layoutSizingVertical = 'HUG';
    } catch (e) { /* not in an auto-layout context */ }
  }
}

function execAL(s, parts, plan, T) {
  const { header, content } = parts;
  s.resize(T.w, HEADER + T.h);
  try { header.layoutSizingHorizontal = 'FILL'; } catch (e) {}
  try { content.layoutSizingHorizontal = 'FILL'; content.layoutSizingVertical = 'FILL'; } catch (e) {}
  const panes = plan.panes.map(p => p.node);
  const dir = plan.mode === 'side' ? 'HORIZONTAL' : 'VERTICAL';
  let host = content;

  if (plan.r4) {
    content.layoutMode = 'VERTICAL'; content.itemSpacing = ROW_GAP; content.counterAxisAlignItems = 'MIN';
    content.insertChild(0, plan.tabsNode);
    plan.tabsNode.layoutSizingHorizontal = 'FILL';
    plan.tabsNode.primaryAxisAlignItems = 'MIN';
    host = newALFrame(dir, content.name.replace(/_content$/, '') + '_panes');
    content.appendChild(host);
    host.layoutSizingHorizontal = 'FILL'; host.layoutSizingVertical = 'FILL';
  } else {
    content.layoutMode = dir;
  }
  host.itemSpacing = GAP;
  host.counterAxisAlignItems = plan.mode === 'stack' && plan.column ? 'CENTER' : 'MIN';
  panes.forEach((p, i) => host.insertChild(i, p));

  plan.panes.forEach((p, i) => {
    const n = p.node, last = i === plan.panes.length - 1;
    n.resize(p.w, p.h);
    if (plan.mode === 'side') n.layoutSizingVertical = 'FILL';
    else {
      if (!plan.column) n.layoutSizingHorizontal = 'FILL';
      if (last) n.layoutSizingVertical = 'FILL';
    }
    if (p.card) layoutCardAL(n, p.card);
  });
  fixTexts(s);
}

// ---------- shared: rows (R3) and overlays (R6) ----------

function renameTree(node, oldBase, newBase) {
  node.name = newBase;
  if ('children' in node) node.findAll(n => n.name.startsWith(oldBase + '_')).forEach(n => { n.name = newBase + n.name.slice(oldBase.length); });
}

const isRow = k => /_row_\d+$/.test(k.name);
const isListContainer = n => 'children' in n && n.children.filter(isRow).length >= 3;
const rowsOf = c => c.children.filter(isRow).sort((a, b) => +a.name.split('_').pop() - +b.name.split('_').pop());
const xOverlap = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0;

// ---------- text settle (flat only): what auto layout does when text wraps ----------

// Frame changes height by d; centred children stay centred, bottom-pinned stay at the bottom
function growFrame(f, d, except) {
  const H = f.height;
  const skip = except instanceof Set ? except : new Set(except ? [except] : []);
  f.resizeWithoutConstraints(f.width, Math.max(1, H + d));
  for (const c of f.children) {
    if (skip.has(c)) continue;
    const T = c.y, B = H - (c.y + c.height);
    if (Math.abs(T - B) <= 2) c.y += d / 2;
    else if (B < T) c.y += d;
  }
}

// node changed height (was h0): move the stack below it, keep the original gap
function restack(p, node, h0) {
  const oldBottom = node.y + h0;
  const below = p.children.filter(s => s !== node && s.visible && s.y >= oldBottom - 0.5 && xOverlap(s, node)).sort((a, b) => a.y - b.y);
  if (!below.length) return [];
  const gap0 = Math.min(16, Math.max(0, below[0].y - oldBottom));
  const shift = node.y + node.height + gap0 - below[0].y;
  if (Math.abs(shift) > 0.5) below.forEach(s => { s.y += shift; });
  return below;
}

// All rows of a list get one height (the tallest) and are re-stacked with the list's gap
function uniformRows(c, gap) {
  const rows = rowsOf(c);
  const maxH = Math.max(...rows.map(r => r.height));
  rows.forEach(r => { if (r.height < maxH - 0.5) growFrame(r, maxH - r.height, null); });
  let y = rows[0].y;
  rows.forEach(r => { r.y = y; y += r.height + gap; });
}

function grew(node, h0, ctx) {
  const p = node.parent;
  if (!p || p.type !== 'FRAME' || ctx.stop.has(p.id) || isAL(p)) return;
  if (isListContainer(p)) {
    // rows are equalised once, after all texts are settled (see settleTexts)
    if (!ctx.listGap.has(p.id)) {
      const rs = rowsOf(p);
      ctx.listGap.set(p.id, rs[1].y - (rs[0].y + (rs[0] === node ? h0 : rs[0].height)));
      ctx.lists.set(p.id, p);
    }
    return;
  }
  const kids = p.children.filter(k => k.visible && !isSpacer(k));
  const maxBefore = Math.max(...kids.map(k => k.y + (k === node ? h0 : k.height)));
  const padB = Math.max(0, p.height - maxBefore);
  const moved = restack(p, node, h0);
  const maxAfter = Math.max(...kids.map(k => k.y + k.height));
  const need = maxAfter + padB - p.height;
  if (Math.abs(need) > 0.5) { const ph0 = p.height; growFrame(p, need, new Set([node, ...moved])); grew(p, ph0, ctx); }
}

function settleTexts(out, parts, plan, heights0, notes) {
  const ctx = { stop: new Set([out.id, parts.header.id, parts.content.id, ...plan.panes.map(p => p.node.id)]), listGap: new Map(), lists: new Map() };
  let n = 0;
  for (const t of out.findAll(k => k.type === 'TEXT' && heights0.has(k.id))) {
    const h0 = heights0.get(t.id);
    if (Math.abs(t.height - h0) > 1) { grew(t, h0, ctx); n++; }
  }
  for (const [id, c] of ctx.lists) uniformRows(c, ctx.listGap.get(id));
  if (n) notes.push(`text reflow: ${n} text layer(s) changed height (wrapping) – stacks below moved, parents resized` +
    (ctx.lists.size ? `; rows made equal height (${[...ctx.lists.values()].map(c => `${c.name}: ${rnd(rowsOf(c)[0].height)}`).join(', ')})` : ''));
}

// ---------- R3: fill lists with rows (placeholder rows repeat existing content) ----------

function fillRows(s, notes) {
  for (const c of s.findAll(isListContainer)) {
    const rows = rowsOf(c);
    rows.forEach(r => { r.visible = true; });
    const base = rows[0].name.replace(/_\d+$/, '');
    const al = isAL(c);
    const gap = al ? c.itemSpacing : rows[1].y - (rows[0].y + rows[0].height);
    const top = al ? c.paddingTop : rows[0].y;
    const limit = c.height - (al ? c.paddingBottom : 0);
    const originals = rows.length;
    let bottom = al ? top + rows.reduce((a, r) => a + r.height, 0) + gap * (rows.length - 1)
                    : rows[rows.length - 1].y + rows[rows.length - 1].height;
    let added = 0, hidden = 0, k = +rows[rows.length - 1].name.split('_').pop() + 1;
    for (;;) {
      const src = rows[rows.length % originals];
      if (bottom + gap + src.height > limit + 0.5) break;
      const clone = src.clone();
      c.appendChild(clone);   // clone() lands on the page – always re-parent
      if (!al) { clone.x = rows[0].x; clone.y = bottom + gap; }
      renameTree(clone, src.name, `${base}_${k++}`);
      // a copy never inherits a "selected" state: take the stroke of a plain row
      const stroked = r => Array.isArray(r.strokes) && r.strokes.some(s => s.visible !== false);
      const plain = rows.find(r => !stroked(r));
      if (stroked(src) && plain) { clone.strokes = []; if ('strokeWeight' in plain) clone.strokeWeight = plain.strokeWeight; }
      rows.push(clone); bottom += gap + src.height; added++;
    }
    let y = top;
    rows.forEach((r, i) => {
      const end = (al ? y : r.y) + r.height;
      if (i > 0 && end > limit + 0.5) { r.visible = false; hidden++; }
      y += r.height + gap;
    });
    if (added) notes.push(`R3 ${c.name}: +${added} placeholder rows (repeated content) -> ${rows.filter(r => r.visible).length} visible`);
    if (hidden) notes.push(`R3 ${c.name}: ${hidden} rows hidden (scroll)`);
  }
}

// ---------- R7: side-by-side panes end at the list's last visible row ----------

function lastRowGap(c) {
  const rows = rowsOf(c).filter(r => r.visible);
  const cb = c.absoluteBoundingBox;
  const last = Math.max(...rows.map(r => r.absoluteBoundingBox.y + r.absoluteBoundingBox.height));
  return cb.y + cb.height - (isAL(c) ? c.paddingBottom : 0) - last;
}

function alignPaneBottoms(plan, notes) {
  if (plan.mode !== 'side') return;
  const lp = plan.panes.find(p => isListContainer(p.node) || p.node.findOne(isListContainer));
  if (!lp) return;
  const c = isListContainer(lp.node) ? lp.node : lp.node.findOne(isListContainer);
  const leftover = lastRowGap(c);
  if (leftover < 8) return;
  const h0 = lp.node.height, newH = h0 - leftover;
  for (const p of plan.panes) {
    if (isAL(p.node) || (p.node.parent && isAL(p.node.parent))) { p.node.resize(p.node.width, newH); p.node.layoutSizingVertical = 'FIXED'; }
    else reflow(p.node, p.node.width, newH);
    p.h = newH;
  }
  notes.push(`R7 pane bottoms aligned with the last visible row of ${c.name}: panes ${rnd(h0)} -> ${rnd(newH)} high (${rnd(leftover)} px left free below)`);
}

function placeOverlays(s, T, notes) {
  for (const o of s.findAll(isOverlay)) {
    const trigger = s.findOne(n => n.name === o.name.replace(/_dropdown$/, '_button'));
    if (!trigger) continue;
    const sx = s.absoluteTransform[0][2], sy = s.absoluteTransform[1][2];
    const tx = trigger.absoluteTransform[0][2] - sx, ty = trigger.absoluteTransform[1][2] - sy;
    if (o.parent !== s) continue;
    o.x = Math.min(Math.max(M, tx), T.w - M - o.width);
    o.y = ty + trigger.height + 8;
    notes.push(`R6 ${o.name} anchored under ${trigger.name}`);
  }
}

// ---------- checks (§10) ----------

const isTarget = n =>
  /_button$/.test(n.name) || /^category_tab_[a-z]+$/.test(n.name) || /_row_\d+$/.test(n.name) ||
  /^tip_distance_option_[a-z]+$/.test(n.name) || /^home_category_card_[a-z]+$/.test(n.name) ||
  CHECK.toggleRows.includes(n.name);
const inside = (b, S, m = 0) => b.x >= S.x + m - 0.5 && b.y >= S.y - 0.5 &&
  b.x + b.width <= S.x + S.width - m + 0.5 && b.y + b.height <= S.y + S.height + 0.5;
const visibleChain = (n, s) => { for (let p = n; p && p !== s; p = p.parent) if (!p.visible) return false; return true; };
const groupOf = (n, s) => { for (let p = n.parent; p && p !== s; p = p.parent) if (CHECK.groups.includes(p.name)) return p.id; return null; };
const contains = (a, b) => 'findOne' in a && !!a.findOne(x => x.id === b.id);
function gapOf(a, b) {
  const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { overlap: ox > 0.5 && oy > 0.5, dist: Math.max(0, -ox, -oy) };
}

function check(s, plan, source) {
  const S = s.absoluteBoundingBox, fails = [];
  const key = Object.keys(SCREENS).find(k => s.findOne(n => n.name === SCREENS[k].marker));
  const find = nm => s.findOne(n => n.name === nm);
  if (key) {
    const cfg = SCREENS[key];
    for (const nm of cfg.p0) { const n = find(nm); if (!n) fails.push('1 missing P0: ' + nm); else if (!visibleChain(n, s) || !inside(n.absoluteBoundingBox, S)) fails.push('1 P0 not visible inside: ' + nm); }
    for (const nm of [...cfg.p0, ...cfg.p1]) if (!find(nm)) fails.push('2 missing: ' + nm);
  }
  const T = s.findAll(n => isTarget(n) && n.absoluteBoundingBox && visibleChain(n, s));
  const small = T.filter(n => n.width < CHECK.minTarget - 0.5 || n.height < CHECK.minTarget - 0.5).map(n => `${n.name} ${rnd(n.width)}x${rnd(n.height)}`);
  if (small.length) fails.push('4 target < 76: ' + [...new Set(small)].slice(0, 6).join(', '));
  const close = [];
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const a = T[i], b = T[j];
    if (contains(a, b) || contains(b, a)) continue;
    const ga = groupOf(a, s), gb = groupOf(b, s); if (ga && ga === gb) continue;
    const g = gapOf(a.absoluteBoundingBox, b.absoluteBoundingBox);
    if (g.overlap) close.push(`${a.name} overlaps ${b.name}`); else if (g.dist < CHECK.minGap - 0.5) close.push(`${a.name}~${b.name} ${rnd(g.dist)}`);
  }
  if (close.length) fails.push('3 targets overlap/gap<16: ' + close.slice(0, 5).join('; '));
  const off = s.findAll(n => (n.type === 'TEXT' || isTarget(n)) && visibleChain(n, s)).filter(n => !inside(n.absoluteBoundingBox, S, M)).map(n => n.name);
  if (off.length) fails.push('5 outside margin: ' + [...new Set(off)].slice(0, 5).join(', '));
  if (plan && plan.column) plan.panes.forEach(p => { if (p.node.width > MAXCOL + 0.5) fails.push(`5 ${p.name} wider than ${MAXCOL}`); });
  const tiny = s.findAll(n => n.type === 'TEXT' && typeof n.fontSize === 'number' && n.fontSize < CHECK.minText).map(n => n.name);
  if (tiny.length) fails.push('6 text < 22: ' + tiny.slice(0, 5).join(', '));
  for (const o of s.findAll(isOverlay)) if (!inside(o.absoluteBoundingBox, S)) fails.push('7 overlay outside: ' + o.name);
  const outside = s.findAll(n => n.absoluteBoundingBox && visibleChain(n, s) && !inside(n.absoluteBoundingBox, S)).map(n => n.name);
  if (outside.length) fails.push('8 drawn outside: ' + outside.slice(0, 5).join(', '));
  // 9: overlapping siblings (text running into other nodes) – typical for flat layouts
  const ov = [];
  for (const f of s.findAll(n => n.type === 'FRAME' && n.name !== 'icon' && visibleChain(n, s))) {
    const kids = f.children.filter(k => k.visible && k.name !== 'spacer' && !isOverlay(k));
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].absoluteBoundingBox, b = kids[j].absoluteBoundingBox;
      if (a && b && gapOf(a, b).overlap) ov.push(`${kids[i].name} x ${kids[j].name}`);
    }
  }
  if (ov.length) fails.push('9 overlapping siblings: ' + ov.slice(0, 5).join('; '));
  // 10: element sticks out of its parent (cut off by a card edge, or spilling over it)
  const spill = [];
  for (const n of s.findAll(n => n.absoluteBoundingBox && visibleChain(n, s) && !isSpacer(n) && !isOverlay(n))) {
    const p = n.parent;
    if (!p || p === s || p.type !== 'FRAME' || p.name === 'icon' || (p.parent && p.parent.name === 'icon')) continue;
    if (n.layoutPositioning === 'ABSOLUTE') continue;
    if (!inside(n.absoluteBoundingBox, p.absoluteBoundingBox)) spill.push(`${n.name} in ${p.name}`);
  }
  if (spill.length) fails.push('10 sticks out of parent: ' + [...new Set(spill)].slice(0, 5).join('; '));
  // 11: lists leave room for more rows (R3 – use the extra height)
  for (const c of s.findAll(n => 'children' in n && visibleChain(n, s) && n.children.filter(k => /_row_\d+$/.test(k.name)).length >= 3)) {
    const rows = c.children.filter(k => k.visible && /_row_\d+$/.test(k.name)).sort((a, b) => a.y - b.y);
    const rowH = rows[0].height, gap = rows.length > 1 ? rows[1].y - rows[0].y - rowH : 0;
    const free = c.height - (rows[rows.length - 1].y + rowH) - (isAL(c) ? c.paddingBottom : 0);
    const more = Math.floor((free + 0.5) / (rowH + gap));
    if (more >= 1) fails.push(`11 ${c.name} has room for ${more} more row(s)`);
  }
  // 13: R7 – a list that ends above the neighbouring pane (bottoms not aligned)
  const sp = screenParts(s);
  if (!sp.error) {
    const panes = flowKids(sp.content);
    for (const c of s.findAll(n => isListContainer(n) && visibleChain(n, s))) {
      const gapB = lastRowGap(c);
      if (gapB < 8) continue;
      const pane = panes.find(p => p === c || !!p.findOne(x => x === c));
      if (!pane) continue;
      const nb = panes.filter(p => p !== pane && !xOverlap(p, pane) && Math.abs((p.y + p.height) - (pane.y + pane.height)) < 1);
      if (nb.length) fails.push(`13 ${c.name} ends ${rnd(gapB)} px above ${nb.map(p => p.name).join(', ')} (bottoms not aligned, R7)`);
    }
  }
  // 12: buttons keep their size (they hug their label – a reshape should only move them)
  if (source) {
    const changed = [];
    for (const b of s.findAll(n => /_button$/.test(n.name) && visibleChain(n, s))) {
      const o = source.findOne(n => n.name === b.name);
      if (o && (Math.abs(o.width - b.width) > 1 || Math.abs(o.height - b.height) > 1))
        changed.push(`${b.name} ${rnd(o.width)}x${rnd(o.height)} -> ${rnd(b.width)}x${rnd(b.height)}`);
    }
    if (changed.length) fails.push('12 button resized: ' + changed.slice(0, 5).join('; '));
  }
  return { screen: s.name, rulesFor: key || 'generic (checks 3–9 only)', pass: fails.length === 0, fails };
}

// ---------- export ----------

function dump(n) {
  const o = { name: n.name, type: n.type, x: rnd(n.x), y: rnd(n.y), w: rnd(n.width), h: rnd(n.height) };
  if (!n.visible) o.hidden = true;
  if (isAL(n)) o.layout = { mode: n.layoutMode, gap: n.itemSpacing, pad: [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft] };
  if ('layoutSizingHorizontal' in n && n.parent && isAL(n.parent)) o.sizing = [n.layoutSizingHorizontal, n.layoutSizingVertical];
  if (n.type === 'TEXT') { o.text = n.characters; if (typeof n.fontSize === 'number') o.fontSize = n.fontSize; }
  if ('children' in n && n.name !== 'icon' && n.type !== 'INSTANCE') o.children = n.children.map(dump);
  return o;
}

// ---------- output placement ----------

function outputName(src, T) {
  const base = src.name.replace(/_(Wide|Square|\d+x\d+)(_llm)?(_\d+)?$/, '');
  let name = `${base}_${T.w}x${T.h}`, i = 2;
  while (figma.currentPage.findOne(n => n.name === name)) name = `${base}_${T.w}x${T.h}_${i++}`;
  return name;
}

function place(out) {
  const page = figma.currentPage;
  const others = page.children.filter(n => n !== out);
  const previous = others.filter(n => n.type === 'FRAME' && /_\d+x\d+(_\d+)?(_llm)?$/.test(n.name));
  page.appendChild(out);
  if (previous.length) {
    const x = Math.min(...previous.map(n => n.x));
    out.x = x; out.y = Math.max(...previous.map(n => n.y + n.height)) + 200;
  } else {
    out.x = Math.max(0, ...others.map(n => n.x + n.width)) + 400;
    out.y = others.length ? Math.min(...others.map(n => n.y)) : 0;
  }
}

// ---------- LLM result: plan or fixes ----------

// Accepts raw model output: a ```json block, or the first {...} in the text
function extractJson(text) {
  const blocks = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1].trim()).filter(b => b.startsWith('{'));
  if (blocks.length) return blocks[blocks.length - 1];
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('No JSON object found');
  return text.slice(a, b + 1);
}

// "card/icon_bg" = icon_bg somewhere inside a node named card
function findByPath(root, path) {
  const segs = String(path).split('/').map(s => s.trim()).filter(Boolean);
  const last = segs.pop();
  return root.findAll(n => n.name === last).filter(n => {
    let i = segs.length - 1;
    for (let p = n.parent; p && i >= 0; p = p.parent) if (p.name === segs[i]) i--;
    return i < 0 && (root.findOne(x => x === n) !== null);
  });
}

function planFromLLM(data, parts, T) {
  const { header, content } = parts;
  const errors = [];
  const plan = { target: `${T.w}x${T.h}`, input: parts.al ? 'auto layout' : 'flat', source: 'llm',
    decisions: Array.isArray(data.decisions) ? data.decisions.map(String) : [], errors, mode: data.mode, r4: !!data.r4 };
  if (!['side', 'stack'].includes(plan.mode)) errors.push(`mode must be "side" or "stack" (got ${JSON.stringify(data.mode)})`);
  if (plan.r4) {
    plan.tabsNode = flowKids(header).find(k => /_tabs$/.test(k.name));
    if (!plan.tabsNode) errors.push('r4 is true but the header has no …_tabs element');
  }
  const top = plan.r4 && plan.tabsNode ? M + plan.tabsNode.height + ROW_GAP : 0;
  const nodes = flowKids(content);
  const byName = new Map(nodes.map(n => [n.name, n]));
  const seen = new Set();
  const info = [];
  for (const p of data.panes) {
    const node = byName.get(p.name);
    if (!node) { errors.push(`unknown pane "${p.name}" (content has: ${[...byName.keys()].join(', ')})`); continue; }
    if (seen.has(p.name)) { errors.push(`pane "${p.name}" listed twice`); continue; }
    seen.add(p.name);
    const nums = ['x', 'y', 'w', 'h'].map(k => Number(p[k]));
    if (nums.some(v => !Number.isFinite(v))) { errors.push(`${p.name}: x, y, w, h must be numbers`); continue; }
    const [x, y, w, h] = nums;
    if (w < 40 || h < 40) errors.push(`${p.name}: ${w}x${h} is too small`);
    if (x < -0.5 || y < -0.5 || x + w > T.w + 0.5 || y + h > T.h + 0.5) errors.push(`${p.name}: ${x},${y} ${w}x${h} is outside the content area ${T.w}x${T.h}`);
    if (plan.r4 && y < top - 0.5) errors.push(`${p.name}: y ${y} overlaps the tabs row (panes start at ${top})`);
    const hasCard = !isMedia(node) && !!directImage(node);
    let card = hasCard ? (['horizontal', 'vertical'].includes(p.card) ? p.card : (w >= 1000 ? 'horizontal' : 'vertical')) : null;
    info.push({ node, name: p.name, x, y, w, h, card, media: isMedia(node) });
  }
  for (const n of nodes) if (!seen.has(n.name)) errors.push(`pane "${n.name}" is missing in the plan`);
  // overlap between panes
  const box = p => ({ x: p.x, y: p.y, width: p.w, height: p.h });
  for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++)
    if (gapOf(box(info[i]), box(info[j])).overlap) errors.push(`panes ${info[i].name} and ${info[j].name} overlap`);
  info.sort((a, b) => plan.mode === 'side' ? a.x - b.x : a.y - b.y);
  plan.column = plan.mode === 'stack' && info.some(p => p.w < T.w - 2 * M - 1);
  plan.panes = info;
  return plan;
}

function applyOverrides(root, list, notes) {
  const errors = [];
  for (const o of list || []) {
    const path = o.path || o.name;
    if (!path) { errors.push('override without path/name'); continue; }
    let hits = findByPath(root, path);
    if (!hits.length) { errors.push(`override: "${path}" not found`); continue; }
    if (hits.length > 1 && !o.all) { errors.push(`override: "${path}" matches ${hits.length} elements – use a longer path or "all": true`); continue; }
    for (const n of hits) {
      const done = [];
      const inAL = n.parent && isAL(n.parent) && n.layoutPositioning !== 'ABSOLUTE';
      if (o.w !== undefined || o.h !== undefined) {
        const w = o.w !== undefined ? Number(o.w) : n.width, h = o.h !== undefined ? Number(o.h) : n.height;
        if (n.type === 'TEXT') resizeText(n, w);
        else if (isAL(n) || inAL) n.resize(w, h);
        else reflow(n, w, h);
        done.push(`size ${rnd(w)}x${rnd(h)}`);
      }
      if (o.x !== undefined || o.y !== undefined) {
        if (inAL) done.push('x/y ignored (parent uses auto layout)');
        else { if (o.x !== undefined) n.x = Number(o.x); if (o.y !== undefined) n.y = Number(o.y); done.push(`pos ${rnd(n.x)},${rnd(n.y)}`); }
      }
      if (typeof o.visible === 'boolean') { n.visible = o.visible; done.push(o.visible ? 'shown' : 'hidden'); }
      notes.push(`override ${path}${hits.length > 1 ? ` (#${hits.indexOf(n) + 1})` : ''}: ${done.join(', ') || 'nothing to change'}`);
    }
  }
  return errors;
}

async function importJson(text, node, parts, t0) {
  let data;
  try { data = JSON.parse(extractJson(text)); } catch (e) { return report({ action: 'import', error: 'Could not read JSON: ' + e.message }); }
  const notes = [];

  // A) full plan -> reshape the selected source into a new frame
  if (Array.isArray(data.panes) && data.panes.length) {
    const T = { w: Number(data.target && data.target.w), h: Number(data.target && data.target.h) };
    const verr = validateTarget(T.w, T.h);
    if (verr.length) return report({ action: 'import', error: 'Invalid target in JSON', details: verr });
    const out = node.clone();
    await loadFonts(out);
    const oParts = screenParts(out);
    notes.push(...normalize(out, oParts));
    const plan = planFromLLM(data, oParts, T);
    if (plan.errors.length) { out.remove(); return report({ action: 'import', result: 'rejected', errors: plan.errors }); }
    out.name = outputName(node, T) + '_llm';
    place(out);
    execute(out, oParts, plan, T, notes);
    const oerr = applyOverrides(out, data.overrides, notes);
    figma.currentPage.selection = [out];
    figma.viewport.scrollAndZoomIntoView([out]);
    return report({ action: 'import', kind: 'plan', output: out.name, source: node.name, seconds: (Date.now() - t0) / 1000,
      plan: planForReport(plan), notes, overrideErrors: oerr,
      checks: { source: check(node, null), output: check(out, plan, node) } });
  }

  // B) overrides only -> fix the selected frame in place (Cmd/Ctrl+Z undoes it)
  if (Array.isArray(data.overrides) && data.overrides.length) {
    await loadFonts(node);
    const oerr = applyOverrides(node, data.overrides, notes);
    return report({ action: 'import', kind: 'fix', screen: node.name, notes, overrideErrors: oerr, checks: { output: check(node, null) } });
  }
  return report({ action: 'import', error: 'JSON has neither "panes" (plan) nor "overrides" (fix)' });
}

// ---------- main ----------

// One execution pipeline for script plans and LLM plans
function execute(out, oParts, plan, T, notes) {
  const heights0 = new Map(out.findAll(n => n.type === 'TEXT').map(t => [t.id, t.height]));
  if (oParts.al) execAL(out, oParts, plan, T);
  else { execFlat(out, oParts, plan, T); settleTexts(out, oParts, plan, heights0, notes); }
  fillRows(out, notes);
  alignPaneBottoms(plan, notes);
  placeOverlays(out, T, notes);
}

function selectedScreen() {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) return { error: sel.length ? 'Select exactly one screen frame' : 'Select a screen frame on the canvas…' };
  return { node: sel[0] };
}

function postSelection() {
  const { node, error } = selectedScreen();
  const parts = error ? { error } : screenParts(node);
  if (parts.error) { figma.ui.postMessage({ type: 'selection', ok: false, reason: parts.error }); return; }
  figma.ui.postMessage({ type: 'selection', ok: true, name: node.name, cw: rnd(parts.content.width), ch: rnd(parts.content.height), autoLayout: parts.al });
}

const report = obj => figma.ui.postMessage({ type: 'result', text: JSON.stringify(obj, null, 2) });

async function run(msg) {
  const t0 = Date.now();
  const { node, error } = selectedScreen();
  if (error) return report({ error });
  const parts = screenParts(node);
  if (parts.error) return report({ error: parts.error });

  if (msg.action === 'export') return report(dump(node));
  if (msg.action === 'check') return report({ action: 'check', result: check(node, null) });
  if (msg.action === 'import') return importJson(msg.json || '', node, parts, t0);

  const T = { w: msg.w, h: msg.h };
  const verr = validateTarget(T.w, T.h);
  if (verr.length) return report({ error: 'Invalid resolution', details: verr });

  // dry-run plan on the source (nothing changes) – stop early if the target is impossible
  const out = node.clone();
  await loadFonts(out);
  const oParts = screenParts(out);
  const notes = normalize(out, oParts);
  const plan = makePlan(oParts, T);
  if (plan.errors.length) {
    out.remove();
    return report({ action: 'reshape', result: 'not possible', source: node.name, plan: planForReport(plan) });
  }
  out.name = outputName(node, T);
  place(out);
  execute(out, oParts, plan, T, notes);

  figma.currentPage.selection = [out];
  figma.viewport.scrollAndZoomIntoView([out]);
  report({
    action: 'reshape', output: out.name, source: node.name, seconds: (Date.now() - t0) / 1000,
    plan: planForReport(plan), notes,
    checks: { source: check(node, null), output: check(out, plan, node) },
  });
}

figma.showUI(__html__, { width: 420, height: 900 });
figma.on('selectionchange', postSelection);
figma.ui.onmessage = msg => {
  if (msg.type === 'run') run(msg).catch(e => report({ error: String(e && e.stack || e) }));
};
postSelection();
