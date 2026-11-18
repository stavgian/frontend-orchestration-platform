import { build as esbuild } from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const svelteVersion = JSON.parse(readFileSync(createRequire(import.meta.url).resolve('svelte/package.json'), 'utf8')).version;

const root = resolve(new URL('.', import.meta.url).pathname);
const entry = resolve(root, 'src/index.js');
const outfile = resolve(root, 'dist/svelte-mfe.js');

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
    conditions: ['svelte', 'browser'],
    // `customElement` turns the component into a web component with its own shadow root.
    plugins: [sveltePlugin({ compilerOptions: { customElement: true } })],
    define: { 'process.env.NODE_ENV': '"production"', __SVELTE_VERSION__: JSON.stringify(svelteVersion) },
  });

  console.log(`Built ${outfile}`);
}

// Allow running directly: `node build.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  await buildBundle();
}
