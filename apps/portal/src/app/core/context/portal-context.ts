/** The active business context. The shell owns it; apps only receive it. Nothing here is domain-specific. */
export interface PortalContext {
  contextType: string;
  contextId: string;
  routeId: string;
  /** Changes with every navigation, so a monitor can tell which messages belong to which activation. */
  correlationId?: string;
}

// The shell's own messages on the channel. Apps declare the same names themselves.
declare module '@stavgian/mfe-communication' {
  interface MessageMap {
    /** Broadcast whenever the active context changes. */
    'context:changed': PortalContext;
  }
  interface RequestMap {
    /** Apps that load late ask for the current context; `null` when none is active. */
    'context:get': { request: void; response: PortalContext | null };
  }
}
