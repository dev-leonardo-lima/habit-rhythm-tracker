import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadCoverageThresholds } from './scripts/coverage-policy.mjs';

const obsidianMock = fileURLToPath(new URL('./tests/mocks/obsidian.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      obsidian: obsidianMock,
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.ts', 'scripts/**/*.mjs'],
      exclude: ['src/**/*.d.ts'],
      thresholds: loadCoverageThresholds(),
    },
  },
});
