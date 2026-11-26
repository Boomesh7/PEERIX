import { defineConfig } from 'vitest/config';

// Tests cover plain TypeScript logic and the database rules only; no React Native code runs here.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
