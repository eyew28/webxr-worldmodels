import { SOPHIE_BACKEND as BACKEND } from "./sophieBackend.js";

// The welcome greeting must play at most once per session — guard against
// overlapping playback from multiple triggers. Set synchronously on entry so
// concurrent calls can't both pass; reset only if playback never starts.
let welcomeStarted = false;

export async function playSophieWelcome(exhibit?: string): Promise<void> {
  if (welcomeStarted) return;
  welcomeStarted = true;

  try {
    const body: Record<string, unknown> = { voice: true };
    if (exhibit) body.exhibit = exhibit;

    const resp = await fetch(`${BACKEND}/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      welcomeStarted = false;
      return;
    }

    const { audio_url } = await resp.json() as { audio_url?: string };
    if (!audio_url) {
      welcomeStarted = false;
      return;
    }

    // Browsers block autoplay until the user interacts with the page — if that
    // happens, allow a later (gesture-driven) call to retry.
    await new Audio(audio_url).play().catch(() => {
      welcomeStarted = false;
    });
  } catch {
    // fail silently — audio is best-effort
    welcomeStarted = false;
  }
}
