import { Route } from '@angular/router';
import { MfeHostComponent } from './components/mfe-host/mfe-host.component';
import { MfeGalleryComponent } from './components/mfe-gallery/mfe-gallery.component';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: MfeGalleryComponent,
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
