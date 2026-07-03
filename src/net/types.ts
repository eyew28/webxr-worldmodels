/** Text chat RPC payload (netblocks `chat-message` topic). */
export interface ChatMessagePayload {
  from: string;
  fromId: string;
  text: string;
  ts: number;
}

/** Display name announced on join. */
export interface DisplayNamePayload {
  name: string;
}

/** WebRTC signaling over the room RPC bus (netblocks `voice` messages). */
export type VoiceSignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

/** Head pose broadcast (~15–20 Hz), netblocks-style presence. */
export interface PresencePosePayload {
  px: number;
  py: number;
  pz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  ts: number;
}

/** A completed Sophie Q&A, broadcast so every visitor's chat panel sees it. */
export interface SophieQaPayload {
  from: string;
  question: string;
  answer: string;
  audioUrl?: string;
  ts: number;
}

export const CHAT_TOPIC = "chat-message";
export const DISPLAY_NAME_TOPIC = "display-name";
export const VOICE_SIGNAL_TOPIC = "voice-signal";
export const PRESENCE_TOPIC = "presence-pose";
export const SOPHIE_QA_TOPIC = "sophie-qa";
