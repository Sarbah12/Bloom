#!/usr/bin/env node
/**
 * Guards the app's health copy:
 *  1. No wording that presents estimates as contraception or certainty.
 *  2. Every screen that shows a fertile window also shows the
 *     not-contraception disclaimer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const BANNED = [
  /\bsafe days?\b/i,
  /\binfertile days?\b/i,
  /\bguarantee/i,
  /can[’']?t get pregnant/i,
  /natural (birth control|contraception)/i,
  /\b100 ?% accurate\b/i,
  /\byou have (pcos|endometriosis|pmdd)\b/i,
];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|md)$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
  });
}

// Only places that hold words people read: screens, components and content.
const files = [
  ...['app', 'components', 'lib/content'].flatMap((d) => walk(join(root, d))),
  join(root, 'lib/notifications.ts'),
  join(root, 'lib/cycle/engine.ts'),
];
const problems = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const re of BANNED) {
    const m = text.match(re);
    if (m) problems.push(`${relative(root, file)}: banned phrase "${m[0]}"`);
  }
  const showsFertileWindow = /\.fertileStart\b/.test(text) && /formatRange|formatDate/.test(text);
  if (showsFertileWindow && file.includes('/app/') && !text.includes('CONTRACEPTION_DISCLAIMER')) {
    problems.push(`${relative(root, file)}: shows a fertile window without CONTRACEPTION_DISCLAIMER`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`copy: ${files.length} files free of contraception/certainty claims; fertile windows carry the disclaimer`);
