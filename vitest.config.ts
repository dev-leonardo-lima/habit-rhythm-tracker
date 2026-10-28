import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const obsidianMock = fileURLToPath(new URL('./tests/mocks/obsidian.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      obsidian: obsidianMock,
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        branches: 80,
      },
    },
  },
});
