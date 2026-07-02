import type { World } from "@iwsdk/core";
import { exhibitForSplatKey, type Exhibit } from "./exhibits.js";
import { GaussianSplatLoaderSystem } from "./gaussianSplatLoader.js";

/**
 * Bridges the loaded splat to features that don't hold a `world` reference
 * (e.g. the Sophie chat panel, built before World.create). The loader already
 * tracks the current splat via getSyncedState(); we just read it on demand.
 */

let world: World | null = null;

export function setSplatWorld(w: World): void {
  world = w;
}

/** URL (for preset splats) or filename (for uploads) of the current splat. */
export function currentSplatKey(): string | null {
  const state = world?.getSystem(GaussianSplatLoaderSystem)?.getSyncedState();
  if (!state) return null;
  return state.kind === "url" ? state.splatUrl : state.fileName;
}

/** The exhibit currently on screen, or null if it isn't one Sophie knows. */
export function currentExhibit(): Exhibit | null {
  return exhibitForSplatKey(currentSplatKey());
}
