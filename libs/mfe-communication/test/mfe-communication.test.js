import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Tests run against the built package, exactly as consumers receive it.
const { connect, DOM_EVENT, SPEC_VERSION, RequestError } = await import('../dist/index.js');

beforeEach(() => {
  globalThis.window = new EventTarget();
});

const schema = (check, message = 'invalid') => ({
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) => (check(value) ? { value } : { issues: [{ message }] }),
  },
});

test('messages arrive in a full envelope', () => {
  const a = connect({ id: 'a' });
  const b = connect({ id: 'b' });
  const received = [];
  b.subscribe('cart:item-added', (msg) => received.push(msg));

  const sent = a.publish('cart:item-added', { sku: 'A1' });

  assert.equal(received.length, 1);
  assert.deepEqual(received[0], sent);
  assert.equal(sent.specversion, SPEC_VERSION);
  assert.equal(sent.source, 'a');
  assert.equal(sent.type, 'cart:item-added');
  assert.deepEqual(sent.payload, { sku: 'A1' });
  assert.ok(sent.id && !Number.isNaN(Date.parse(sent.time)));
});

test('wildcards match a namespace or everything', () => {
  const a = connect({ id: 'a' });
  const cart = [];
  const all = [];
  a.subscribe('cart:*', (msg) => cart.push(msg.type));
  a.subscribe('*', (msg) => all.push(msg.type));

  a.publish('cart:item-added', {});
  a.publish('user:login', {});

  assert.deepEqual(cart, ['cart:item-added']);
  assert.deepEqual(all, ['cart:item-added', 'user:login']);
});

test('a direct message reaches only its target, and observers', () => {
  const cart = connect({ id: 'cart' });
  const checkout = connect({ id: 'checkout' });
  const catalog = connect({ id: 'catalog' });
  const portal = connect({ id: 'portal' });
  const got = { checkout: [], catalog: [], portalLog: [] };
  checkout.subscribe('checkout:start', (msg) => got.checkout.push(msg.payload));
  catalog.subscribe('*', (msg) => got.catalog.push(msg.type));
  portal.subscribe('checkout:*', (msg) => got.portalLog.push(msg.to), { observeAll: true });

  const sent = cart.publish('checkout:start', { count: 2 }, { to: 'checkout' });

  assert.equal(sent.to, 'checkout');
  assert.deepEqual(got.checkout, [{ count: 2 }]);
  assert.deepEqual(got.catalog, []);
  assert.deepEqual(got.portalLog, ['checkout']);
});

test('newcomers announce themselves and discover existing peers', () => {
  const portal = connect({ id: 'portal' });
  const changes = [];
  portal.onPeersChange((peers) => changes.push(peers.map((p) => p.id)));

  const react = connect({ id: 'react-mfe', version: '2.0.0' });

  assert.deepEqual(portal.peers(), [{ id: 'react-mfe', version: '2.0.0' }]);
  assert.deepEqual(react.peers(), [{ id: 'portal' }]);
  assert.deepEqual(changes, [[], ['react-mfe']]);
});

test('peers can share string metadata, e.g. their framework', () => {
  const portal = connect({ id: 'portal' });
  connect({ id: 'vue-app', meta: { framework: 'Vue 3.5.0', junk: 42 } });

  assert.deepEqual(portal.peers(), [{ id: 'vue-app', meta: { framework: 'Vue 3.5.0' } }]);
});

test('onPeersChange reports peers that were found before it was attached', () => {
  connect({ id: 'portal' });
  const late = connect({ id: 'late-app' }); // discovers the portal during connect()
  let seen;
  late.onPeersChange((peers) => (seen = peers.map((p) => p.id)));

  assert.deepEqual(seen, ['portal']);
});

test('disconnect announces leaving and stops all subscriptions', () => {
  const portal = connect({ id: 'portal' });
  const app = connect({ id: 'app' });
  let heard = 0;
  app.subscribe('*', () => heard++);

  app.disconnect();
  portal.publish('chat:hello', { text: 'hi' });

  assert.equal(heard, 0);
  assert.deepEqual(portal.peers(), []);
  assert.throws(() => app.publish('chat:hello', {}), /disconnected/);
});

test('a late goodbye from a remounted app does not remove its new instance', () => {
  const portal = connect({ id: 'portal' });
  const first = connect({ id: 'app' });
  connect({ id: 'app' }); // remounted before the first instance finished tearing down
  first.disconnect();

  assert.deepEqual(portal.peers().map((p) => p.id), ['app']);
});

test('publish rejects reserved, wildcard and empty types', () => {
  const a = connect({ id: 'a' });
  assert.throws(() => a.publish('system:ready', {}), /reserved/);
  assert.throws(() => a.publish('cart:*', {}), /only for subscribing/);
  assert.throws(() => a.publish('', {}), /non-empty/);
});

test('schemas validate on publish and on receive', () => {
  const warn = mock.method(console, 'warn', () => {});
  const schemas = { 'cart:item-added': schema((v) => typeof v?.sku === 'string', 'sku is required') };
  const strict = connect({ id: 'strict', schemas });
  const loose = connect({ id: 'loose' });
  const received = [];
  strict.subscribe('cart:item-added', (msg) => received.push(msg.payload));

  assert.throws(() => strict.publish('cart:item-added', {}), /sku is required/);
  loose.publish('cart:item-added', {}); // the loose app has no schema, so it can send this
  loose.publish('cart:item-added', { sku: 'A1' });

  assert.deepEqual(received, [{ sku: 'A1' }]);
  assert.equal(warn.mock.callCount(), 1);
  warn.mock.restore();
});

test('invalid envelopes from other code are skipped', () => {
  const warn = mock.method(console, 'warn', () => {});
  const a = connect({ id: 'a' });
  let count = 0;
  a.subscribe('*', () => count++);

  window.dispatchEvent(new CustomEvent(DOM_EVENT, { detail: { type: 'x' } }));
  window.dispatchEvent(new CustomEvent(DOM_EVENT, { detail: { specversion: '99', id: '1', type: 'x', source: 's', time: 't' } }));

  assert.equal(count, 0);
  assert.equal(warn.mock.callCount(), 2);
  warn.mock.restore();
});

test('a throwing handler does not stop the others', () => {
  const error = mock.method(console, 'error', () => {});
  const a = connect({ id: 'a' });
  let reached = false;
  a.subscribe('*', () => {
    throw new Error('boom');
  });
  a.subscribe('*', () => (reached = true));

  a.publish('chat:hello', {});

  assert.equal(reached, true);
  assert.equal(error.mock.callCount(), 1);
  error.mock.restore();
});

test('request resolves with the responder answer', async () => {
  const cart = connect({ id: 'cart' });
  const checkout = connect({ id: 'checkout' });
  cart.respond('cart:get-summary', async () => ({ count: 2, total: 30 }));

  assert.deepEqual(await checkout.request('cart:get-summary', undefined), { count: 2, total: 30 });
});

test('requests with `to` are answered only by that app', async () => {
  const a = connect({ id: 'a' });
  const b = connect({ id: 'b' });
  const asker = connect({ id: 'asker' });
  a.respond('who:are-you', () => 'a');
  b.respond('who:are-you', () => 'b');

  assert.equal(await asker.request('who:are-you', undefined, { to: 'b' }), 'b');
});

test('a throwing responder rejects the request with its message', async () => {
  const cart = connect({ id: 'cart' });
  const checkout = connect({ id: 'checkout' });
  cart.respond('cart:get-summary', () => {
    throw new Error('cart is locked');
  });

  await assert.rejects(checkout.request('cart:get-summary', undefined), (err) => {
    assert.ok(err instanceof RequestError);
    assert.equal(err.code, 'rejected');
    assert.equal(err.message, 'cart is locked');
    return true;
  });
});

test('a request nobody answers times out', async () => {
  const lonely = connect({ id: 'lonely' });
  await assert.rejects(lonely.request('nobody:home', {}, { timeout: 20 }), (err) => {
    assert.equal(err.code, 'timeout');
    assert.match(err.message, /No app answered "nobody:home" within 20 ms/);
    return true;
  });
});

test('a reply that arrives during the request dispatch is not lost', async () => {
  // Some environments (zone.js) run a responder's async work before dispatchEvent returns.
  // Simulate the extreme: a responder that replies synchronously, inside the dispatch.
  window.addEventListener(DOM_EVENT, (event) => {
    const m = event.detail;
    if (!m.expectsReply) return;
    window.dispatchEvent(
      new CustomEvent(DOM_EVENT, {
        detail: { specversion: '1', id: 'r1', type: 'system:reply', source: 'sync-app', time: new Date().toISOString(), to: m.source, inReplyTo: m.id, payload: { ok: true, value: 42 } },
      })
    );
  });
  const asker = connect({ id: 'asker' });

  assert.equal(await asker.request('sync:answer', undefined, { timeout: 100 }), 42);
});

test('only the first answer counts', async () => {
  const a = connect({ id: 'a' });
  const b = connect({ id: 'b' });
  const asker = connect({ id: 'asker' });
  a.respond('pick:one', () => 'a');
  b.respond('pick:one', () => 'b');

  assert.equal(await asker.request('pick:one', undefined), 'a');
});

test('ping measures a round trip to a live peer', async () => {
  connect({ id: 'cart' });
  const portal = connect({ id: 'portal' });

  const ms = await portal.ping('cart');
  assert.equal(typeof ms, 'number');
  assert.ok(ms >= 0);
  await assert.rejects(portal.ping('gone', { timeout: 20 }), (err) => err.code === 'timeout');
});

test('disconnect rejects pending requests', async () => {
  const asker = connect({ id: 'asker' });
  const pending = asker.request('slow:thing', {}, { timeout: 1000 });
  asker.disconnect();
  await assert.rejects(pending, (err) => err.code === 'disconnected');
});

test('one responder per type per connection, and system types are reserved', () => {
  const a = connect({ id: 'a' });
  a.respond('cart:get-summary', () => ({}));
  assert.throws(() => a.respond('cart:get-summary', () => ({})), /already responds/);
  assert.throws(() => a.respond('system:ping', () => ({})), /reserved/);
});

test('connect requires an id', () => {
  assert.throws(() => connect({}), /needs an id/);
});

test('importing does not require a window', async () => {
  delete globalThis.window;
  await assert.doesNotReject(import('../dist/index.js?fresh'));
});
