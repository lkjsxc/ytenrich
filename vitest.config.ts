import { defineConfig } from 'vitest/config';

export default defineConfig({ define: { __FIREFOX__: 'false' }, test: { maxWorkers: 4, environment: 'happy-dom', include: ['tests/**/*.test.ts'] } });
