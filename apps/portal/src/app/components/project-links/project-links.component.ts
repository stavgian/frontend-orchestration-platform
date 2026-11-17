import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Where to find the code and the npm library, with a note on what each one is. */
@Component({
  selector: 'app-project-links',
  standalone: true,
  template: `
    <section class="links" aria-labelledby="links-title">
      <h2 id="links-title">Take a look inside</h2>
      <div class="cards">
        <article class="panel card">
          <h3>The code</h3>
          <p>
            The whole demo is open source (MIT): the shell portal, the four apps, the manifest and
            the messaging library. Read it, run it locally or open an issue.
          </p>
          <a
            class="btn-primary"
            href="https://github.com/stavgian/frontend-orchestration-platform"
            target="_blank"
            rel="noopener"
            >View the code on GitHub ↗</a
          >
        </article>
        <article class="panel card">
          <h3>The messaging library</h3>
          <p>
            <strong>&#64;stavgian/mfe-communication</strong> is the small npm package the four apps
            use to talk to each other: events, requests and presence. It is the only code they
            share, in under 4 KB with no dependencies. You will find it here.
          </p>
          <a
            class="btn-primary"
            href="https://www.npmjs.com/package/@stavgian/mfe-communication"
            target="_blank"
            rel="noopener"
            >Find it on npm ↗</a
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
    h3 { margin: 0; font: 600 17px/1.3 var(--font-sans); letter-spacing: -0.01em; }
    p { flex: 1; margin: 0 0 8px; color: var(--text-secondary); font-size: 14px; line-height: 1.55; }
    strong { color: var(--text); font-weight: 600; }
    a { display: inline-block; text-decoration: none; }
  `,
})
export class ProjectLinksComponent {}
