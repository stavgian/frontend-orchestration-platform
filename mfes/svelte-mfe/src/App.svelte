<svelte:options customElement="svelte-mfe" />

<script>
  // Client Relations: communication history for the active context.
  // The only thing this app shares with the others: the published message library.
  import { onDestroy } from 'svelte';
  import { connect } from '@stavgian/mfe-communication';

  // Fictional history, keyed by the context id the shell announces.
  const INITIAL = {
    'CASE-2026-1082': [{ when: '2026-11-02', text: 'Call with client: delivery dispute update' }],
    'CASE-2026-1083': [{ when: '2026-11-09', text: 'Email to client: brief timeline' }, { when: '2026-11-12', text: 'Client approved settlement range' }],
    'CASE-2026-1084': [{ when: '2026-11-05', text: 'Kick-off meeting with buyer' }],
    'CASE-2026-1085': [{ when: '2026-11-03', text: 'Client sent screenshots of the infringing listings' }],
    'CASE-2026-1086': [{ when: '2026-11-10', text: 'Call with client: authority deadline explained' }],
  };

  // Injected at build time from the installed svelte package.
  /* global __SVELTE_VERSION__ */

  let ctx = $state(null);
  // Local state: history per context id.
  let history = $state({});
  const rows = $derived(ctx ? (history[ctx.contextId] ?? INITIAL[ctx.contextId] ?? []) : []);

  const log = (contextId, text) => {
    history[contextId] ??= [...(INITIAL[contextId] ?? [])];
    history[contextId].push({ when: new Date().toISOString().slice(0, 10), text });
  };

  const bus = connect({
    id: 'svelte-mfe',
    name: 'Client Relations',
    version: '1.0.0',
    meta: { framework: `Svelte ${__SVELTE_VERSION__}`, element: 'Svelte custom element' },
  });
  // Follow the portal's active context; ask once in case it was announced before this app loaded.
  bus.subscribe('context:changed', ({ payload }) => (ctx = payload));
  bus.request('context:get', undefined, { to: 'portal' }).then((c) => c && (ctx = c), () => {});
  // Other departments' events become entries in the client's history.
  bus.subscribe('document:uploaded', ({ payload: p }) => log(p.contextId, `Client to be informed: "${p.name}" was added`));
  bus.subscribe('billing:updated', ({ payload: p }) => log(p.contextId, `Invoice draft updated: ${p.totalHours} h, €${p.amount}`));
  onDestroy(() => bus.disconnect());
</script>

{#if ctx}
  <p class="ctx">Context <code>{ctx.contextId}</code> · {rows.length} entries</p>
  <ul>
    {#each rows.toReversed() as r}
      <li><span class="when">{r.when}</span> {r.text}</li>
    {/each}
  </ul>
  <button onclick={() => log(ctx.contextId, 'Note added by account manager')}>Add note</button>
{:else}
  <p class="empty">Waiting for a context from the portal…</p>
{/if}

<style>
  :host { display: block; font: 15px/1.5 var(--font-sans, Inter, system-ui, sans-serif); color: var(--text, #171a20); }
  .ctx { margin: 0 0 10px; font-size: 13px; color: var(--text-secondary, #5a6578); }
  ul { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 6px; }
  li { padding: 8px 12px; border-radius: 8px; background: var(--surface, #f7f8fa); font-size: 14px; }
  .when { margin-right: 8px; font-size: 12px; font-weight: 600; color: #0e7490; }
  button { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 9999px; cursor: pointer; border: 0; color: #fff; background: #0e7490; }
  button:focus-visible { outline: 2px solid #0495d4; outline-offset: 3px; }
  .empty { margin: 0; padding: 18px 12px; text-align: center; color: var(--text-secondary, #5a6578); font-size: 14px; border-radius: 8px; border: 2px dashed var(--border, #e5e7eb); }
</style>
