import { Route } from '@angular/router';
import { MfeHostComponent } from './mfe-host.component';
import { AllMfesComponent } from './all-mfes.component';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: AllMfesComponent,
  },
  {
    path: 'mfe/:id',
    component: MfeHostComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
