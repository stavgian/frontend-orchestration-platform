import { MfeDefinition } from '../manifest/manifest';

/** The portal observes the channel as this participant. */
export const PORTAL_ID = 'portal';

/** Anyone who can send messages on the channel, as the portal shows them. */
export interface Participant {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export const PORTAL: Participant = { id: PORTAL_ID, name: 'Shell portal', initials: 'P', color: '#006ca0' };

/** Apps describe themselves in the manifest; the portal has no built-in knowledge of them. */
export function participantForMfe(mfe: MfeDefinition): Participant {
  return { id: mfe.id, ...mfe.display };
}

/** A sender the manifest doesn't list. */
export function unknownParticipant(id: string | undefined): Participant {
  const name = id ?? 'Unknown sender';
  return { id: id ?? 'unknown', name, initials: name.slice(0, 2).toUpperCase(), color: '#5a6578' };
}
