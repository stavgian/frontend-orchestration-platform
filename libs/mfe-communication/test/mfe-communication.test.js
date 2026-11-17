import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Tests run against the built package, exactly as consumers receive it.
const { EVENT_NAMES, publish, subscribe } = await import('../dist/index.js');

beforeEach(() => {
  globalThis.window = new EventTarget();
});

test('subscribers receive published messages', () => {
  const received = [];
  subscribe(EVENT_NAMES.statusMessage, (msg) => received.push(msg));

  publish(EVENT_NAMES.statusMessage, { text: 'hi', source: 'test' });

  assert.deepEqual(received, [{ text: 'hi', source: 'test' }]);
});

test('every subscriber hears the same message', () => {
  let count = 0;
  subscribe(EVENT_NAMES.statusMessage, () => count++);
  subscribe(EVENT_NAMES.statusMessage, () => count++);

  publish(EVENT_NAMES.statusMessage, { text: 'hi' });

  assert.equal(count, 2);
});

test('unsubscribe stops delivery', () => {
  let count = 0;
  const stop = subscribe(EVENT_NAMES.statusMessage, () => count++);
  stop();

  publish(EVENT_NAMES.statusMessage, { text: 'hi' });

  assert.equal(count, 0);
});

test('publish rejects payloads missing required fields', () => {
  assert.throws(() => publish(EVENT_NAMES.statusMessage, { text: '' }), /missing string fields text/);
  assert.throws(() => publish(EVENT_NAMES.statusMessage, null), /expected an object/);
});

test('publish rejects unknown event names', () => {
  assert.throws(() => publish('nope', { text: 'hi' }), /Unknown event "nope"/);
});

test('subscribers skip invalid messages sent by other code', () => {
  const warn = mock.method(console, 'warn', () => {});
  let count = 0;
  subscribe(EVENT_NAMES.statusMessage, () => count++);

  window.dispatchEvent(new CustomEvent(EVENT_NAMES.statusMessage, { detail: { nope: 1 } }));
  window.dispatchEvent(new CustomEvent(EVENT_NAMES.statusMessage));

  assert.equal(count, 0);
  assert.equal(warn.mock.callCount(), 2);
  warn.mock.restore();
});

test('importing does not require a window', async () => {
  delete globalThis.window;
  await assert.doesNotReject(import('../dist/index.js?fresh'));
});
