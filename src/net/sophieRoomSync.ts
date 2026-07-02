import type { RoomSession } from "./roomSession.js";
import { SOPHIE_QA_TOPIC, type SophieQaPayload } from "./types.js";

/**
 * Bridges the Sophie chat panel (built before the multiplayer session
 * exists) to the room's pub/sub bus, so one visitor's question and Sophie's
 * answer are broadcast to everyone else's chat panel — same "set the
 * reference later, read/write it on demand" bridge as [[currentSplat.ts]].
 */

let session: RoomSession | null = null;
let onRemoteQa: ((payload: SophieQaPayload) => void) | null = null;

/** Called once the multiplayer session connects. */
export function bindSophieRoomSync(s: RoomSession): void {
  session = s;
  s.on(SOPHIE_QA_TOPIC, (payload, fromPeerId) => {
    if (fromPeerId === s.localPeerId) return;
    onRemoteQa?.(payload as SophieQaPayload);
  });
}

/** Registers the handler that renders a remote visitor's Q&A locally. */
export function setSophieQaHandler(handler: (payload: SophieQaPayload) => void): void {
  onRemoteQa = handler;
}

/** Broadcasts a completed Q&A to the rest of the room, if connected. */
export function broadcastSophieQa(payload: SophieQaPayload): void {
  session?.emit(SOPHIE_QA_TOPIC, payload);
}
