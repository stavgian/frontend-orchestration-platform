import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { buildBundle } from './build.mjs';

const PORT = 4301;
const ROOT = resolve(new URL('.', import.meta.url).pathname);

await buildBundle();

const mime = {
  '.js': 'application/javascript',
  '.map': 'application/json',
};

const server = createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';
  let file = url === '/' ? '/dist/remoteEntry.js' : url;
  if (url === '/remoteEntry.js') file = '/dist/remoteEntry.js';
  if (url === '/remoteEntry.js.map') file = '/dist/remoteEntry.js.map';
  const filePath = resolve(ROOT, `.${file}`);
  try {
    const data = await readFile(filePath);
    const type = mime[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`angular-mfe dev server running at http://localhost:${PORT}/dist/remoteEntry.js`);
});
