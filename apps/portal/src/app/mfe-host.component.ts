import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MfeDefinition } from '@frontend/shared-contract';
import { MfeLoaderService } from './mfe-loader.service';
import { Subscription, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-mfe-host',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mfe-host.component.html',
  styleUrl: './mfe-host.component.scss',
})
export class MfeHostComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLElement>;

  @Input() definition?: MfeDefinition;
  loading = false;
  error?: string;

  private sub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly loader: MfeLoaderService
  ) {}

  ngOnInit(): void {
    if (this.definition) {
      void this.loadDefinition(this.definition);
      return;
    }

    this.sub = this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            return of(null);
          }

          this.loading = true;
          this.error = undefined;

          return from(this.loader.getManifest()).pipe(
            map((manifest) =>
              manifest.mfes.find((mfe) => mfe.id === id || mfe.route === id)
            ),
            switchMap((definition) => {
              if (!definition) {
                throw new Error(`MFE ${id} not found in manifest`);
              }

              this.definition = definition;
              return from(this.loader.loadMfe(definition)).pipe(
                tap(() => this.mount(definition))
              );
            })
          );
        }),
        tap(() => (this.loading = false)),
        catchError((err) => {
          this.loading = false;
          this.error = err?.message ?? 'Failed to load microfrontend';
          this.clearHost();
          return of(null);
        })
      )
      .subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['definition'] && this.definition) {
      void this.loadDefinition(this.definition);
    }
  }

  private loadDefinition(definition: MfeDefinition) {
    this.loading = true;
    this.error = undefined;

    return from(this.loader.loadMfe(definition))
      .pipe(
        tap(() => this.mount(definition)),
        tap(() => (this.loading = false)),
        catchError((err) => {
          this.loading = false;
          this.error = err?.message ?? 'Failed to load microfrontend';
          this.clearHost();
          return of(null);
        })
      )
      .toPromise();
  }

  private mount(definition: MfeDefinition): void {
    const container = this.hostRef.nativeElement;
    container.innerHTML = '';

    const element = document.createElement(definition.customElement);
    container.appendChild(element);
  }

  private clearHost(): void {
    if (this.hostRef) {
      this.hostRef.nativeElement.innerHTML = '';
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
