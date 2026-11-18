export type MfeType = "module-federation" | "script";

export interface MfeDefinition {
  id: string;
  /** How the portal presents this app: its name, avatar initials, accent colour, an optional icon name from the shell's icon set and an optional logo (an image URL). */
  display: { name: string; initials: string; color: string; icon?: string; logo?: string };
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
