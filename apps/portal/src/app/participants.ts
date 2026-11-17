import { MfeDefinition } from './manifest';

export const PORTAL_ID = 'portal';

/** Human-friendly description of anyone who can send messages on the channel. */
export interface Participant {
  id: string;
  name: string;
  tech: string;
  initials: string;
  color: string;
}

const KNOWN: Record<string, Omit<Participant, 'id'>> = {
  [PORTAL_ID]: { name: 'Shell portal', tech: 'The host', initials: 'P', color: '#006ca0' },
  'angular-mfe': { name: 'Product catalog', tech: 'Angular', initials: 'A', color: '#c2255c' },
  'react-mfe': { name: 'Shopping cart', tech: 'React', initials: 'R', color: '#6741d9' },
  'js-mfe': { name: 'Checkout', tech: 'Plain JavaScript', initials: 'JS', color: '#c2410c' },
  'vue-mfe': { name: 'Shipping', tech: 'Vue', initials: 'V', color: '#1e7a3c' },
};

export function participantFor(id: string | undefined, displayName?: string): Participant {
  const key = id ?? 'unknown';
  const known = KNOWN[key];
  if (known) return { id: key, ...known };

  const name = displayName ?? id ?? 'Unknown sender';
  return {
    id: key,
    name,
    tech: 'Independent app',
    initials: name.slice(0, 2).toUpperCase(),
    color: '#5a6578',
  };
}

export function participantForMfe(mfe: MfeDefinition): Participant {
  return participantFor(mfe.id, mfe.displayName);
}
