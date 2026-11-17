// Compile-time checks: `tsc` fails if declared message types stop being enforced.
import { Message, connect } from '../src/index';

declare module '../src/index' {
  interface MessageMap {
    'cart:item-added': { sku: string; qty: number };
  }
}

const bus = connect({ id: 'types-test' });

// Declared types get typed payloads.
bus.publish('cart:item-added', { sku: 'A1', qty: 1 });
// @ts-expect-error qty is missing
bus.publish('cart:item-added', { sku: 'A1' });
// @ts-expect-error sku must be a string
bus.publish('cart:item-added', { sku: 1, qty: 1 });

// Undeclared types still work, with an unknown payload.
bus.publish('anything:else', { whatever: true });

// Exact subscriptions receive the typed envelope.
bus.subscribe('cart:item-added', (msg) => {
  const sku: string = msg.payload.sku;
  const qty: number = msg.payload.qty;
  void [sku, qty];
});

// Wildcards receive a generic envelope.
bus.subscribe('cart:*', (msg: Message) => {
  // @ts-expect-error payload is unknown until narrowed
  void msg.payload.sku;
});

// Presence payloads are typed.
bus.subscribe('system:ready', (msg) => {
  const id: string = msg.payload.id;
  void id;
});
