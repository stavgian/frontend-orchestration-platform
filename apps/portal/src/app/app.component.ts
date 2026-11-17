import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MfeDefinition } from './manifest';
import { MessageChannelComponent } from './message-channel.component';
import { MessageLogComponent } from './message-log.component';
import { MfeLoaderService } from './mfe-loader.service';
import { ToastStackComponent } from './toast-stack.component';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, MessageChannelComponent, MessageLogComponent, ToastStackComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly loader = inject(MfeLoaderService);
  private readonly router = inject(Router);

  mfes: MfeDefinition[] = [];
  loadingManifest = true;
  manifestError?: string;

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await this.loader.getManifest();
      this.mfes = manifest.mfes;
      this.redirectUnknownMfeRoute();
    } catch (err) {
      this.manifestError = (err as Error)?.message ?? 'Unable to load manifest';
    } finally {
      this.loadingManifest = false;
    }
  }

  private redirectUnknownMfeRoute(): void {
    if (!this.router.url.startsWith('/mfe/')) return;

    const id = this.router.routerState.snapshot.root.firstChild?.params['id'];
    const known = this.mfes.some((mfe) => mfe.id === id || mfe.route === id);
    const first = this.mfes[0];
    if (!known && first) {
      this.router.navigate(['mfe', first.route ?? first.id]);
    }
  }
}
