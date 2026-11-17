export type MfeType = "module-federation" | "script";

export interface MfeDefinition {
  id: string;
  /** How the portal presents this app: its name, avatar initials and accent colour. */
  display: { name: string; initials: string; color: string };
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
