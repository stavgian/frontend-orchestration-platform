import { build as esbuild } from 'esbuild';
import { resolve } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname);
const entry = resolve(root, 'src/index.tsx');
const outfile = resolve(root, 'dist/react-mfe.js');

export async function buildBundle() {
  await esbuild({
    entryPoints: [entry],
    outfile,
    bundle: true,
    minify: false,
    sourcemap: true,
    format: 'iife',
    target: ['es2020'],
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    define: {
      'process.env.NODE_ENV': '"development"',
    },
    external: [],
  });

  console.log(`Built ${outfile}`);
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  await buildBundle();
}
