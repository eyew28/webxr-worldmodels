
import * as THREE from "three";
import {
  EnvironmentType,
  LocomotionEnvironment,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SessionMode,
  VisibilityState,
  World,
} from "@iwsdk/core";
import { DesktopControlsSystem } from "./desktopControls.js";
import { GaussianSplatLoader, GaussianSplatLoaderSystem } from "./gaussianSplatLoader.js";
import { mountLogo } from "./loadSplatHud.js";
import { MultiplayerSystem } from "./multiplayerSystem.js";
import { mountToolbar } from "./toolbar.js";
import { mountWelcomeCard } from "./welcomeCard.js";
import { applyEquirectSkybox } from "./skybox.js";

// ── Persistent UI (before world init) ───────────────────────────────────────
mountLogo();
const toolbarInstance = mountToolbar();
mountWelcomeCard(() => toolbarInstance.openSophie());

// ── World (IWSDK settings) ───────────────────────────────────────────────────
World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets: {},
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    // Avoid auto-offer; Enter XR uses enterXR() with runtime fallbacks.
    offer: "none",
    // layers / hand-tracking break some desktop + Virtual Desktop runtimes.
    features: { handTracking: false, layers: false },
  },
  render: {
    defaultLighting: false,
  },
  features: {
    locomotion: true,
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
  },
})
  .then((world) => {
    world.camera.position.set(0, 1.5, 0);
    applyEquirectSkybox(world.scene);
    world.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    world
      .registerSystem(GaussianSplatLoaderSystem)
      .registerSystem(DesktopControlsSystem)
      .registerSystem(MultiplayerSystem);

    // Wire toolbar Load panel and VR button now that world is ready
    toolbarInstance.initWorld(world);

    // ── Gaussian Splat ───────────────────────────────────────────────────────
    const splatEntity = world.createTransformEntity();
    splatEntity.addComponent(GaussianSplatLoader);

    const splatSystem = world.getSystem(GaussianSplatLoaderSystem)!;
    splatSystem.setHostEntity(splatEntity);

    // Play splat animation when entering XR
    world.visibilityState.subscribe((state) => {
      if (state !== VisibilityState.NonImmersive) {
        splatSystem.replayAnimation(splatEntity).catch((err) => {
          console.error("[World] Failed to replay splat animation:", err);
        });
      }
    });

    // ── Invisible floor for locomotion ───────────────────────────────────────
    const floorGeometry = new PlaneGeometry(100, 100);
    floorGeometry.rotateX(-Math.PI / 2);
    const floor = new Mesh(floorGeometry, new MeshBasicMaterial());
    floor.visible = false;
    const floorEntity = world.createTransformEntity(floor);
    requestAnimationFrame(() => {
      floorEntity.addComponent(LocomotionEnvironment, {
        type: EnvironmentType.STATIC,
      });
    });
  })
  .catch((err) => {
    console.error("[World] Failed to create the IWSDK world:", err);
  });
