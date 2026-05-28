import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin({ ssr: false }) as unknown as never],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/**/*.viz.{ts,tsx}',
        'src/**/*.panel.tsx',
        'src/**/index.ts',
        'src/viz.ts', // re-export barrel
        // Solid debug-UI in the shared viz layer (entity list, FPS overlay) —
        // ephemeral UI, not unit-tested. mountArcadeViz.ts (logic) stays in scope.
        'src/Components/_shared/viz/**/*.tsx',
      ],
    },
  },
});
