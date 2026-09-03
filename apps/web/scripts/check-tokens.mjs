/**
 * Fails if the app references a CSS custom property that nothing defines.
 *
 * Written because an audit found 155 such references across 27 files: names the
 * app had invented — `--text-primary`, `--error`, `--type-body-md`,
 * `--surface-muted` — that no token file declares. An undefined custom property
 * is silent. `color: var(--text-primary)` does not fall back to a default; the
 * declaration is invalid at computed-value time, so the element inherits
 * whatever its ancestor happened to set. One of them inherited a photo
 * placeholder's grey and rendered a badge at 2.97:1; the admin console's error
 * banners were not red. Nothing in the type system or the build can see this,
 * which is exactly why it needs its own check.
 *
 *   node scripts/check-tokens.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../src');
const STYLES = join(SRC, 'styles');

/**
 * Injected by next/font at runtime through a class on <html>, so they are
 * defined in the served document and cannot be found by reading the repo.
 */
const RUNTIME_DEFINED = new Set(['--font-ui-loaded', '--font-mono-loaded']);

function walk(dir, test) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p, test));
    else if (test(entry)) out.push(p);
  }
  return out;
}

const defined = new Set(RUNTIME_DEFINED);
for (const file of walk(STYLES, (f) => f.endsWith('.css'))) {
  for (const [, name] of readFileSync(file, 'utf8').matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
    defined.add(name);
  }
}

const problems = new Map();
for (const file of walk(SRC, (f) => /\.(tsx?|css)$/.test(f))) {
  const text = readFileSync(file, 'utf8');
  // Strip comments: component docs legitimately talk about `var(--token)`.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [, name] of code.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)) {
    if (defined.has(name)) continue;
    if (!problems.has(name)) problems.set(name, new Set());
    problems.get(name).add(relative(SRC, file).replaceAll('\\', '/'));
  }
}

if (problems.size === 0) {
  console.log(`ok: ${defined.size} tokens defined, every var() reference resolves`);
  process.exit(0);
}

console.error(`${problems.size} undefined custom propert${problems.size === 1 ? 'y' : 'ies'}:\n`);
for (const [name, files] of [...problems].sort((a, b) => b[1].size - a[1].size)) {
  console.error(`  ${name}  (${files.size} file${files.size === 1 ? '' : 's'})`);
  for (const f of [...files].sort()) console.error(`      ${f}`);
}
console.error('\nUse a token that exists, or define it in styles/app.css.');
process.exit(1);
