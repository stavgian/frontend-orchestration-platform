import { Injectable, signal } from '@angular/core';
import { Scenario } from './scenario';
import { scenarioUrl } from './scenario-url';

/** Loads the scenario configuration once. */
@Injectable({ providedIn: 'root' })
export class ScenarioService {
  readonly scenario = signal<Scenario | undefined>(undefined);
  readonly url = scenarioUrl;
  private pending?: Promise<Scenario>;

  load(): Promise<Scenario> {
    this.pending ??= fetch(scenarioUrl).then(async (res) => {
      if (!res.ok) throw new Error(`Unable to load scenario (${res.status})`);
      const scenario = (await res.json()) as Scenario;
      this.scenario.set(scenario);
      return scenario;
    });
    this.pending.catch(() => (this.pending = undefined));
    return this.pending;
  }
}
