import { getOrCreateDisplayName } from "./displayName.js";

/**
 * Shared, session-independent snapshot of "who is in the room" so features
 * built before the multiplayer session connects (e.g. the Sophie panel) can
 * read the current asker + participant names lazily at request time.
 *
 * Populated by the chat HUD, which already owns display-name exchange.
 */

let localName: string | null = null;
const peerNames = new Map<string, string>(); // remote peerId -> display name

export function setLocalDisplayName(name: string): void {
  localName = name.trim() || null;
}

export function setPeerDisplayName(peerId: string, name: string): void {
  const trimmed = name.trim();
  if (trimmed) peerNames.set(peerId, trimmed);
}

export function forgetPeer(peerId: string): void {
  peerNames.delete(peerId);
}

export interface RoomContext {
  /** Name of the person asking (the local user). */
  askerName: string;
  /** Everyone currently in the room, including the asker. */
  participants: string[];
}

export function getRoomContext(): RoomContext {
  const askerName = localName ?? getOrCreateDisplayName();
  // De-dupe while keeping the asker first.
  const participants = [...new Set([askerName, ...peerNames.values()])];
  return { askerName, participants };
}
