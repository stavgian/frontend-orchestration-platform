export type MfeType = "module-federation" | "script";

export interface MfeDefinition {
  id: string;
  displayName: string;
  /**
   * Used to build navigation and routing.
   * Example: "angular-mfe" becomes /mfe/angular-mfe
   */
  route: string;
  type: MfeType;
  /**
   * Custom element that the remote registers.
   */
  customElement: string;
  /**
   * For module federation remotes.
   */
  remoteEntry?: string;
  remoteName?: string;
  exposedModule?: string;
  /**
   * Additional scripts to load before waiting for the custom element.
   */
  scripts?: string[];
}

export interface Manifest {
  version: string;
  mfes: MfeDefinition[];
}

export const EVENT_NAMES = {
  statusMessage: "statusMessage",
} as const;

export interface StatusMessagePayload {
  text: string;
  source?: string;
  emittedAt?: string;
}

export type EventPayloadMap = {
  [EVENT_NAMES.statusMessage]: StatusMessagePayload;
};
