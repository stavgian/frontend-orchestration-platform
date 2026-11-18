/**
 * The business scenario the shell is demonstrating. The shell treats every value as opaque data:
 * it never branches on a context type, a status or an app id.
 */
export interface Scenario {
  name: string;
  description: string;
  /** Plain-language description of the use case, one paragraph per entry. */
  useCase: string[];
  branding: {
    /** What one context is called in this scenario, e.g. "Case", "Claim", "Employee". */
    contextLabel: string;
    contextLabelPlural: string;
    /** Heading above the list of contexts on the landing page. */
    recordsTitle: string;
    /** Eyebrow on a context page, e.g. "Legal operations portal". */
    portalLabel: string;
    /** What the apps are called as a group, e.g. "department applications". */
    appsLabel: string;
  };
  contexts: ScenarioContext[];
  /** Which manifest apps take part, in display order, and what each one is responsible for. */
  apps: ScenarioApp[];
  /** Documentation of the events the apps exchange in this scenario; the shell never interprets them. */
  exampleEvents: ScenarioEvent[];
}

export interface ScenarioContext {
  contextType: string;
  /** Identifier, also used as the route: `/<id>`. */
  id: string;
  title: string;
  status: string;
  /** Visual tone of the status indicator. */
  tone: 'active' | 'pending' | 'neutral';
  summary: string;
  fields: { label: string; value: string; /** Name from the shell's icon set. */ icon?: string }[];
}

export interface ScenarioApp {
  /** Matches an `id` in the manifest. */
  id: string;
  department: string;
  responsibility: string;
  /** The context types this app can work with. */
  contextTypes: string[];
}

export interface ScenarioEvent {
  type: string;
  publisher: string;
  consumers: string[];
  description: string;
}
