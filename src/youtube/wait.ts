// Short-lived rAF wait for a UI reaction YouTube renders right after one of our clicks (bounded by ms).
export function waitFor<T>(probe: () => T | undefined, ms: number): Promise<T | undefined> {
  const end = performance.now() + ms;
  return new Promise((resolve) => {
    const tick = (): void => {
      const hit = probe();
      if (hit !== undefined || performance.now() > end) resolve(hit);
      else requestAnimationFrame(tick);
    };
    tick();
  });
}
