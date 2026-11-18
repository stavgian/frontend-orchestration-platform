import { Route } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { ContextPageComponent } from './components/context-page/context-page.component';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', component: LandingComponent },
  // Any other single segment is a context id; the page redirects home when the scenario doesn't know it.
  { path: ':contextId', component: ContextPageComponent },
  { path: '**', redirectTo: '' },
];
