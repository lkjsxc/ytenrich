import { defineConfig } from 'vitest/config';

export default defineConfig({ define: { __FIREFOX__: 'false' }, test: { environment: 'happy-dom', include: ['tests/**/*.test.ts'] } });
