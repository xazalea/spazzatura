import { defineConfig } from 'tsup';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json') as { version: string };

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  define: {
    '__SPAZ_VERSION__': JSON.stringify(pkg.version),
  },
});
