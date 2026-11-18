import { Component, ElementRef, Input, OnChanges, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MfeDefinition } from '../../core/manifest/manifest';
import { MfeLoaderService } from '../../core/mfe-loader/mfe-loader.service';

/** Loads one app from its manifest entry and mounts its custom element. The app is told nothing: it connects to the channel itself. */
@Component({
  selector: 'app-mfe-host',
  standalone: true,
  templateUrl: './mfe-host.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mfe-host.component.scss',
})
export class MfeHostComponent implements OnChanges {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLElement>;

  @Input({ required: true }) definition!: MfeDefinition;
  loading = false;
  error?: string;

  constructor(private readonly loader: MfeLoaderService) {}

  ngOnChanges(): void {
    void this.load();
  }

  /** After a failed load, fetches the app again (the loader forgets failed scripts). */
  retry(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = undefined;
    try {
      await this.loader.loadMfe(this.definition);
      const container = this.hostRef.nativeElement;
      container.replaceChildren(document.createElement(this.definition.customElement));
    } catch (err) {
      this.error = (err as Error)?.message ?? 'Failed to load microfrontend';
      this.hostRef.nativeElement.replaceChildren();
    } finally {
      this.loading = false;
    }
  }
}
