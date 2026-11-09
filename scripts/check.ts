// Canonical gate: repo rules + tsc + biome + vitest. Prints one "ok check" line or the failures.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === 'fixtures' ? [] : walk(p)) : [p];
  });
const problems: string[] = [];
const files = [
  ...walk('src'),
  ...walk('scripts'),
  ...walk('tests'),
  ...walk('docs'),
  'AGENTS.md',
  'README.md',
];
const YT_DOM = /['"`(\s](ytd-|ytm-|yt-[a-z]|tp-yt-|#movie_player|#related\b|#secondary\b)/;

for (const f of files) {
  if (f.startsWith('docs/images/')) {
    if (!f.endsWith('.webp')) problems.push(`${f}: images must be .webp (use pnpm image)`);
    else if (statSync(f).size > 600 * 1024) problems.push(`${f}: image over 600KB`);
    continue;
  }
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n').length;
  if (lines > 200) problems.push(`${f}: ${lines} lines (max 200)`);
  if (!f.startsWith('src/') || !/\.(ts|css)$/.test(f)) continue;
  if (/^\s*(export\s+)?class\s/m.test(text))
    problems.push(`${f}: class declaration (use create* factories)`);
  if (/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/.test(text))
    problems.push(`${f}: HTML string sink (YouTube enforces Trusted Types; use h())`);
  if (!f.startsWith('src/youtube/') && YT_DOM.test(text))
    problems.push(`${f}: YouTube DOM name outside src/youtube/`);
}

const run = (name: string, cmd: string): void => {
  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    problems.push(
      `${name} failed:\n${String(err.stdout ?? '')}${String(err.stderr ?? '')}`.slice(0, 4000),
    );
  }
};
run('tsc', 'node_modules/.bin/tsc -p .');
run('biome', 'node_modules/.bin/biome check .');
run('vitest', 'node_modules/.bin/vitest run');

if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log('ok check');
