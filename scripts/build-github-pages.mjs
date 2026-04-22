import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portalDistDir = join(workspaceRoot, 'dist/apps/portal/browser');
const outputDir = join(workspaceRoot, 'dist/github-pages');
const repoName =
  process.env.GITHUB_REPOSITORY?.split('/')[1] || basename(workspaceRoot);
const explicitBasePath = process.env.PAGES_BASE_PATH;
const defaultBasePath = repoName.toLowerCase().endsWith('.github.io') ? '' : repoName;
const basePath = normalizeBasePath(explicitBasePath ?? defaultBasePath);
const baseHref = basePath ? `/${basePath}/` : '/';

const standalonePages = [
  {
    id: 'angular-mfe',
    title: 'Angular MFE',
    elementTag: 'angular-mfe',
    scriptFiles: ['remoteEntry.js'],
    sourceDir: join(workspaceRoot, 'mfes/angular-mfe/dist'),
  },
  {
    id: 'react-mfe',
    title: 'React MFE',
    elementTag: 'react-mfe',
    scriptFiles: ['react-mfe.js'],
    sourceDir: join(workspaceRoot, 'mfes/react-mfe/dist'),
  },
  {
    id: 'js-mfe',
    title: 'Vanilla JS MFE',
    elementTag: 'js-mfe',
    scriptFiles: ['js-mfe.js'],
    sourceDir: join(workspaceRoot, 'mfes/js-mfe'),
  },
];

run('npx', ['nx', 'build', 'portal', '--configuration', 'production', '--base-href', baseHref]);
run('node', ['mfes/angular-mfe/build.mjs']);
run('node', ['mfes/react-mfe/build.mjs']);

rmSync(outputDir, { force: true, recursive: true });
mkdirSync(outputDir, { recursive: true });

copyDirectory(portalDistDir, outputDir);

const indexHtml = join(outputDir, 'index.html');
if (existsSync(indexHtml)) {
  cpSync(indexHtml, join(outputDir, '404.html'));
}
writeFileSync(join(outputDir, '.nojekyll'), '');

for (const page of standalonePages) {
  const targetDir = join(outputDir, page.id);
  mkdirSync(targetDir, { recursive: true });

  for (const fileName of readdirSync(page.sourceDir)) {
    const sourcePath = join(page.sourceDir, fileName);
    if (page.scriptFiles.some((scriptFile) => fileName === scriptFile || fileName === `${scriptFile}.map`)) {
      cpSync(sourcePath, join(targetDir, fileName));
    }
  }

  const standaloneHtml = createStandaloneHtml(page.title, page.elementTag, page.scriptFiles);
  writeFileSync(join(targetDir, 'index.html'), standaloneHtml);
  writeFileSync(join(targetDir, '404.html'), standaloneHtml);
}

const manifestPath = join(outputDir, 'assets/manifest.prod.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.version = `${manifest.version}-github-pages`;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(`GitHub Pages bundle ready at ${outputDir}`);
console.log(`Portal base href: ${baseHref}`);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyDirectory(from, to) {
  if (!existsSync(from)) {
    throw new Error(`Missing build output: ${from}`);
  }

  cpSync(from, to, { recursive: true });
}

function createStandaloneHtml(title, elementTag, scriptFiles) {
  const scripts = scriptFiles
    .map((scriptFile) => `<script src="./${scriptFile}"></script>`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, sans-serif;
        background: radial-gradient(circle at top, #21314b 0%, #08111d 55%, #050a13 100%);
        color: #f6f8fb;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        box-sizing: border-box;
      }

      main {
        width: min(720px, 100%);
        display: grid;
        gap: 16px;
      }

      .hero {
        padding: 20px 24px;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(8, 17, 29, 0.72);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
      }

      h1 {
        margin: 0 0 8px;
        font-size: clamp(2rem, 5vw, 3rem);
      }

      p {
        margin: 0;
        color: #9fb1c9;
      }
    </style>
    ${scripts}
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>${title}</h1>
        <p>Standalone deployment for this microfrontend.</p>
      </section>
      <${elementTag}></${elementTag}>
    </main>
  </body>
</html>
`;
}

function normalizeBasePath(value) {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }

  return trimmed.replaceAll(/^\/+|\/+$/g, '');
}