// Build the generated files from their sources (no dependencies, Node 18+):
//   figma/assistant/digiteq-reshape-assistant.html  <- assistant-src/app.template.html + rules/DESIGN-RULES.md + logo
//   figma/plugin/ui.html                            <- plugin-src/ui.template.html + logo
// Run from the repo root:  node figma/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = p => readFileSync(join(root, p), 'utf8');

const rules = read('rules/DESIGN-RULES.md').trim();
if (rules.toLowerCase().includes('</script')) throw new Error('DESIGN-RULES.md must not contain "</script"');
const logo = readFileSync(join(root, 'figma/assets/digiteq-logo.png')).toString('base64');

const assistant = read('figma/assistant-src/app.template.html')
  .replace('__DEFAULT_RULES__', () => rules)
  .replace('__LOGO__', () => logo);
if (assistant.includes('__DEFAULT_RULES__') || assistant.includes('__LOGO__')) throw new Error('assistant template placeholders left');
writeFileSync(join(root, 'figma/assistant/digiteq-reshape-assistant.html'), assistant);

const ui = read('figma/plugin-src/ui.template.html').replace('__LOGO__', () => logo);
writeFileSync(join(root, 'figma/plugin/ui.html'), ui);

console.log(`built assistant (${(assistant.length / 1024).toFixed(0)} KB) and plugin ui.html (${(ui.length / 1024).toFixed(0)} KB)`);
