import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** Where to find the code and the npm library, with a note on what each one is. */
@Component({
  selector: 'app-project-links',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="links" aria-labelledby="links-title">
      <h2 id="links-title">Explore the technology</h2>
      <div class="cards">
        <article class="panel card">
          <h3><app-icon name="github" /> Open-source project</h3>
          <p>Explore the complete implementation, including the central portal and the six independent applications. The source code is publicly available under the MIT license.</p>
          <a
            class="btn-primary"
            href="https://github.com/stavgian/frontend-orchestration-platform"
            target="_blank"
            rel="noopener"
            >Explore on GitHub →</a
          >
        </article>
        <article class="panel card">
          <h3><app-icon name="npm" /> Application communication</h3>
          <p>See how independently developed applications exchange information and respond to updates through a lightweight shared communication library.</p>
          <a
            class="btn-primary"
            href="https://www.npmjs.com/package/@stavgian/mfe-communication"
            target="_blank"
            rel="noopener"
            >Explore the npm package →</a
          >
        </article>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: `
    :host { display: block; }
    .links { padding: 8px 2px 0; }
    h2 { margin: 0 0 14px; font: 600 20px var(--font-sans); letter-spacing: -0.01em; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px; }
    h3 { display: flex; align-items: center; gap: 10px; margin: 0; font: 600 17px/1.3 var(--font-sans); letter-spacing: -0.01em; }
    p { flex: 1; margin: 0 0 8px; color: var(--text-secondary); font-size: 14px; line-height: 1.55; }
    strong { color: var(--text); font-weight: 600; }
    h3 app-icon { font-size: 22px; }
    a { display: inline-block; text-decoration: none; }
  `,
})
export class ProjectLinksComponent {}
