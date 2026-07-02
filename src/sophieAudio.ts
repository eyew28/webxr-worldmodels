import { SOPHIE_BACKEND as BACKEND } from "./sophieBackend.js";

export async function playSophieWelcome(exhibit?: string): Promise<void> {
  try {
    const body: Record<string, unknown> = { voice: true };
    if (exhibit) body.exhibit = exhibit;

    const resp = await fetch(`${BACKEND}/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return;

    const { audio_url } = await resp.json() as { audio_url?: string };
    // Browsers block autoplay until the user interacts with the page — swallow
    // the resulting rejection so it doesn't surface as an unhandled error.
    if (audio_url) new Audio(audio_url).play().catch(() => {});
  } catch {
    // fail silently — audio is best-effort
  }
}
