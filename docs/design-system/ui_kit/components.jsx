// VideoSense UI kit — reusable components. Recreates the product's custom chrome.
const { useState } = React;

const MASCOT = "../../assets/mascot.png";

function Brand({ size = "md" }) {
  const dim = size === "sm" ? 32 : 40;
  return (
    <a className="vs-brand" href="#" onClick={(e) => e.preventDefault()}>
      <img src={MASCOT} alt="" width={dim} height={dim} />
      <span className="word">VideoSense</span>
    </a>
  );
}

function Eyebrow({ tone, children, style }) {
  return <div className={"vs-eyebrow " + (tone || "")} style={style}>{children}</div>;
}

function Button({ variant = "primary", size = "md", children, ...rest }) {
  return <button className={`vs-btn ${variant} ${size}`} {...rest}>{children}</button>;
}

function ProgressBar({ pct, amber }) {
  return (
    <div className="vs-track">
      <div className={"fill" + (amber ? " amber" : "")} style={{ width: `${pct}%` }} />
    </div>
  );
}

const TONES = [
  { id: "clear", label: "Clear", emoji: "💡" },
  { id: "friendly", label: "Friendly", emoji: "🤝" },
  { id: "funny", label: "Funny", emoji: "😄" },
  { id: "strict", label: "Strict", emoji: "🧐" },
];
function ToneToggle({ value, onChange }) {
  return (
    <div className="vs-toggle">
      {TONES.map((t) => (
        <button key={t.id} className={"vs-seg" + (t.id === value ? " active" : "")} onClick={() => onChange(t.id)}>
          <span style={{ marginRight: 4 }}>{t.emoji}</span>{t.label}
        </button>
      ))}
    </div>
  );
}
const TONE_LEAD = {
  clear: () => null,
  friendly: (k) => (k === "concept" ? "Okay — here's the gist: " : null),
  funny: (k) => (k === "concept" ? "Brace yourself, hot take incoming: " : k === "recap" ? "Tattoo this on your forearm: " : null),
  strict: (k) => (k === "concept" ? "Pay attention. " : k === "recap" ? "Do not forget: " : null),
};

function WatchScoreDial({ score }) {
  const pct = Math.max(0, Math.min(10, score)) / 10;
  const r = 44, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
      <svg width="110" height="110" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="60" cy="60" r={r} stroke="color-mix(in oklab, var(--foreground) 10%, transparent)" strokeWidth="10" fill="none" />
        <circle cx="60" cy="60" r={r} stroke="var(--primary)" strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 900ms var(--ease-spring)" }} />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, lineHeight: 1 }}>{score.toFixed(1)}</div>
        <Eyebrow style={{ marginTop: 2 }}>/ 10</Eyebrow>
      </div>
    </div>
  );
}

const SEG_STYLE = {
  skip: { bg: "var(--muted)", dot: "var(--muted-foreground)", label: "Skip" },
  watch: { bg: "color-mix(in oklab, var(--primary) 30%, transparent)", dot: "var(--primary)", label: "Watch" },
  core: { bg: "var(--secondary)", dot: "var(--secondary)", label: "Core" },
  demo: { bg: "var(--accent)", dot: "var(--accent)", label: "Demo" },
};
function AttentionTimeline({ segments, totalDuration, onSeek }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", height: 24, width: "100%", overflow: "hidden", borderRadius: 9999, border: "3px solid var(--foreground)", background: "var(--card)" }}>
        {segments.map((seg, i) => {
          const w = ((seg.end - seg.start) / totalDuration) * 100;
          const s = SEG_STYLE[seg.kind];
          return <button key={i} title={`${s.label} · ${fmtRange(seg.start, seg.end)}`} onClick={() => onSeek && onSeek(seg.start)}
            style={{ width: `${w}%`, height: "100%", background: s.bg, border: 0, borderRight: i < segments.length - 1 ? "3px solid var(--foreground)" : 0, cursor: "pointer" }} />;
        })}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        {segments.map((seg, i) => {
          const s = SEG_STYLE[seg.kind];
          return (
            <li key={i}>
              <button onClick={() => onSeek && onSeek(seg.start)} className="vs-soft"
                style={{ display: "flex", gap: 12, width: "100%", textAlign: "left", padding: 12, cursor: "pointer", background: "var(--card)", alignItems: "flex-start", transition: "transform .15s, border-color .15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--foreground)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line-soft)"; e.currentTarget.style.transform = "none"; }}>
                <span style={{ marginTop: 4, width: 12, height: 12, borderRadius: 9999, background: s.dot, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14 }}>{seg.title}</span>
                    <Eyebrow style={{ letterSpacing: "0.1em" }}>{fmtRange(seg.start, seg.end)}</Eyebrow>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--fg2)" }}>{seg.blurb}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const KIND_LABEL = { concept: "Key Concept", analogy: "Analogy", quote: "The Quote", insight: "Insight", recap: "Remember This" };
function LessonCardView({ card, tone, onSeek }) {
  const lead = TONE_LEAD[tone] ? TONE_LEAD[tone](card.kind) : null;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, transform: "translate(12px,12px) rotate(2deg)", borderRadius: 32, background: "var(--secondary)", border: "3px solid var(--foreground)" }} />
      <div style={{ position: "absolute", inset: 0, transform: "translate(6px,6px) rotate(-1deg)", borderRadius: 32, background: "var(--accent)", border: "3px solid var(--foreground)" }} />
      <div key={card.id} className="animate-card-in" style={{ position: "relative", borderRadius: 32, background: "var(--card)", border: "3px solid var(--foreground)", padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span className={"vs-chip " + card.kind}>{KIND_LABEL[card.kind]}</span>
          {card.timestamp !== undefined && (
            <button onClick={() => onSeek && onSeek(card.timestamp)} className="vs-quiet">@ {fmtTime(card.timestamp)} ↗</button>
          )}
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em", margin: "0 0 16px" }}>{card.title}</h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: "color-mix(in oklab, var(--foreground) 80%, transparent)", margin: 0 }}>
          {lead && <span style={{ fontWeight: 600, color: "var(--fg1)" }}>{lead}</span>}{card.body}
        </p>
        {card.analogy && (
          <div className="vs-dashed" style={{ padding: 18, marginTop: 20 }}>
            <Eyebrow>The analogy</Eyebrow>
            <p style={{ margin: "6px 0 0", fontStyle: "italic", fontWeight: 500, color: "color-mix(in oklab, var(--foreground) 85%, transparent)" }}>{card.analogy}</p>
          </div>
        )}
        {card.quote && (
          <blockquote style={{ borderLeft: "4px solid var(--primary)", paddingLeft: 20, margin: "20px 0 0" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, fontStyle: "italic", lineHeight: 1.3, margin: 0 }}>“{card.quote}”</p>
            {card.quoteAuthor && <footer style={{ marginTop: 8 }}><Eyebrow>— {card.quoteAuthor}</Eyebrow></footer>}
          </blockquote>
        )}
      </div>
    </div>
  );
}

// Faux video frame — stand-in for the YouTube embed in this mock.
function VideoFrame({ label, small }) {
  return (
    <div className="vs-aspect">
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "linear-gradient(160deg,#1b2230,#0c0f16)" }}>
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <div style={{ width: small ? 48 : 64, height: small ? 48 : 64, borderRadius: 9999, background: "var(--primary)", border: "3px solid #fff", display: "grid", placeItems: "center" }}>
            <i data-lucide="play" style={{ color: "#fff", fontSize: small ? 20 : 26, marginLeft: 3 }}></i>
          </div>
          {label && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>{label}</span>}
        </div>
      </div>
    </div>
  );
}

function TutorPanel({ lesson }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "tutor", text: "Hey! Ask me anything about this video. I only know what's in the transcript." }]);
  const [input, setInput] = useState("");
  function ask(q) {
    if (!q.trim()) return;
    const seed = lesson.tutorSeed.find((s) => q.toLowerCase().split(/\W+/).some((w) => w.length > 3 && (s.q.toLowerCase().includes(w) || s.a.toLowerCase().includes(w))));
    const answer = seed ? seed.a : "I cannot tell from this video.";
    setMessages((m) => [...m, { role: "user", text: q }, { role: "tutor", text: answer }]);
    setInput("");
  }
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ position: "fixed", bottom: 24, right: 24, zIndex: 40, display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 18, background: "var(--foreground)", color: "var(--background)", border: "3px solid var(--foreground)", padding: "12px 20px", boxShadow: "var(--shadow-brutal-sm)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
        <span>💬</span> Ask the tutor
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 24, background: "color-mix(in oklab, var(--foreground) 40%, transparent)", backdropFilter: "blur(4px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", borderRadius: 28, border: "3px solid var(--foreground)", background: "var(--card)", boxShadow: "var(--shadow-brutal)", maxHeight: "80vh" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid var(--line-soft)", padding: "16px 20px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>Tutor for this video</div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: 0, color: "var(--fg2)", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((m, i) => (
                <div key={i} style={m.role === "user"
                  ? { marginLeft: "auto", maxWidth: "85%", borderRadius: 16, background: "var(--primary)", color: "var(--primary-foreground)", padding: "10px 14px", fontSize: 14 }
                  : { maxWidth: "85%", borderRadius: 16, background: "var(--background)", border: "2px solid var(--line-soft)", padding: "10px 14px", fontSize: 14 }}>{m.text}</div>
              ))}
            </div>
            <div style={{ borderTop: "2px solid var(--line-soft)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {lesson.tutorSeed.slice(0, 2).map((s, i) => <button key={i} className="vs-pill" onClick={() => ask(s.q)}>{s.q}</button>)}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 16, border: "2px solid var(--line-soft)", background: "var(--background)", padding: 6 }}>
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" style={{ flex: 1, border: 0, outline: 0, background: "transparent", padding: "8px 12px", fontSize: 14, fontFamily: "var(--font-body)" }} />
                <button type="submit" className="vs-btn primary sm" style={{ borderRadius: 12 }}>Ask</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, { Brand, Eyebrow, Button, ProgressBar, ToneToggle, WatchScoreDial, AttentionTimeline, LessonCardView, VideoFrame, TutorPanel });
