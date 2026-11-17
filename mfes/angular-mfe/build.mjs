import { build as esbuild } from 'esbuild';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transformAsync } from '@babel/core';
import {
  exitCodeFromResult,
  formatDiagnostics,
  performCompilation,
  readConfiguration,
} from '@angular/compiler-cli';
import angularLinker from '@angular/compiler-cli/linker/babel';

const root = resolve(new URL('.', import.meta.url).pathname);
const tsconfig = resolve(root, 'tsconfig.json');
const aotDir = resolve(root, '.aot');
const outfile = resolve(root, 'dist/remoteEntry.js');

// Step 1: compile the templates ahead of time (the same ngtsc the Angular CLI uses), so the
// bundle ships compiled components and not the JIT compiler that would compile them in the browser.
async function compileAhead() {
  const { options, rootNames, errors } = readConfiguration(tsconfig);
  if (errors.length) throw new Error(formatDiagnostics(errors));
  await rm(aotDir, { recursive: true, force: true });
  const result = performCompilation({ rootNames, options });
  if (exitCodeFromResult(result.diagnostics) !== 0) throw new Error(formatDiagnostics(result.diagnostics));
}

// Step 2: Angular's own packages are published partially compiled. The linker finishes them
// here, at build time; otherwise the browser would need the compiler to do it at runtime.
const linkAngularPackages = {
  name: 'angular-linker',
  setup(build) {
    build.onLoad({ filter: /node_modules[\\/]@angular[\\/].*\.m?js$/ }, async ({ path }) => {
      const code = await readFile(path, 'utf8');
      if (!code.includes('ɵɵngDeclare')) return null;
      const linked = await transformAsync(code, {
        filename: path,
        plugins: [angularLinker],
        configFile: false,
        babelrc: false,
        compact: false,
        sourceMaps: false,
      });
      return { contents: linked.code, loader: 'js' };
    });
  },
};

export async function buildBundle() {
  await compileAhead();

  await esbuild({
    entryPoints: [resolve(aotDir, 'main.js')],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    sourcemap: true,
    minify: true,
    plugins: [linkAngularPackages],
    define: {
      'process.env.NODE_ENV': '"production"',
      // Build-time flags the Angular CLI normally sets; plain esbuild has to define them.
      ngDevMode: 'false',
      ngServerMode: 'false',
      ngHmrMode: 'false',
      ngJitMode: 'false',
      ngI18nClosureMode: 'false',
    },
  });

  console.log(`Built ${outfile}`);
}

// Allow running directly: `node build.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  await buildBundle();
}
