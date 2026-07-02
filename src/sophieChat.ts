const BACKEND = "https://louvre-xr-backend-production.up.railway.app";

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

/**
 * Builds the Sophie AI chat panel using the /ask endpoint.
 * No iframe — fully native UI that matches the app's visual style.
 */
export function buildSophieChatPanel(): HTMLElement {
  const history: HistoryEntry[] = [];

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
  inputRow.appendChild(askBtn);
  panel.appendChild(inputRow);

  // ── Initial Sophie greeting ───────────────────────────────────────────────
  appendMessage(
    "sophie",
    "Welcome! I'm Sophie, your Louvre guide. Ask me anything about the exhibits — sculptures, paintings, history, or directions.",
  );

  // ── Submit handler ────────────────────────────────────────────────────────
  inputRow.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    input.value = "";
    setLoading(true);
    appendMessage("user", question);

    try {
      const resp = await fetch(`${BACKEND}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          voice: true,
          history: history.slice(-10),
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as AskResponse;

      const answer = data.answer ?? "Sorry, I couldn't find an answer.";
      appendMessage("sophie", answer, data.audio_url);

      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: answer });
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
  });

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
    nameLabel.textContent = isUser ? "You" : "Sophie";
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
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {});

      const audioTag = document.createElement("div");
      audioTag.textContent = "🔊 Playing…";
      Object.assign(audioTag.style, {
        fontSize: "11px",
        color: "#7be3a4",
        padding: "0 4px",
      });
      audio.addEventListener("ended", () => {
        audioTag.textContent = "🔊 Played";
        audioTag.style.color = "#555";
      });
      row.appendChild(audioTag);
    }

    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  return panel;
}
