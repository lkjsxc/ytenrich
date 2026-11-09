// Add a repo image: node scripts/image.ts <src> <name>  ->  docs/images/<name>.webp (max 1920px wide, WebP q82).
// Names: kebab-case "<page>-<feature>[-<variant>]", e.g. watch-tiling-dark, stats-view-light.
import { mkdirSync, statSync } from 'node:fs';
import sharp from 'sharp';

const [src, name] = process.argv.slice(2);
if (!src || !name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  console.log('usage: node scripts/image.ts <src> <kebab-name>');
  process.exit(1);
}
mkdirSync('docs/images', { recursive: true });
const out = `docs/images/${name}.webp`;
const info = await sharp(src)
  .resize({ width: 1920, withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(out);
console.log(`ok ${out} ${info.width}x${info.height} ${Math.round(statSync(out).size / 1024)}KB`);
