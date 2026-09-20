// Regression test for the Digiteq Reshape Plugin – runs the real plugin code (figma/plugin/code.js)
// against a small Figma mock with FLAT versions of the three POC screens (S1 Home, S2 Category, S3 Tip detail).
// Run from the repo root:  node figma/tests/simulate.js      (exit code 1 on any failure)
//
// Limits: the mock implements only what the plugin uses. Text wrapping is approximated (0.45 × font size per
// character, line height 1.2 × font size) and calibrated against real Figma exports. Auto layout is NOT
// simulated – the auto-layout path has to be tested in Figma (page "01 Wide · Auto layout").
//
// Minimal Figma mock for flat (no auto layout) frames
let nid = 1;
class N {
  constructor(type, name, x, y, w, h, kids = [], extra = {}) {
    Object.assign(this, { type, name, x, y, width: w, height: h, visible: true, id: 'n' + nid++, layoutMode: 'NONE', layoutPositioning: 'AUTO', parent: null }, extra);
    if (type !== 'TEXT' && type !== 'RECTANGLE') { this.children = []; kids.forEach(k => this.appendChild(k)); }
  }
  appendChild(k) { if (k.parent) k.parent.children.splice(k.parent.children.indexOf(k), 1); k.parent = this; this.children.push(k); }
  insertChild(i, k) { if (k.parent) k.parent.children.splice(k.parent.children.indexOf(k), 1); k.parent = this; this.children.splice(i, 0, k); }
  remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  resizeWithoutConstraints(w, h) { this.width = w; this.height = h; }
  resize(w, h) {
    this.width = w; this.height = h;
    if (this.type === 'TEXT' && this.textAutoResize === 'HEIGHT' && this.characters) {
      const lines = Math.max(1, Math.ceil(this.characters.length * 0.45 * this.fontSize / w));
      this.height = lines * Math.round(this.fontSize * 1.2);
    }
  }
  findAll(f) { const o = []; const walk = n => { if (!n.children) return; for (const c of n.children) { if (f(c)) o.push(c); walk(c); } }; walk(this); return o; }
  findOne(f) { return this.findAll(f)[0] || null; }
  clone() { const c = cloneDeep(this); page.appendChild(c); return c; }
  get absX() { return this.x + (this.parent && this.parent.parent ? this.parent.absX : 0); }
  get absY() { return this.y + (this.parent && this.parent.parent ? this.parent.absY : 0); }
  get absoluteBoundingBox() { return { x: this.absX, y: this.absY, width: this.width, height: this.height }; }
  get absoluteTransform() { return [[1, 0, this.absX], [0, 1, this.absY]]; }
}
function cloneDeep(n) {
  const c = Object.create(N.prototype);
  for (const k of Object.keys(n)) if (k !== 'children' && k !== 'parent') c[k] = n[k];
  c.id = 'n' + nid++; c.parent = null;
  if (n.children) { c.children = []; n.children.forEach(k => { const kk = cloneDeep(k); kk.parent = c; c.children.push(kk); }); }
  return c;
}
const F = (name, x, y, w, h, kids, extra) => new N('FRAME', name, x, y, w, h, kids, extra);
const T = (name, x, y, w, h, chars, fs = 26, mode = 'HEIGHT') => new N('TEXT', name, x, y, w, h, [], { characters: chars, fontSize: fs, textAutoResize: mode, fontName: { family: 'Inter', style: 'Regular' } });
const BTN = (name, x, y, w = 200) => F(name, x, y, w, 76, [T(name + '_label', 16, 24, Math.min(100, w - 32), 30, 'Go', 26, 'WIDTH_AND_HEIGHT')]);
const icon = (x, y, s = 32) => F('icon', x, y, s, s);

function buildS2() {
  const rows = [];
  const titles = ['Stop-and-go with adaptive cruise control','Keep your lane with Lane Assist','Park hands-free with Park Assist','Use the area view camera','Pre-heat the cabin before winter drives','Clear foggy windows fast','Adjust the steering assist level'];
  for (let i = 1; i <= 7; i++) rows.push(F('category_tip_row_' + i, 0, (i - 1) * 120, 1034, 104, [
    F('icon_bg', 24, 24, 56, 56, [icon(14, 14, 28)]),
    F('text', 104, 21, 854, 62, [T(`category_tip_row_${i}_title`, 0, 0, 854, 31, titles[i-1]), T(`category_tip_row_${i}_subtitle`, 0, 35, 854, 27, 'Assistants · 1 min', 22)]),
    icon(982, 38, 28)]));
  const header = F('category_header', 0, 0, 1840, 132, [
    F('category_header_left', 24, 28, 456, 76, [BTN('category_back_button', 0, 0, 76), T('category_title', 100, 18, 140, 48, 'Driving', 40, 'WIDTH_AND_HEIGHT'), BTN('category_filter_button', 264, 0, 192)]),
    F('category_tabs', 560, 18, 684, 96, ['all', 'assistants', 'parking', 'winter'].map((t, i) => F('category_tab_' + t, i * 173, 0, 165, 96, [T('category_tab_' + t + '_label', 40, 32, 85, 32, t, 26, 'WIDTH_AND_HEIGHT')]))),
    BTN('category_search_button', 1740, 28, 76)]);
  const preview = F('category_tip_preview', 24, 24, 704, 912, [
    F('category_tip_preview_image', 32, 32, 640, 300, [icon(288, 118, 64)]),
    T('category_tip_preview_meta', 32, 352, 300, 27, 'META', 22, 'WIDTH_AND_HEIGHT'),
    T('category_tip_preview_title', 32, 399, 640, 96, 'Stop and go with ACC', 40),
    T('category_tip_preview_body', 32, 515, 640, 64, 'Body', 26),
    F('spacer', 32, 599, 1, 1),
    BTN('category_open_button', 32, 804)]);
  const list = F('category_tip_list', 760, 24, 1056, 912, [F('category_tip_list_rows', 0, 0, 1034, 912, rows), F('category_tip_list_scrollbar', 1050, 0, 6, 912, [F('thumb', 0, 0, 6, 180)])]);
  const content = F('category_content', 0, 132, 1840, 960, [preview, list]);
  const dd = F('category_filter_dropdown', 288, 140, 452, 300, [], { visible: false });
  return F('S2_Category_Wide', 100, 100, 1840, 1092, [header, content, dd]);
}
function buildS3() {
  const steps = F('tip_steps', 0, 0, 1056, 400, [1, 2, 3, 4].map(i => F('tip_step_' + i, 0, (i - 1) * 104, 1056, 88, [F('number', 24, 16, 56, 56), T(`tip_step_${i}_text`, 104, 28, 928, 32, 'Step')])));
  const seg = F('tip_distance_segmented', 24, 60, 1008, 88, ['close', 'medium', 'far'].map((o, i) => F('tip_distance_option_' + o, 6 + i * 334, 6, 328, 76, [T('tip_distance_option_' + o + '_label', 130, 22, 70, 32, o, 26, 'WIDTH_AND_HEIGHT')])));
  const setting = F('tip_distance_setting', 0, 416, 1056, 168, [T('tip_distance_setting_label', 24, 20, 300, 32, 'Try', 26, 'WIDTH_AND_HEIGHT'), seg]);
  const toggle = F('tip_helpful_toggle', 0, 600, 1056, 96, [T('tip_helpful_toggle_label', 24, 32, 800, 32, 'Show', 26, 'WIDTH_AND_HEIGHT'), F('switch', 944, 24, 88, 48)]);
  const nav = F('tip_nav', 0, 836, 1056, 76, [BTN('tip_prev_button', 0, 0, 200), BTN('tip_next_button', 856, 0, 200)]);
  const body = F('tip_body', 760, 24, 1056, 912, [steps, setting, toggle, F('spacer', 0, 712, 1, 1), nav]);
  const header = F('tip_header', 0, 0, 1840, 132, [T('tip_title', 40, 44, 726, 44, 'Title', 36, 'WIDTH_AND_HEIGHT'), F('tip_header_actions', 1556, 28, 260, 76, [BTN('tip_save_button', 0, 0, 76), BTN('tip_back_button', 92, 0, 76), BTN('tip_search_button', 184, 0, 76)])]);
  const content = F('tip_content', 0, 132, 1840, 960, [F('tip_image', 24, 24, 704, 912, [icon(304, 408, 96)]), body]);
  return F('S3_TipDetail_Wide', 100, 1400, 1840, 1092, [header, content]);
}
function buildS1() {
  const cards = r => F('home_category_cards_row_' + r, 0, (r - 1) * 472, 960, 440, [1, 2].map(i => F('home_category_card_' + ['driving','comfort','efficiency','safety'][(r-1)*2+i-1], (i - 1) * 496, 0, 464, 440, [F('icon_bg', 32, 32, 76, 76, [icon(20, 20, 36)]), F('spacer', 32, 116, 1, 210), T('home_card_title_' + r + i, 32, 334, 200, 39, 'Driving', 32, 'WIDTH_AND_HEIGHT'), T('home_card_count_' + r + i, 32, 381, 100, 27, '14 tips', 22, 'WIDTH_AND_HEIGHT')])));
  const featured = F('home_featured_tip', 24, 24, 800, 912, [F('home_featured_tip_image', 32, 32, 736, 340, [icon(336, 138, 64)]), T('home_featured_tip_label', 32, 392, 200, 27, 'TIP', 22, 'WIDTH_AND_HEIGHT'), T('home_featured_tip_title', 32, 439, 736, 96, 'Title', 40), T('home_featured_tip_body', 32, 555, 736, 64, 'Body'), F('spacer', 32, 639, 1, 1), BTN('home_featured_tip_open_button', 32, 804)]);
  const header = F('home_header', 0, 0, 1840, 132, [F('home_header_left', 24, 28, 186, 76, [BTN('home_settings_button', 0, 0, 76), T('home_title', 100, 18, 80, 48, 'Tips', 40, 'WIDTH_AND_HEIGHT')])]);
  const content = F('home_content', 0, 132, 1840, 960, [featured, F('home_category_cards', 856, 24, 960, 912, [cards(1), cards(2)])]);
  return F('S1_Home_Wide', 100, 2800, 1840, 1092, [header, content]);
}

const page = new N('PAGE', 'p', 0, 0, 0, 0, [buildS1(), buildS2(), buildS3()]); page.selection = [];
let lastMsg = null, handler = null;
global.figma = {
  mixed: Symbol('mixed'), currentPage: page,
  loadFontAsync: async () => {}, createFrame: () => new N('FRAME', 'f', 0, 0, 100, 100),
  showUI() {}, on() {}, viewport: { scrollAndZoomIntoView() {} },
  ui: { postMessage: m => { lastMsg = m; }, set onmessage(f) { handler = f; } },
};
global.__html__ = '';
require(require('path').join(__dirname, '../plugin/code.js'));


const fs = require('fs'), path = require('path');
const wait = () => new Promise(r => setTimeout(r, 5));
let failed = 0, passed = 0;
function ok(cond, name, info) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (info ? '\n       ' + info : '')); }
}
async function run(msg, sel) { page.selection = [sel]; handler(msg); await wait(); return JSON.parse(lastMsg.text); }
const byName = n => page.children.find(c => c.name === n);

(async () => {
  // give S2 row 1 a "selected" stroke like the real file
  const s2src = byName('S2_Category_Wide');
  s2src.findAll(n => /_row_\d+$/.test(n.name)).forEach(r => { r.strokes = r.name.endsWith('_1') ? [{ type: 'SOLID', visible: true }] : []; });

  console.log('Script reshape');
  const cases = [
    ['S1_Home_Wide', 1400, 1400, 'pass', 'stack'], ['S1_Home_Wide', 1840, 960, 'pass', 'side'],
    ['S1_Home_Wide', 1200, 1800, 'pass', 'stack'], ['S1_Home_Wide', 960, 600, 'fail', 'stack'],
    ['S2_Category_Wide', 1400, 1400, 'pass', 'side'], ['S2_Category_Wide', 1840, 960, 'pass', 'side'],
    ['S2_Category_Wide', 1200, 1800, 'pass', 'side'], ['S2_Category_Wide', 960, 600, 'notpossible'],
    ['S3_TipDetail_Wide', 1400, 1400, 'pass', 'stack'], ['S3_TipDetail_Wide', 1840, 960, 'pass', 'side'],
    ['S3_TipDetail_Wide', 1200, 1800, 'pass', 'stack'], ['S3_TipDetail_Wide', 960, 600, 'notpossible'],
  ];
  for (const [src, w, h, expect, mode] of cases) {
    const r = await run({ type: 'run', action: 'reshape', w, h }, byName(src));
    const label = `${src} -> ${w}x${h} (${expect}${mode ? ', ' + mode : ''})`;
    if (expect === 'notpossible') { ok(r.result === 'not possible', label, JSON.stringify(r.plan && r.plan.errors)); continue; }
    const out = r.checks && r.checks.output;
    ok(out && (expect === 'pass' ? out.pass : !out.pass) && r.plan.mode === mode, label, out ? out.fails.join(' / ') : JSON.stringify(r));
  }
  const bad = await run({ type: 'run', action: 'reshape', w: 12, h: 5 }, byName('S1_Home_Wide'));
  ok(bad.error === 'Invalid resolution', 'invalid resolution 12x5 is rejected');

  console.log('Details');
  const s2sq = byName('S2_Category_1400x1400');
  const rows = s2sq.findOne(n => n.name === 'category_tip_list_rows').children.filter(r => r.visible);
  ok(rows.length === 11, 'S2 square: 11 visible rows', 'got ' + rows.length);
  ok(page.children.filter(n => /_row_\d+$/.test(n.name)).length === 0, 'no row clones left on the page');
  ok(rows.filter(r => r.strokes && r.strokes.length).length === 1, 'only one row keeps the "selected" stroke');
  const s2tall = byName('S2_Category_1200x1800');
  const tallRows = s2tall.findOne(n => n.name === 'category_tip_list_rows').children.filter(r => r.visible);
  ok(new Set(tallRows.map(r => Math.round(r.height))).size === 1, 'S2 1200x1800: all rows one height', tallRows.map(r => r.height).join(','));
  const lastBottom = Math.max(...tallRows.map(r => r.y + r.height));
  const preview = s2tall.findOne(n => n.name === 'category_tip_preview'), list = s2tall.findOne(n => n.name === 'category_tip_list');
  ok(Math.abs(preview.height - lastBottom) < 1 && Math.abs(list.height - lastBottom) < 1, 'S2 1200x1800: R7 panes end at the last row', `preview ${preview.height}, list ${list.height}, rows end ${lastBottom}`);
  const nav = byName('S3_TipDetail_1400x1400').findOne(n => n.name === 'tip_nav');
  const prev = nav.children.find(n => n.name === 'tip_prev_button'), next = nav.children.find(n => n.name === 'tip_next_button');
  ok(prev.width === 200 && next.width === 200 && prev.x === 0 && next.x + next.width === nav.width, 'S3 square: nav buttons keep size, pinned left/right');
  const card = byName('S1_Home_1400x1400').findOne(n => n.name === 'home_category_card_driving');
  const icon = card.children.find(n => n.name === 'icon_bg');
  ok(icon.y === 32 && card.children.every(k => k.y >= 0 && k.y + k.height <= card.height + 0.5), 'S1 square: category card content stays inside (spacer rule)');
  const back = await run({ type: 'run', action: 'reshape', w: 1840, h: 960 }, byName('S1_Home_1400x1400'));
  ok(back.checks && back.checks.output.pass && back.plan.mode === 'side', 'round trip: S1 square -> wide again');
  const back2 = await run({ type: 'run', action: 'reshape', w: 1840, h: 960 }, s2sq);
  const wideRows = byName(back2.output).findOne(n => n.name === 'category_tip_list_rows').children.filter(r => r.visible);
  ok(back2.checks.output.pass && wideRows.every(r => r.height === 104), 'round trip: S2 square -> wide keeps list rows at 104 (rows are never scaled)', back2.checks.output.fails.join(' / '));

  console.log('Import (LLM path)');
  const answer = fs.readFileSync(path.join(__dirname, 'sample-llm-answer-s2.txt'), 'utf8');
  const imp = await run({ type: 'run', action: 'import', json: answer }, s2sq);
  ok(imp.kind === 'plan' && imp.checks.output.pass, 'sample LLM answer (S2 square -> wide) imports and passes', JSON.stringify(imp.checks || imp));
  const rej = await run({ type: 'run', action: 'import', json: JSON.stringify({ target: { w: 1400, h: 1400 }, mode: 'stack', panes: [{ name: 'nope', x: 0, y: 0, w: 100, h: 100 }] }) }, byName('S3_TipDetail_Wide'));
  ok(rej.result === 'rejected' && rej.errors.some(e => e.includes('unknown pane')), 'broken plan is rejected with reasons');
  const fix = await run({ type: 'run', action: 'import', json: JSON.stringify({ overrides: [{ path: 'tip_header_actions/tip_save_button', visible: false }] }) }, byName('S3_TipDetail_1400x1400'));
  ok(fix.kind === 'fix' && fix.overrideErrors.length === 0, 'fix (overrides) applies in place');
  const garbage = await run({ type: 'run', action: 'import', json: 'no json here' }, byName('S3_TipDetail_Wide'));
  ok(/Could not read JSON/.test(garbage.error || ''), 'garbage input is refused');

  console.log('Figma sandbox compatibility');
  const code = fs.readFileSync(path.join(__dirname, '../plugin/code.js'), 'utf8');
  const banned = [/(^|[^.])\bimport\s*(\(|\/[/*])/m, /<!--/, /-->/, /\beval\s*\(/, /new Function\s*\(/];
  ok(!banned.some(re => re.test(code)), 'code.js has no patterns the Figma sandbox rejects (import( , HTML comments, eval)');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
