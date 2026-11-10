import { describe, expect, it } from 'vitest';
import { nextVersion } from '../scripts/version.ts';

describe('version', () => {
  it('counts up by one and carries', () => {
    expect(nextVersion('0.2.0')).toBe('0.2.1');
    expect(nextVersion('0.2.99')).toBe('0.3.0');
    expect(nextVersion('0.9.99')).toBe('1.0.0');
    expect(nextVersion('9.9.99')).toBe('10.0.0');
    expect(() => nextVersion('0.12.0')).toThrow();
  });
});
