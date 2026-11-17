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
  [PORTAL_ID]: { name: 'Portal', tech: 'The host page', initials: 'P', color: '#b6f36b' },
  'angular-mfe': { name: 'Angular app', tech: 'Built with Angular', initials: 'A', color: '#ff6b8b' },
  'react-mfe': { name: 'React app', tech: 'Built with React', initials: 'R', color: '#61dafb' },
  'js-mfe': { name: 'JavaScript app', tech: 'Plain JavaScript', initials: 'JS', color: '#f5d742' },
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
    color: '#9aa7b8',
  };
}

export function participantForMfe(mfe: MfeDefinition): Participant {
  return participantFor(mfe.id, mfe.displayName);
}
