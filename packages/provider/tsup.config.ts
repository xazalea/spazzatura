import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  // Playwright and its native deps must not be bundled — they are optional at runtime
  external: [
    'playwright',
    'playwright-core',
    'chromium-bidi',
    'https-proxy-agent',
    'socks-proxy-agent',
  ],
});
