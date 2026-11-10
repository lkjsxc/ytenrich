// Version scheme a.b.cd: one counter that goes up by one per release. No digit means more than another
// (no "major" or "minor"); the dots are only how the counter is written. `pnpm bump` writes the next one.
// Manifests cannot hold leading zeros, so package.json stores 0.2.5 and Chromium shows it as 0.2.05.
import { readFileSync, writeFileSync } from 'node:fs';

const parse = (v: string): [number, number, number] => {
  const m = /^(\d+)\.(\d)\.(\d{1,2})$/.exec(v);
  if (!m) throw new Error(`"${v}" is not an a.b.cd version (b: 0-9, cd: 0-99)`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

/** 0.2.5 → 0.2.6, 0.2.99 → 0.3.0, 0.9.99 → 1.0.0. */
export function nextVersion(v: string): string {
  const [a, b, c] = parse(v);
  const n = a * 1000 + b * 100 + c + 1;
  return `${Math.floor(n / 1000)}.${Math.floor(n / 100) % 10}.${n % 100}`;
}

/** The written form, with both digits of the last part: 0.2.5 → 0.2.05. */
export function displayVersion(v: string): string {
  const [a, b, c] = parse(v);
  return `${a}.${b}.${String(c).padStart(2, '0')}`;
}

if (process.argv[1]?.endsWith('version.ts')) {
  const text = readFileSync('package.json', 'utf8');
  const { version } = JSON.parse(text) as { version: string };
  const next = nextVersion(version);
  writeFileSync('package.json', text.replace(`"version": "${version}"`, `"version": "${next}"`));
  console.log(`${displayVersion(version)} → ${displayVersion(next)} (tag v${next})`);
}
