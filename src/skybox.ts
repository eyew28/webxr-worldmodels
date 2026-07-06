import * as THREE from "three";

export const SKYBOX_URL = "./splats/skybox.jpg";
export const CLEARED_SKY_COLOR = 0x14141e;

const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

let objectUrl: string | null = null;

export interface SkyboxSyncHandlers {
  onLoad?: (file: File) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
}

let syncHandlers: SkyboxSyncHandlers | null = null;

function disposeBackgroundTexture(scene: THREE.Scene): void {
  const bg = scene.background;
  if (bg instanceof THREE.Texture) {
    bg.dispose();
  }
}

function revokeObjectUrl(): void {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function applyTexture(scene: THREE.Scene, texture: THREE.Texture): void {
  disposeBackgroundTexture(scene);
  revokeObjectUrl();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
}

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

/** Set an equirectangular 360° image as the scene background from a URL path. */
export async function applyEquirectSkybox(
  scene: THREE.Scene,
  url: string = SKYBOX_URL,
): Promise<void> {
  try {
    const texture = await loadTexture(url);
    applyTexture(scene, texture);
  } catch (err) {
    console.error("[Skybox] Failed to load 360:", err);
    clearSkybox(scene);
    throw err;
  }
}

/** Apply a local 360° image file as the scene background. */
export async function applyEquirectSkyboxFromFile(
  scene: THREE.Scene,
  file: File,
): Promise<void> {
  const url = URL.createObjectURL(file);
  try {
    const texture = await loadTexture(url);
    applyTexture(scene, texture);
    objectUrl = url;
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Apply 360° background from raw image bytes (network peers). */
export async function applyEquirectSkyboxFromBytes(
  scene: THREE.Scene,
  bytes: Uint8Array,
  mimeType = "image/jpeg",
): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  try {
    const texture = await loadTexture(url);
    applyTexture(scene, texture);
    objectUrl = url;
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Remove the 360° background and use a solid color. */
export function clearSkybox(scene: THREE.Scene): void {
  disposeBackgroundTexture(scene);
  revokeObjectUrl();
  scene.background = new THREE.Color(CLEARED_SKY_COLOR);
}

export function setSkyboxSyncHandlers(handlers: SkyboxSyncHandlers | null): void {
  syncHandlers = handlers;
}

export async function pickAndApplySkybox(scene: THREE.Scene): Promise<void> {
  const file = await pickImageFile();
  if (!file) return;

  await applyEquirectSkyboxFromFile(scene, file);
  await syncHandlers?.onLoad?.(file);
}

export async function clearAndSyncSkybox(scene: THREE.Scene): Promise<void> {
  clearSkybox(scene);
  await syncHandlers?.onClear?.();
}

function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = IMAGE_ACCEPT;
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

let load360Button: HTMLButtonElement | null = null;
let clear360Button: HTMLButtonElement | null = null;

const LOAD_360_LABEL = "Load 360";
const LOADING_360_LABEL = "Loading 360…";
const CLEAR_360_LABEL = "Clear 360";

export function registerLoad360Button(button: HTMLButtonElement): void {
  load360Button = button;
}

export function registerClear360Button(button: HTMLButtonElement): void {
  clear360Button = button;
}

export function setLoad360ButtonLoading(loading: boolean): void {
  if (!load360Button) return;
  load360Button.textContent = loading ? LOADING_360_LABEL : LOAD_360_LABEL;
  load360Button.disabled = loading;
}

export function setClear360ButtonLoading(loading: boolean): void {
  if (!clear360Button) return;
  clear360Button.disabled = loading;
}
