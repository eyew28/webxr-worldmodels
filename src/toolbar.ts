import type { World } from "@iwsdk/core";
import { VisibilityState } from "@iwsdk/core";
import { buildSophiePanel } from "./museXrHud.js";
import { buildLoadPanel } from "./loadSplatHud.js";
import { buildChatPanel, type ChatHudHandle } from "./net/chatHud.js";
import { buildRoomPanel, getRoomCodeFromUrl } from "./net/roomCode.js";
import { playSophieWelcome } from "./sophieAudio.js";
import { enterXR } from "./xrSession.js";
import type { RoomSession } from "./net/roomSession.js";

export interface ToolbarHandle {
  /** Call after World.create resolves — wires up Load panel and VR button. */
  initWorld(world: World): void;
  /** Call when multiplayer session connects — fills in the Chat panel. */
  addChat(session: RoomSession): ChatHudHandle;
  /** Programmatically open the Sophie panel (e.g. from welcome card). */
  openSophie(): void;
}

type PanelName = "sophie" | "chat" | "room" | "load";

/** Live-binding reference accessible from other modules (e.g. MultiplayerSystem). */
export let toolbar: ToolbarHandle | null = null;

export function mountToolbar(): ToolbarHandle {
  const panelContainers = new Map<PanelName, HTMLElement>();
  const btnEls = new Map<PanelName, HTMLButtonElement>();
  let activePanel: PanelName | null = null;

  // ── Panel container factory ──────────────────────────────────────────────
  function makePanelContainer(widthOverride?: string): HTMLElement {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      bottom: "72px",
      left: "50%",
      transform: "translateX(-50%)",
      width: widthOverride ?? "min(380px, 95vw)",
      background: "rgba(20,20,30,0.95)",
      borderRadius: "12px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
      backdropFilter: "blur(12px)",
      zIndex: "998",
      display: "none",
      border: "1px solid rgba(145,119,199,0.25)",
      overflow: "hidden",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
    return el;
  }

  // ── Sophie panel (built immediately) ────────────────────────────────────
  const sophieContainer = makePanelContainer("min(440px, 95vw)");
  sophieContainer.appendChild(buildSophiePanel());
  panelContainers.set("sophie", sophieContainer);

  // ── Room panel (built immediately) ──────────────────────────────────────
  const roomContainer = makePanelContainer();
  roomContainer.appendChild(buildRoomPanel(getRoomCodeFromUrl()));
  panelContainers.set("room", roomContainer);

  // ── Chat placeholder (filled when session connects) ─────────────────────
  const chatContainer = makePanelContainer();
  chatContainer.appendChild(makePlaceholder("Connecting to room…"));
  panelContainers.set("chat", chatContainer);

  // ── Load placeholder (filled after world init) ──────────────────────────
  const loadContainer = makePanelContainer();
  loadContainer.appendChild(makePlaceholder("Initialising…"));
  panelContainers.set("load", loadContainer);

  // ── Toolbar bar ──────────────────────────────────────────────────────────
  const bar = document.createElement("div");
  Object.assign(bar.style, {
    position: "fixed",
    bottom: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "rgba(20,20,30,0.95)",
    borderRadius: "40px",
    padding: "8px 10px",
    backdropFilter: "blur(12px)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
    zIndex: "999",
    border: "1px solid rgba(145,119,199,0.25)",
  } as Partial<CSSStyleDeclaration>);

  // Panel toggle buttons
  const panelDefs: { name: PanelName; label: string }[] = [
    { name: "sophie", label: "🏛️ Sophie" },
    { name: "chat",   label: "💬 Chat"   },
    { name: "room",   label: "👥 Room"   },
    { name: "load",   label: "📁 Load"   },
  ];

  for (const { name, label } of panelDefs) {
    const btn = makeToolbarBtn(label);
    btn.addEventListener("click", () => togglePanel(name));
    bar.appendChild(btn);
    btnEls.set(name, btn);
  }

  // Thin divider before VR button
  const divider = document.createElement("div");
  Object.assign(divider.style, {
    width: "1px",
    height: "22px",
    background: "rgba(255,255,255,0.15)",
    margin: "0 6px",
  });
  bar.appendChild(divider);

  // VR button (not a panel toggle — executes directly)
  const vrBtn = makeToolbarBtn("🥽 Enter VR", "#fbbf24", "#0d0221");
  bar.appendChild(vrBtn);

  document.body.appendChild(bar);

  // ── Panel toggle logic ───────────────────────────────────────────────────
  function togglePanel(name: PanelName) {
    if (activePanel === name) {
      panelContainers.get(name)!.style.display = "none";
      setActive(name, false);
      activePanel = null;
      return;
    }
    // Hide all
    for (const [pName, el] of panelContainers) {
      el.style.display = "none";
      setActive(pName, false);
    }
    // Show target
    panelContainers.get(name)!.style.display = "block";
    setActive(name, true);
    activePanel = name;
  }

  function setActive(name: PanelName, active: boolean) {
    const btn = btnEls.get(name);
    if (btn) btn.style.background = active ? "#9177c7" : "rgba(255,255,255,0.08)";
  }

  // ── Public handle ────────────────────────────────────────────────────────
  const handle: ToolbarHandle = {
    initWorld(world: World) {
      // Replace load placeholder with real panel
      loadContainer.innerHTML = "";
      loadContainer.appendChild(buildLoadPanel(world));

      // Wire VR button
      vrBtn.addEventListener("click", () => {
        if (world.visibilityState.value === VisibilityState.NonImmersive) {
          enterXR(world).catch((err) =>
            console.error("[Toolbar] Failed to enter XR:", err),
          );
        } else {
          world.exitXR();
        }
      });

      world.visibilityState.subscribe((state) => {
        const inVR = state !== VisibilityState.NonImmersive;
        vrBtn.textContent = inVR ? "🔙 Exit VR" : "🥽 Enter VR";
        vrBtn.style.color = inVR ? "#fff" : "#0d0221";
        vrBtn.style.background = inVR ? "#cc3333" : "#fbbf24";
        // Hide toolbar panels when entering VR (DOM not visible in headset)
        if (inVR && activePanel) {
          panelContainers.get(activePanel)!.style.display = "none";
          setActive(activePanel, false);
          activePanel = null;
        }
      });
    },

    addChat(session: RoomSession): ChatHudHandle {
      const { element, handle: chatHandle } = buildChatPanel(session);
      chatContainer.innerHTML = "";
      chatContainer.appendChild(element);
      return chatHandle;
    },

    openSophie() {
      togglePanel("sophie");
      playSophieWelcome();
    },
  };

  toolbar = handle;

  // Play Sophie welcome audio on initial load
  playSophieWelcome();

  return handle;
}

function makeToolbarBtn(
  text: string,
  bg = "rgba(255,255,255,0.08)",
  color = "#fff",
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = text;
  Object.assign(btn.style, {
    padding: "8px 14px",
    background: bg,
    color,
    border: "none",
    borderRadius: "24px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.15s",
  } as Partial<CSSStyleDeclaration>);
  return btn;
}

function makePlaceholder(text: string): HTMLElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    padding: "20px",
    color: "#888",
    fontSize: "13px",
    textAlign: "center",
  });
  el.textContent = text;
  return el;
}
