// Fails fast, with a clear message, when a dev port is already taken. Without this, one busy MFE port
// makes `concurrently -k` stop every server, including the portal, and the page stays empty.
import { createServer } from 'node:net';

const PORTS = { portal: 4200, 'angular-mfe': 4301, 'react-mfe': 4302, 'js-mfe': 4303, 'vue-mfe': 4304, 'svelte-mfe': 4305, 'lit-mfe': 4306 };

const isFree = (port) =>
  new Promise((resolve) => {
    const server = createServer().once('error', () => resolve(false));
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
  });

const busy = [];
for (const [name, port] of Object.entries(PORTS)) if (!(await isFree(port))) busy.push([name, port]);

if (busy.length) {
  console.error('Cannot start: these ports are already in use (probably an earlier `serve:all` is still running):');
  for (const [name, port] of busy) console.error(`  ${port}  ${name}`);
  console.error(`\nStop them with:\n  lsof -ti ${busy.map(([, p]) => `:${p}`).join(' -ti ')} | xargs kill`);
  process.exit(1);
}
