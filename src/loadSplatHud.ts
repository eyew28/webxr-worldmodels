import type { World } from "@iwsdk/core";
import { GaussianSplatLoaderSystem } from "./gaussianSplatLoader.js";
import { identifyCurrentSplat } from "./splatRecognize.js";
import {
  registerLoadSplatButton,
  setLoadSplatButtonLoading,
} from "./splatLoadUi.js";
import {
  registerLoad360Button,
  registerClear360Button,
  pickAndApplySkybox,
  clearAndSyncSkybox,
  setLoad360ButtonLoading,
  setClear360ButtonLoading,
} from "./skybox.js";

const SPLAT_FILE_ACCEPT = ".spz,.ply,.ksplat,.rad";

/** Small logo fixed to top-left. */
export function mountLogo(): void {
  if (typeof document === "undefined") return;
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed",
    top: "12px",
    left: "12px",
    zIndex: "999",
    pointerEvents: "none",
  });
  const img = document.createElement("img");
  img.src = "./logo.png";
  img.alt = "Logo";
  Object.assign(img.style, {
    width: "140px",
    height: "auto",
    display: "block",
    opacity: "0.9",
  });
  wrap.appendChild(img);
  document.body.appendChild(wrap);
}

/** Returns the Load Splat panel content element (positioning handled by toolbar). */
export function buildLoadPanel(world: World): HTMLElement {
  const panel = document.createElement("div");
  Object.assign(panel.style, {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    font: "13px system-ui, sans-serif",
    color: "#fff",
  });

  const header = document.createElement("div");
  header.textContent = "📁 Load 3D Scene";
  Object.assign(header.style, { fontWeight: "600", color: "#bfa9ff" });
  panel.appendChild(header);

  const hint = document.createElement("div");
  hint.textContent =
    "Upload a Gaussian Splat file from your device. Supported formats: .spz, .ply, .ksplat, .rad";
  Object.assign(hint.style, {
    fontSize: "12px",
    color: "#888",
    lineHeight: "1.55",
  });
  panel.appendChild(hint);

  const loadBtn = makePanelButton("Choose file…", "#9177c7");
  loadBtn.id = "load-splat-button";
  registerLoadSplatButton(loadBtn);

  loadBtn.addEventListener("click", () => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = SPLAT_FILE_ACCEPT;
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const splatSystem = world.getSystem(GaussianSplatLoaderSystem);
      if (!splatSystem) {
        console.error("[LoadPanel] GaussianSplatLoaderSystem not found.");
        return;
      }
      setLoadSplatButtonLoading(true);
      try {
        await splatSystem.unloadHostSplat();
        await splatSystem.loadFromFile(file);
      } catch (err) {
        console.error("[LoadPanel] Failed to load splat:", err);
      } finally {
        setLoadSplatButtonLoading(false);
      }
    });
    input.click();
  });

  panel.appendChild(loadBtn);

  const row360 = document.createElement("div");
  Object.assign(row360.style, {
    display: "flex",
    gap: "8px",
  });

  const load360Btn = makePanelButton("Load 360", "#7ac0ff");
  load360Btn.style.color = "#0d0221";
  load360Btn.style.flex = "1";
  load360Btn.id = "load-360-button";
  registerLoad360Button(load360Btn);

  load360Btn.addEventListener("click", () => {
    void (async () => {
      setLoad360ButtonLoading(true);
      try {
        await pickAndApplySkybox(world.scene);
      } catch (err) {
        console.error("[LoadPanel] Failed to load 360:", err);
      } finally {
        setLoad360ButtonLoading(false);
      }
    })();
  });

  const clear360Btn = makePanelButton("Clear 360", "#4a5568");
  clear360Btn.style.flex = "1";
  clear360Btn.id = "clear-360-button";
  registerClear360Button(clear360Btn);

  clear360Btn.addEventListener("click", () => {
    void (async () => {
      setClear360ButtonLoading(true);
      try {
        await clearAndSyncSkybox(world.scene);
      } catch (err) {
        console.error("[LoadPanel] Failed to clear 360:", err);
      } finally {
        setClear360ButtonLoading(false);
      }
    })();
  });

  row360.appendChild(load360Btn);
  row360.appendChild(clear360Btn);
  panel.appendChild(row360);

  // ── Ask Sophie to describe the currently loaded sculpture ──────────────────
  const identifyBtn = makePanelButton("🔍 Identify this scene", "#3d2d7a");
  identifyBtn.addEventListener("click", () => {
    void identifyCurrentSplat();
  });
  panel.appendChild(identifyBtn);

  return panel;
}

function makePanelButton(text: string, bg: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = text;
  Object.assign(btn.style, {
    padding: "9px 14px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    width: "100%",
  });
  return btn;
}
