import { build as esbuild } from 'esbuild';
import { resolve } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname);
const entry = resolve(root, 'src/index.js');
const outfile = resolve(root, 'dist/lit-mfe.js');

export async function buildBundle() {
  await esbuild({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    sourcemap: true,
    minify: true,
  });

  console.log(`Built ${outfile}`);
}

// Allow running directly: `node build.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  await buildBundle();
}
