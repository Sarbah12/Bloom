#!/usr/bin/env node
/** Runs every offline check. Keep it green before committing. */
import { spawnSync } from 'node:child_process';

const steps = [
  ['types', 'npx', ['tsc', '--noEmit']],
  ['lint', 'npx', ['expo', 'lint', '--max-warnings', '0']],
  ['unit tests', 'npm', ['test', '--silent']],
  ['contrast', 'node', ['--experimental-strip-types', '--no-warnings', 'scripts/check-contrast.ts']],
  ['health copy', 'node', ['scripts/check-copy.mjs']],
  ['database schema + RLS', 'node', ['scripts/check-schema.mjs']],
];

let failed = 0;
for (const [name, cmd, args] of steps) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname });
  const ok = r.status === 0;
  const tail = (r.stdout + r.stderr).trim().split('\n').filter(Boolean);
  const summary = name === 'unit tests' ? tail.filter((l) => /^# (pass|fail)/.test(l)).join(', ') : (tail.slice(-1)[0] ?? '');
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(22)} ${((Date.now() - started) / 1000).toFixed(1)}s  ${summary}`);
  if (!ok) {
    failed++;
    console.log(
      tail
        .slice(-25)
        .map((l) => `    ${l}`)
        .join('\n'),
    );
  }
}
if (failed) {
  console.log(`\n${failed} check${failed === 1 ? '' : 's'} failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
