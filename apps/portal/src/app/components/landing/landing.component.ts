import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ScenarioService } from '../../core/scenario/scenario.service';

/** `/`: describes the scenario and lists its records. Entirely driven by the scenario configuration. */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (scenario(); as s) {
      <p class="eyebrow">Example use case · {{ s.name }}</p>
      <section class="usecase" aria-label="Example use case">
        <div class="about">
          <h2>{{ s.name }}</h2>
          @for (p of s.useCase; track $index) {
            <p>{{ p }}</p>
          }
        </div>
        <div class="cases">
          <h2>{{ s.branding.recordsTitle }}</h2>
          <div class="panel table-wrap">
            <table>
              <thead>
                <tr><th><span class="sr">Action</span></th><th>Case reference</th><th>Case</th><th>Current status</th></tr>
              </thead>
              <tbody>
                @for (c of s.contexts; track c.id) {
                  <!-- The whole row opens the case; the link stays for keyboard and screen-reader users. -->
                  <tr (click)="open(c.id)">
                    <td class="go"><a [routerLink]="['/', c.id]" [attr.aria-label]="'Open case ' + c.id">Open case</a></td>
                    <td><code>{{ c.id }}</code></td>
                    <td class="title">{{ c.title }}</td>
                    <td><span class="status" [attr.data-tone]="c.tone">{{ c.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    .usecase { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: start; }
    .eyebrow { margin: 8px 0 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
    .about p:not(.eyebrow) { margin: 0 0 12px; color: var(--text-secondary); font-size: 15px; line-height: 1.65; }
    h2 { margin: 0 0 10px; font: 700 20px/1.2 var(--font-sans); letter-spacing: -0.02em; }
    .table-wrap { overflow-x: auto; }
    table { border-collapse: collapse; width: max-content; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); font-size: 14px; vertical-align: middle; white-space: nowrap; }
    th { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--subtle); background: var(--surface); }
    tr:last-child td { border-bottom: 0; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: var(--surface); }
    code { font: 500 13px var(--font-mono); }
    .title { font-weight: 600; }
    .status { padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; background: var(--surface); }
    .status[data-tone='active'] { color: var(--ok); }
    .status[data-tone='pending'] { color: #a16207; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .go a { padding: 6px 14px; border-radius: 99px; background: var(--accent); color: var(--on-color); font-size: 13px; font-weight: 600; text-decoration: none; }
    .go a:hover { background: var(--accent-dark); }
    @media (max-width: 1000px) { .usecase { grid-template-columns: 1fr; } }
    /* Phones: each case becomes a small card that fits the screen, no sideways scrolling. */
    @media (max-width: 640px) {
      table, tbody, tr, td { display: block; width: 100%; }
      thead { display: none; }
      tr { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
      td { padding: 0; border: 0; white-space: normal; width: auto; }
      td.go { grid-column: 2; grid-row: 1 / span 3; align-self: center; }
    }
  `,
})
export class LandingComponent {
  readonly scenario = inject(ScenarioService).scenario;
  private readonly router = inject(Router);

  open(id: string): void {
    void this.router.navigate(['/', id]);
  }
}
