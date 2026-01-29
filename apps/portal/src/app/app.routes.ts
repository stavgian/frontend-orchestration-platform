import { Route } from '@angular/router';
import { MfeHostComponent } from './mfe-host.component';

export const appRoutes: Route[] = [
  {
    path: 'mfe/:id',
    component: MfeHostComponent,
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'mfe/angular-mfe',
  },
  {
    path: '**',
    redirectTo: 'mfe/angular-mfe',
  },
];
