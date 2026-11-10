// Build: node scripts/build.ts [--firefox] [--watch].
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as esbuild from 'esbuild';
import sharp from 'sharp';
import { chromiumManifest, firefoxManifest } from '../src/manifest.ts';

const watch = process.argv.includes('--watch');
const firefox = process.argv.includes('--firefox');
const out = firefox ? 'dist-firefox' : 'dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const common: esbuild.BuildOptions = {
  bundle: true,
  target: firefox ? 'firefox140' : 'chrome120',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  loader: { '.css': 'text' },
  define: { __FIREFOX__: String(firefox) },
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

const statics = async (): Promise<void> => {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  const manifest = { ...(firefox ? firefoxManifest : chromiumManifest), version };
  writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 1));
  cpSync('src/_locales', `${out}/_locales`, { recursive: true });
  copyFileSync('src/youtube/youtube.css', `${out}/youtube.css`);
  copyFileSync('src/pages/options/options.html', `${out}/options.html`);
  copyFileSync('LICENSE', `${out}/LICENSE`);
  await Promise.all(
    Object.entries(manifest.icons).map(([size, path]) =>
      sharp('src/icon.svg').resize(Number(size)).png().toFile(`${out}/${path}`),
    ),
  );
};

await statics();
if (watch) {
  for (const b of builds) await (await esbuild.context(b)).watch();
  console.log('watching');
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  console.log('ok build');
}
