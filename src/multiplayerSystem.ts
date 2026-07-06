import { createSystem } from "@iwsdk/core";
import {
  GaussianSplatLoaderSystem,
  SplatLoadedInfo,
} from "./gaussianSplatLoader.js";
import { base64ToBytes, bytesToBase64 } from "./net/bytes.js";
import {
  getRoomCodeFromUrl,
  resolveRoomId,
} from "./net/roomCode.js";
import {
  createTransportForRoom,
  RoomSession,
  SplatSyncState,
} from "./net/roomSession.js";
import { type ChatHudHandle } from "./net/chatHud.js";
import { bindSophieRoomSync } from "./net/sophieRoomSync.js";
import type { SkyboxSyncState } from "./net/types.js";
import { PeerPresence } from "./peerPresence.js";
import { setLoadSplatButtonLoading } from "./splatLoadUi.js";
import {
  applyEquirectSkybox,
  applyEquirectSkyboxFromBytes,
  clearSkybox,
  setSkyboxSyncHandlers,
  SKYBOX_URL,
} from "./skybox.js";
import { toolbar } from "./toolbar.js";

/**
 * Shared-room networking inspired by google/xrblocks netblocks.
 * @see https://github.com/google/xrblocks/tree/main/samples/netblocks
 */
export class MultiplayerSystem extends createSystem({}) {
  private session: RoomSession | null = null;
  private presence: PeerPresence | null = null;
  private voiceOn = false;
  private lastFrameTime = performance.now();

  get isConnected(): boolean {
    return this.session?.transport.isOpen ?? false;
  }

  get peerCount(): number {
    return this.session?.peerCount ?? 1;
  }

  async init() {
    const splatSystem = this.world.getSystem(GaussianSplatLoaderSystem);
    splatSystem?.setOnSplatLoaded((info, options) =>
      this.handleLocalSplatLoaded(info, options.sync),
    );

    const roomCode = getRoomCodeFromUrl();
    const roomId = resolveRoomId(roomCode);
    const transport = createTransportForRoom(!!roomCode);

    try {
      this.session = await RoomSession.connect(transport, roomId);
      console.log(
        `[Multiplayer] Joined room "${roomId}" via ${transport.name}` +
          (roomCode ? ` (code ${roomCode})` : " (local tabs)"),
      );

      this.session.onSplatLoadBegin(() => this.prepareRemoteSplat());
      this.session.onSplatLoadEnd(() => setLoadSplatButtonLoading(false));
      this.session.onSplatLoad((state) => this.applyRemoteSplat(state));
      this.session.onSkyboxLoad((state) => this.applyRemoteSkybox(state));
      bindSophieRoomSync(this.session);

      this.session.rememberSkyboxState({ kind: "url", skyboxUrl: SKYBOX_URL });
      setSkyboxSyncHandlers({
        onLoad: async (file) => {
          await this.broadcastLocalSkybox(file);
        },
        onClear: async () => {
          this.session?.broadcastSkyboxClear();
        },
      });

      this.session.onPeerCountChange((count) => {
        const hud = document.getElementById("room-hud-peer-count");
        if (hud) hud.textContent = `Peers: ${count}`;
      });

      const chatHandle = toolbar?.addChat(this.session);
      if (chatHandle) {
        chatHandle.voiceButton.addEventListener("click", () => {
          void this.toggleVoice(chatHandle);
        });
      }

      this.presence = new PeerPresence(this.world, this.session);
      this.session.announcePeerReady();
    } catch (err) {
      console.error("[Multiplayer] Failed to join room:", err);
    }
  }

  update() {
    if (!this.presence) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    this.presence.update(dt);
  }

  private async handleLocalSplatLoaded(
    info: SplatLoadedInfo,
    sync: boolean,
  ): Promise<void> {
    if (!this.session) return;

    if (info.kind === "url") {
      const state: SplatSyncState = {
        kind: "url",
        splatUrl: info.splatUrl,
        label: info.label,
      };
      this.session.rememberState(state);
      if (sync) this.session.broadcastUrlSplat(info.splatUrl, info.label);
      return;
    }

    const state: SplatSyncState = {
      kind: "file",
      fileName: info.fileName,
      fileType: info.fileType,
      base64: bytesToBase64(new Uint8Array(info.fileBytes)),
    };
    this.session.rememberState(state);
    if (sync) {
      await this.session.broadcastFileSplat(
        info.fileName,
        info.fileType,
        info.fileBytes,
      );
    }
  }

  private async prepareRemoteSplat(): Promise<void> {
    setLoadSplatButtonLoading(true);
    const splatSystem = this.world.getSystem(GaussianSplatLoaderSystem);
    if (!splatSystem) return;
    await splatSystem.unloadHostSplat();
  }

  private async toggleVoice(chat: ChatHudHandle): Promise<void> {
    const session = this.session;
    if (!session) return;

    if (this.voiceOn) {
      session.voice.disable();
      this.voiceOn = false;
      chat.voiceButton.textContent = "🎙 Enable voice";
      chat.voiceButton.style.background = "#9177c7";
      chat.appendSystemLine("Voice chat off");
      return;
    }

    try {
      await session.voice.enable(session.remotePeerIds);
      this.voiceOn = true;
      chat.voiceButton.textContent = "🔴 Disable voice";
      chat.voiceButton.style.background = "#cc3333";
      chat.appendSystemLine("Voice chat on");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      chat.appendSystemLine(`Voice error: ${msg}`);
      console.error("[Multiplayer] Voice enable failed:", err);
    }
  }

  private async broadcastLocalSkybox(file: File): Promise<void> {
    if (!this.session) return;
    const bytes = await file.arrayBuffer();
    await this.session.broadcastSkyboxFile(file.name, bytes, file.type || undefined);
  }

  private async applyRemoteSkybox(state: SkyboxSyncState): Promise<void> {
    try {
      if (state.kind === "url") {
        await applyEquirectSkybox(this.world.scene, state.skyboxUrl);
      } else if (state.kind === "cleared") {
        clearSkybox(this.world.scene);
      } else {
        const bytes = base64ToBytes(state.base64);
        await applyEquirectSkyboxFromBytes(
          this.world.scene,
          bytes,
          state.mimeType ?? guessImageMime(state.fileName),
        );
      }
    } catch (err) {
      console.error("[Multiplayer] Failed to apply remote 360:", err);
    }
  }

  private async applyRemoteSplat(state: SplatSyncState): Promise<void> {
    const splatSystem = this.world.getSystem(GaussianSplatLoaderSystem);
    if (!splatSystem) return;

    try {
      if (state.kind === "url") {
        await splatSystem.loadFromNetwork({
          kind: "url",
          splatUrl: state.splatUrl,
          label: state.label,
        });
      } else {
        const bytes = base64ToBytes(state.base64);
        await splatSystem.loadFromNetwork({
          kind: "file",
          fileName: state.fileName,
          fileType: state.fileType,
          fileBytes: bytes.slice().buffer,
        });
      }
    } catch (err) {
      console.error("[Multiplayer] Failed to apply remote splat:", err);
    }
  }
}

function guessImageMime(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}
