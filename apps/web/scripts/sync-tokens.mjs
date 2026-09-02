/**
 * Re-copies design tokens from design-system/ into src/styles/.
 *
 * The copies must stay byte-identical to upstream so that syncing is a copy and
 * never a merge. Overrides belong in src/styles/app.css, which this script does
 * not touch.
 *
 *   node scripts/sync-tokens.mjs          # copy
 *   node scripts/sync-tokens.mjs --check  # fail if drifted (for CI)
 */

import { readdirSync, readFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, '../../../design-system');
const TARGET = resolve(here, '../src/styles');

const check = process.argv.includes('--check');

const files = [
  ['styles.css', 'design-system.css'],
  ...readdirSync(join(SOURCE, 'tokens'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => [join('tokens', f), join('tokens', f)]),
];

mkdirSync(join(TARGET, 'tokens'), { recursive: true });

let drifted = 0;

for (const [from, to] of files) {
  const src = join(SOURCE, from);
  const dst = join(TARGET, to);

  if (check) {
    const same = existsSync(dst) && readFileSync(src).equals(readFileSync(dst));
    if (!same) {
      console.error(`drifted: ${to}`);
      drifted += 1;
    }
  } else {
    copyFileSync(src, dst);
    console.log(`copied:  ${to}`);
  }
}

if (check && drifted > 0) {
  console.error(`\n${drifted} token file(s) out of sync. Run: npm run tokens:sync`);
  process.exit(1);
}
