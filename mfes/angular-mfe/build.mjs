import { build as esbuild } from 'esbuild';
import { resolve } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname);
const entry = resolve(root, 'src/main.ts');
const outfile = resolve(root, 'dist/remoteEntry.js');

export async function buildBundle() {
  await esbuild({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    sourcemap: true,
    minify: false,
    define: {
      'process.env.NODE_ENV': '"development"',
      // Build-time flags the Angular CLI normally sets; plain esbuild has to define them.
      ngDevMode: 'false',
      ngServerMode: 'false',
      ngHmrMode: 'false',
      ngJitMode: 'true',
      ngI18nClosureMode: 'false',
    },
  });

  console.log(`Built ${outfile}`);
}

// Allow running directly: `node build.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  await buildBundle();
}
