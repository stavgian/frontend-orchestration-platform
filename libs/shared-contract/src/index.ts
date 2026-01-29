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
  customerSelected: "customerSelected",
  ticketCreated: "ticketCreated",
} as const;

export interface CustomerSelectedPayload {
  customerId: string;
  name: string;
  source?: string;
  emittedAt?: string;
}

export interface TicketCreatedPayload {
  ticketId: string;
  customerId: string;
  source?: string;
  emittedAt?: string;
}

export type EventPayloadMap = {
  [EVENT_NAMES.customerSelected]: CustomerSelectedPayload;
  [EVENT_NAMES.ticketCreated]: TicketCreatedPayload;
};
