import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const PORT = 4303;
const ROOT = resolve(new URL('.', import.meta.url).pathname);

const mime = {
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
};

const server = createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';
  const file = url === '/' ? '/js-mfe.js' : url;
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
  console.log(`js-mfe dev server running at http://localhost:${PORT}/js-mfe.js`);
});
