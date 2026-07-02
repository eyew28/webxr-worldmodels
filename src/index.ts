
import * as THREE from "three";
import {
  EnvironmentType,
  LocomotionEnvironment,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SessionMode,
  TeleportSystem,
  VisibilityState,
  World,
} from "@iwsdk/core";
import { setSplatWorld } from "./currentSplat.js";
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
    setSplatWorld(world);
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

    // The Locomotor initializes asynchronously (it may spin up a worker), and
    // its TeleportSystem is only registered once that finishes. Adding the
    // LocomotionEnvironment before then makes the engine throw "Locomotor not
    // initialized". Wait for the locomotor to be ready, then register the floor.
    let floorAttempts = 0;
    const addFloorEnvironment = () => {
      if (world.getSystem(TeleportSystem) || floorAttempts++ > 180) {
        floorEntity.addComponent(LocomotionEnvironment, {
          type: EnvironmentType.STATIC,
        });
        return;
      }
      requestAnimationFrame(addFloorEnvironment);
    };
    addFloorEnvironment();
  })
  .catch((err) => {
    console.error("[World] Failed to create the IWSDK world:", err);
  });
