export function mountWelcomeCard(onAskSophie: () => void): void {
  if (typeof document === "undefined") return;

  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "1001",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(4px)",
    transition: "opacity 0.2s",
  } as Partial<CSSStyleDeclaration>);

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "rgba(20,20,30,0.97)",
    color: "#fff",
    borderRadius: "16px",
    padding: "36px 32px",
    maxWidth: "400px",
    width: "90vw",
    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
    font: "14px system-ui, sans-serif",
    textAlign: "center",
    border: "1px solid rgba(145,119,199,0.3)",
  });

  const emoji = document.createElement("div");
  emoji.textContent = "🏛️";
  emoji.style.fontSize = "48px";
  emoji.style.marginBottom = "12px";

  const title = document.createElement("div");
  title.textContent = "Welcome to Louvre XR";
  Object.assign(title.style, {
    fontSize: "22px",
    fontWeight: "700",
    color: "#bfa9ff",
    marginBottom: "12px",
  });

  const desc = document.createElement("p");
  desc.textContent =
    "Sophie is your AI museum guide. Ask her anything about the exhibits — in text or voice. Join a room to explore with friends, or load your own 3D scene.";
  Object.assign(desc.style, {
    color: "#bbb",
    lineHeight: "1.65",
    margin: "0 0 28px",
    fontSize: "14px",
  });

  const hints = document.createElement("div");
  Object.assign(hints.style, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "24px",
    textAlign: "left",
  });
  const hintItems = [
    "🏛️  Sophie — ask about any exhibit",
    "💬  Chat — text with others in the room",
    "👥  Room — invite friends to explore together",
    "📁  Load — upload your own 3D Gaussian Splat",
    "🥽  Enter VR — go immersive on Meta Quest",
  ];
  for (const text of hintItems) {
    const row = document.createElement("div");
    row.textContent = text;
    Object.assign(row.style, { fontSize: "13px", color: "#aaa" });
    hints.appendChild(row);
  }

  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    flexWrap: "wrap",
  });

  const sophieBtn = makeBtn("🏛️ Ask Sophie", "#9177c7", "#fff");
  sophieBtn.addEventListener("click", () => {
    dismiss();
    onAskSophie();
  });

  const exploreBtn = makeBtn("Explore first →", "transparent", "#888");
  exploreBtn.style.border = "1px solid #444";
  exploreBtn.addEventListener("click", dismiss);

  btnRow.appendChild(sophieBtn);
  btnRow.appendChild(exploreBtn);

  card.appendChild(emoji);
  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(hints);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function dismiss() {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 200);
  }
}

function makeBtn(text: string, bg: string, color: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = text;
  Object.assign(btn.style, {
    padding: "10px 22px",
    background: bg,
    color,
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  });
  return btn;
}
