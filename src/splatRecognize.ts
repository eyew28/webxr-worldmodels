import { currentExhibit } from "./currentSplat.js";
import { SOPHIE_BACKEND as BACKEND } from "./sophieBackend.js";
import { sophieChat } from "./sophieChat.js";
import { toolbar } from "./toolbar.js";

interface AskResponse {
  answer?: string;
  audio_url?: string;
  exhibit?: string;
  mode?: string;
}

/**
 * Tells the user what sculpture is currently loaded. The frontend already knows
 * which of the three curated Tuileries splats is on screen (via its URL/
 * filename → exhibit mapping), so we send that exhibit name to /ask directly
 * instead of guessing from a screenshot — deterministic and reliable.
 */
export async function identifyCurrentSplat(): Promise<void> {
  toolbar?.showSophie();
  sophieChat?.addUserMessage("🔍 What am I looking at?");

  const exhibit = currentExhibit();
  if (!exhibit) {
    sophieChat?.addSophieMessage(
      "I don't have information on this scene — it isn't one of the Tuileries sculptures I know (Air, La Nuit, or L'Hommage à Cézanne).",
    );
    return;
  }

  sophieChat?.setBusy(true);
  try {
    const resp = await fetch(`${BACKEND}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "What is this sculpture I'm looking at? Tell me about it.",
        exhibit: exhibit.name,
        voice: true,
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as AskResponse;
    sophieChat?.addSophieMessage(
      data.answer ?? `You're looking at ${exhibit.name}.`,
      data.audio_url,
    );
  } catch (err) {
    sophieChat?.addSophieMessage(
      `You're looking at ${exhibit.name}, but I couldn't load more details right now. Please try again.`,
    );
    console.error("[SplatRecognize] identify failed:", err);
  } finally {
    sophieChat?.setBusy(false);
  }
}
