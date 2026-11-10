// Store packages from a clean commit: node scripts/package.ts
// → release/ytenrich-<version>-chromium.zip (Chrome Web Store, Edge Add-ons, Opera add-ons)
//   release/ytenrich-<version>-firefox.zip  (addons.mozilla.org)
//   release/ytenrich-<version>-source.zip   (reviewer source: bundled/minified code needs it on AMO/Opera)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';

const run = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
if (run('git', ['status', '--porcelain']).trim() && !process.argv.includes('--dirty')) {
  console.error('working tree is dirty: commit first (or pass --dirty for a local test package)');
  process.exit(1);
}
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const FIXED = new Date('2026-01-01T00:00:00Z'); // stable entry times: identical inputs give identical zips

const zipDir = (dir: string, file: string): void => {
  const entries: Record<string, [Uint8Array, { mtime: Date }]> = {};
  for (const rel of (readdirSync(dir, { recursive: true }) as string[]).sort()) {
    const path = join(dir, rel);
    if (statSync(path).isFile())
      entries[rel.split('\\').join('/')] = [readFileSync(path), { mtime: FIXED }];
  }
  writeFileSync(file, zipSync(entries, { level: 9 }));
  console.log(`${file} (${Object.keys(entries).length} files)`);
};

mkdirSync('release', { recursive: true });
run('node', ['scripts/build.ts']);
zipDir('dist', `release/ytenrich-${version}-chromium.zip`);
run('node', ['scripts/build.ts', '--firefox']);
zipDir('dist-firefox', `release/ytenrich-${version}-firefox.zip`);
const source = `release/ytenrich-${version}-source.zip`;
run('git', ['archive', '--format=zip', '-o', source, 'HEAD']);
console.log(`${source} (git HEAD ${run('git', ['rev-parse', '--short', 'HEAD']).trim()})`);
