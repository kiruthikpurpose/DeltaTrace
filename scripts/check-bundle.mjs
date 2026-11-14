// Fails if the initial JavaScript (entry + vendor chunks referenced by index.html) exceeds the budget.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 400;
const html = readFileSync('dist/index.html', 'utf8');
const files = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
if (!files.length) throw new Error('No JavaScript entry found in dist/index.html (run the build first)');
let total = 0;
for (const f of files) {
  const kb = gzipSync(readFileSync(`dist/${f}`)).length / 1024;
  total += kb;
  console.log(`${f}  ${kb.toFixed(1)} kB gzip`);
}
console.log(`Initial JS: ${total.toFixed(1)} kB gzip (budget ${BUDGET_KB} kB)`);
if (total > BUDGET_KB) {
  console.error('Bundle budget exceeded');
  process.exit(1);
}
