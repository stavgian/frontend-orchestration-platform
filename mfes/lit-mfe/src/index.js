// Risk: a Lit web component. It owns the risk score, recalculates it when other departments
// report activity, and answers anyone who asks (request/response) or listens (events).
import { LitElement, css, html } from 'lit';
// The only thing this app shares with the others: the published message library.
import { connect } from '@stavgian/mfe-communication';

// Fictional starting scores, keyed by the context id the shell announces.
const BASE = { 'CASE-2026-1082': 42, 'CASE-2026-1083': 61, 'CASE-2026-1084': 35, 'CASE-2026-1085': 48, 'CASE-2026-1086': 66 };
const levelOf = (score) => (score < 40 ? 'Low' : score < 60 ? 'Medium' : 'High');

class LitMfe extends LitElement {
  static properties = { ctx: { state: true }, scores: { state: true }, reasons: { state: true } };
  static styles = css`
    :host { display: block; font: 15px/1.5 var(--font-sans, Inter, system-ui, sans-serif); color: var(--text, #171a20); }
    .ctx { margin: 0 0 10px; font-size: 13px; color: var(--text-secondary, #5a6578); }
    .score { display: flex; align-items: baseline; gap: 10px; padding: 12px 14px; border-radius: 8px; background: var(--surface, #f7f8fa); }
    .score strong { font-size: 28px; }
    .bar { height: 8px; margin: 10px 0; border-radius: 9999px; background: var(--border, #e5e7eb); overflow: hidden; }
    .fill { height: 100%; background: #a16207; transition: width 300ms ease; }
    ul { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-secondary, #5a6578); }
    .empty { margin: 0; padding: 18px 12px; text-align: center; color: var(--text-secondary, #5a6578); font-size: 14px; border-radius: 8px; border: 2px dashed var(--border, #e5e7eb); }
  `;

  constructor() {
    super();
    this.ctx = null;
    // Local state per context id: current score and why it moved.
    this.scores = {};
    this.reasons = {};
  }

  scoreOf(id) {
    return this.scores[id] ?? BASE[id] ?? 50;
  }

  connectedCallback() {
    super.connectedCallback();
    this.bus = connect({
      id: 'lit-mfe',
      name: 'Risk',
      version: '1.0.0',
      meta: { framework: `Lit ${globalThis.litHtmlVersions?.at(-1) ?? ''}`.trim(), element: 'LitElement' },
    });
    // Follow the portal's active context; ask once in case it was announced before this app loaded.
    this.bus.subscribe('context:changed', ({ payload }) => (this.ctx = payload));
    this.bus.request('context:get', undefined, { to: 'portal' }).then((c) => c && (this.ctx = c), () => {});

    // Other departments report activity; Risk recalculates and tells everyone.
    this.bus.subscribe('document:uploaded', ({ payload: p }) =>
      this.adjust(p.contextId, p.kind === 'evidence' ? 4 : 1, `Document added: ${p.name}`));
    this.bus.subscribe('billing:updated', ({ payload: p }) =>
      this.adjust(p.contextId, 1, `Time billed: ${p.hours} h`));
    // Anyone may ask for the current score (Legal does).
    this.bus.respond('risk:get-score', ({ contextId }) => ({ score: this.scoreOf(contextId), level: levelOf(this.scoreOf(contextId)) }));
  }

  disconnectedCallback() {
    this.bus?.disconnect();
    super.disconnectedCallback();
  }

  adjust(contextId, delta, reason) {
    const score = Math.min(100, this.scoreOf(contextId) + delta);
    this.scores = { ...this.scores, [contextId]: score };
    this.reasons = { ...this.reasons, [contextId]: [reason, ...(this.reasons[contextId] ?? [])].slice(0, 4) };
    this.bus.publish('risk:assessment:updated', { contextId, score, level: levelOf(score), text: `Risk score is now ${score} (${levelOf(score).toLowerCase()})` });
  }

  render() {
    if (!this.ctx) return html`<p class="empty">Waiting for a context from the portal…</p>`;
    const id = this.ctx.contextId;
    const score = this.scoreOf(id);
    return html`
      <p class="ctx">Context <code>${id}</code></p>
      <div class="score"><strong>${score}</strong><span>${levelOf(score)} risk</span></div>
      <div class="bar"><div class="fill" style="width:${score}%"></div></div>
      <ul>${(this.reasons[id] ?? ['Baseline assessment']).map((r) => html`<li>${r}</li>`)}</ul>
    `;
  }
}

if (!customElements.get('lit-mfe')) customElements.define('lit-mfe', LitMfe);
