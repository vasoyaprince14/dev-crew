import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'bin/dev-crew.ts',
  },
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: { entry: 'src/index.ts' },
  sourcemap: true,
  splitting: false,
  shims: true,
});
