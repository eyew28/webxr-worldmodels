import { currentExhibit } from "./currentSplat.js";
import { getRoomContext } from "./net/roomContext.js";
import { broadcastSophieQa, setSophieQaHandler } from "./net/sophieRoomSync.js";
import { SOPHIE_BACKEND as BACKEND } from "./sophieBackend.js";

interface HistoryEntry {
  role: string;
  content: string;
}

interface AskResponse {
  answer?: string;
  audio_url?: string;
  exhibit?: string;
  mode?: string;
}

/** Lets other features (e.g. splat recognition) post into the Sophie chat. */
export interface SophieChatHandle {
  addUserMessage(text: string): void;
  addSophieMessage(text: string, audioUrl?: string): void;
  setBusy(busy: boolean): void;
}

/** Live-binding reference to the mounted Sophie chat panel. */
export let sophieChat: SophieChatHandle | null = null;

/**
 * Builds the Sophie AI chat panel using the /ask endpoint.
 * No iframe — fully native UI that matches the app's visual style.
 */
export function buildSophieChatPanel(): HTMLElement {
  const history: HistoryEntry[] = [];
  let recorder: MediaRecorder | null = null;
  let currentAudio: HTMLAudioElement | null = null;

  /** Stops Sophie's current speech, if any — lets the visitor barge in. */
  function interruptSpeech(): void {
    if (!currentAudio) return;
    currentAudio.pause();
    currentAudio = null;
  }

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    height: "min(480px, calc(100vh - 140px))",
    font: "13px system-ui, sans-serif",
    color: "#fff",
  });

  // ── Header ──────────────────────────────────────────────────────────────
  const header = document.createElement("div");
  header.textContent = "🏛️ Sophie · Museum Guide";
  Object.assign(header.style, {
    padding: "12px 14px 10px",
    fontWeight: "600",
    color: "#bfa9ff",
    flexShrink: "0",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  });
  panel.appendChild(header);

  // ── Chat log ─────────────────────────────────────────────────────────────
  const log = document.createElement("div");
  Object.assign(log.style, {
    flex: "1 1 auto",
    overflowY: "auto",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minHeight: "0",
  });
  panel.appendChild(log);

  // ── Input row ─────────────────────────────────────────────────────────────
  const inputRow = document.createElement("form");
  Object.assign(inputRow.style, {
    display: "flex",
    gap: "6px",
    padding: "10px 12px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    flexShrink: "0",
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Ask Sophie anything…";
  input.maxLength = 500;
  Object.assign(input.style, {
    flex: "1 1 auto",
    padding: "8px 14px",
    borderRadius: "20px",
    border: "1px solid #444",
    background: "#13141c",
    color: "#fff",
    font: "inherit",
    outline: "none",
    minWidth: "0",
  });

  const micBtn = document.createElement("button");
  micBtn.type = "button";
  micBtn.textContent = "🎤";
  micBtn.title = "Hold a question by voice";
  Object.assign(micBtn.style, {
    padding: "8px 12px",
    borderRadius: "20px",
    border: "none",
    background: "rgba(255,255,255,0.09)",
    color: "#fff",
    cursor: "pointer",
    font: "inherit",
    flexShrink: "0",
    transition: "background 0.15s",
  } as Partial<CSSStyleDeclaration>);

  const askBtn = document.createElement("button");
  askBtn.type = "submit";
  askBtn.textContent = "Ask";
  Object.assign(askBtn.style, {
    padding: "8px 18px",
    borderRadius: "20px",
    border: "none",
    background: "#9177c7",
    color: "#fff",
    cursor: "pointer",
    font: "inherit",
    fontWeight: "600",
    flexShrink: "0",
    transition: "opacity 0.15s",
  } as Partial<CSSStyleDeclaration>);

  inputRow.appendChild(input);
  inputRow.appendChild(micBtn);
  inputRow.appendChild(askBtn);
  panel.appendChild(inputRow);

  // ── Initial Sophie greeting ───────────────────────────────────────────────
  appendMessage(
    "sophie",
    "Welcome! I'm Sophie, your Louvre guide. Ask me anything about the exhibits — sculptures, paintings, history, or directions.",
  );

  // ── Ask handler ───────────────────────────────────────────────────────────
  async function askSophie(question: string) {
    setLoading(true);
    appendMessage("user", question);

    try {
      const { askerName, participants } = getRoomContext();
      const resp = await fetch(`${BACKEND}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          voice: true,
          history: history.slice(-10),
          asker_name: askerName,
          participants,
          // Tell Sophie which sculpture is on screen (omitted if unknown).
          exhibit: currentExhibit()?.name,
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as AskResponse;

      const answer = data.answer ?? "Sorry, I couldn't find an answer.";
      appendMessage("sophie", answer, data.audio_url);

      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: answer });

      broadcastSophieQa({
        from: askerName,
        question,
        answer,
        audioUrl: data.audio_url,
        ts: Date.now(),
      });
    } catch (err) {
      appendMessage(
        "sophie",
        "Sorry, I'm having trouble connecting. Please try again.",
      );
      console.error("[Sophie] /ask failed:", err);
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  inputRow.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    void askSophie(question);
  });

  // ── Voice input (MediaRecorder → /transcribe → ask) ─────────────────────────
  micBtn.addEventListener("click", () => void toggleRecording());

  async function toggleRecording() {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }

    // Starting a new recording — treat it as a barge-in and cut Sophie off.
    interruptSpeech();

    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
        throw new Error("unsupported");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      appendMessage(
        "sophie",
        "I couldn't access your microphone. Please check browser permissions.",
      );
      console.error("[Sophie] mic access failed:", err);
      return;
    }

    const mimeType = pickAudioMimeType();
    recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    const chunks: BlobPart[] = [];
    recorder.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    });

    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecordingUI(false);
      const type = recorder?.mimeType || mimeType || "audio/webm";
      recorder = null;
      const blob = new Blob(chunks, { type });
      if (blob.size > 0) void transcribeAndAsk(blob);
    });

    recorder.start();
    setRecordingUI(true);
  }

  async function transcribeAndAsk(blob: Blob) {
    setLoading(true);
    micBtn.disabled = true;
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const form = new FormData();
      form.append("file", blob, `recording.${ext}`);

      const resp = await fetch(`${BACKEND}/transcribe`, {
        method: "POST",
        body: form,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { text } = (await resp.json()) as { text?: string };

      const question = text?.trim();
      if (!question) {
        appendMessage(
          "sophie",
          "I didn't catch that — could you try speaking again?",
        );
        return;
      }
      await askSophie(question);
    } catch (err) {
      appendMessage(
        "sophie",
        "Sorry, I couldn't transcribe that. Please try again.",
      );
      console.error("[Sophie] /transcribe failed:", err);
    } finally {
      micBtn.disabled = false;
      setLoading(false);
    }
  }

  function setRecordingUI(recording: boolean) {
    micBtn.textContent = recording ? "⏹" : "🎤";
    micBtn.title = recording ? "Stop recording" : "Ask a question by voice";
    micBtn.style.background = recording ? "#cc3333" : "rgba(255,255,255,0.09)";
    input.placeholder = recording
      ? "Listening… tap ⏹ to send"
      : "Ask Sophie anything…";
  }

  function setLoading(loading: boolean) {
    input.disabled = loading;
    askBtn.disabled = loading;
    askBtn.textContent = loading ? "…" : "Ask";
    askBtn.style.opacity = loading ? "0.6" : "1";
  }

  function appendMessage(
    role: "user" | "sophie",
    text: string,
    audioUrl?: string,
    displayName?: string,
  ) {
    const isUser = role === "user";

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      gap: "3px",
    });

    const nameLabel = document.createElement("div");
    nameLabel.textContent = isUser ? (displayName ?? "You") : "Sophie";
    Object.assign(nameLabel.style, {
      fontSize: "11px",
      color: isUser ? "#9177c7" : "#bfa9ff",
      fontWeight: "600",
      padding: isUser ? "0 4px 0 0" : "0 0 0 4px",
    });

    const bubble = document.createElement("div");
    bubble.textContent = text;
    Object.assign(bubble.style, {
      padding: "8px 12px",
      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
      background: isUser ? "#3d2d7a" : "rgba(255,255,255,0.09)",
      color: "#fff",
      maxWidth: "88%",
      lineHeight: "1.55",
      fontSize: "13px",
      wordBreak: "break-word",
    });

    row.appendChild(nameLabel);
    row.appendChild(bubble);

    if (audioUrl) {
      interruptSpeech();

      const audio = new Audio(audioUrl);
      currentAudio = audio;
      audio.play().catch(() => {});

      const audioTag = document.createElement("div");
      audioTag.textContent = "🔊 Playing… (tap 🎤 to interrupt)";
      Object.assign(audioTag.style, {
        fontSize: "11px",
        color: "#7be3a4",
        padding: "0 4px",
      });
      audio.addEventListener("ended", () => {
        audioTag.textContent = "🔊 Played";
        audioTag.style.color = "#555";
        if (currentAudio === audio) currentAudio = null;
      });
      row.appendChild(audioTag);
    }

    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  sophieChat = {
    addUserMessage: (text) => appendMessage("user", text),
    addSophieMessage: (text, audioUrl) => appendMessage("sophie", text, audioUrl),
    setBusy: setLoading,
  };

  // Render other visitors' Sophie Q&A as it's broadcast into the room.
  setSophieQaHandler((payload) => {
    appendMessage("user", payload.question, undefined, payload.from);
    appendMessage("sophie", payload.answer, payload.audioUrl);
  });

  return panel;
}

/** Picks a MediaRecorder mime type Whisper accepts, preferring webm (Opus). */
function pickAudioMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  const supported = (window as { MediaRecorder?: typeof MediaRecorder })
    .MediaRecorder?.isTypeSupported;
  if (!supported) return undefined;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}
