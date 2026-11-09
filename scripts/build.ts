// Build: node scripts/build.ts [--watch]. Outputs a loadable unpacked extension in dist/.
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { manifest } from '../src/manifest.ts';

const watch = process.argv.includes('--watch');
const out = 'dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const common: esbuild.BuildOptions = {
  bundle: true,
  target: ['chrome120', 'firefox128'],
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  loader: { '.css': 'text' },
  logLevel: 'warning',
  legalComments: 'none',
};
const builds: esbuild.BuildOptions[] = [
  {
    ...common,
    entryPoints: ['src/content/index.ts'],
    outfile: `${out}/content.js`,
    format: 'iife',
  },
  {
    ...common,
    entryPoints: ['src/background/index.ts'],
    outfile: `${out}/background.js`,
    format: 'esm',
  },
  {
    ...common,
    entryPoints: ['src/pages/options/index.ts'],
    outfile: `${out}/options.js`,
    format: 'esm',
  },
];

const statics = (): void => {
  writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 1));
  copyFileSync('src/youtube/youtube.css', `${out}/youtube.css`);
  copyFileSync('src/pages/options/options.html', `${out}/options.html`);
};

statics();
if (watch) {
  for (const b of builds) await (await esbuild.context(b)).watch();
  console.log('watching');
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  console.log('ok build');
}
