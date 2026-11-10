// Versions are one counter that goes up by one per release, written with dots: 0.2.1, 0.2.2, … 0.2.99, 0.3.0.
// No part is a "major" or "minor"; the size of a change never picks the number. `pnpm bump` writes the next
// one. It is spelled the same in package.json, both manifests, the git tag and every store (no zero padding,
// which manifests forbid).
import { readFileSync, writeFileSync } from 'node:fs';

const parse = (v: string): [number, number, number] => {
  const m = /^(\d+)\.(\d)\.(\d{1,2})$/.exec(v);
  if (!m) throw new Error(`"${v}" is not a counter version a.b.c (b: 0-9, c: 0-99)`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

/** 0.2.5 → 0.2.6, 0.2.99 → 0.3.0, 0.9.99 → 1.0.0. */
export function nextVersion(v: string): string {
  const [a, b, c] = parse(v);
  const n = a * 1000 + b * 100 + c + 1;
  return `${Math.floor(n / 1000)}.${Math.floor(n / 100) % 10}.${n % 100}`;
}

if (process.argv[1]?.endsWith('version.ts')) {
  const text = readFileSync('package.json', 'utf8');
  const { version } = JSON.parse(text) as { version: string };
  const next = nextVersion(version);
  writeFileSync('package.json', text.replace(`"version": "${version}"`, `"version": "${next}"`));
  console.log(`${version} → ${next} (tag v${next})`);
}
