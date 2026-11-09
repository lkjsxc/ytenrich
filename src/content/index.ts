import { startFeatures } from './features.ts';
import { createRuntime } from './runtime.ts';

const boot = (): void => {
  const rt = createRuntime();
  startFeatures(rt);
};

if (document.documentElement) boot();
else document.addEventListener('readystatechange', boot, { once: true });
