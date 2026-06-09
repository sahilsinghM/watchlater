// WatchLater UI kit — screens + flow state machine.
const { useState, useEffect, useRef } = React;

const PROC_STEPS = [
  { label: "Fetching video details", quip: "Saying hi to YouTube." },
  { label: "Reading the transcript", quip: "Watching the boring parts so you don't have to." },
  { label: "Finding the key moments", quip: "Finding where the creator finally gets to the point." },
  { label: "Capturing important visuals", quip: "Grabbing the bits worth seeing." },
  { label: "Building your interactive lesson", quip: "Stacking cards. Tuning the deck." },
  { label: "Preparing your quiz", quip: "Making sure it's earned, not gifted." },
];

/* ---------------- Landing ---------------- */
function Landing({ go }) {
  const [url, setUrl] = useState("");
  const features = [
    { title: "Visual timeline", body: "See the video as colour-coded segments: skip, watch, core, demo." },
    { title: "Lesson cards", body: "Six tappable cards: concepts, analogies, the best quotes, and a recap." },
    { title: "Quick quiz", body: "Three questions to prove you actually got it — with a mastery score." },
  ];
  return (
    <div className="vs-app">
      <header className="vs-wrap vs-max-6xl vs-header">
        <Brand />
        <nav style={{ display: "flex", gap: 24, fontSize: 14, fontWeight: 500, color: "var(--fg2)" }}>
          <a href="#what" style={{ color: "inherit", textDecoration: "none" }}>What you get</a>
          <a href="#how" style={{ color: "inherit", textDecoration: "none" }}>How it works</a>
        </nav>
      </header>

      <main className="vs-wrap vs-max-4xl" style={{ paddingTop: 64, paddingBottom: 80, textAlign: "center" }}>
        <div className="vs-pill" style={{ background: "color-mix(in oklab, var(--primary) 10%, transparent)", color: "var(--primary)", borderColor: "transparent", fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 11 }}>
          <span style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--primary)" }} /> Built for busy learners
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(40px,7vw,72px)", letterSpacing: "-0.02em", lineHeight: 1.05, margin: "28px 0 0", textWrap: "balance" }}>
          Understand any long video <span style={{ color: "var(--primary)", fontStyle: "italic" }}>in 5 minutes.</span>
        </h1>
        <p style={{ maxWidth: 560, margin: "24px auto 0", fontSize: 18, color: "var(--fg2)" }}>
          Paste a YouTube link. We'll watch the boring parts so you don't have to — and hand you back a playful, interactive lesson with cards, a timeline, and a quick quiz.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); go("processing"); }} style={{ maxWidth: 640, margin: "36px auto 0" }}>
          <div className="vs-input-shell">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
            <Button type="submit" size="md" style={{ borderRadius: 16 }}>Generate lesson →</Button>
          </div>
          <Eyebrow style={{ marginTop: 12, letterSpacing: "0.15em" }}>Demo · just hit generate to see a sample lesson</Eyebrow>
        </form>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 28 }}>
          <div className="animate-float" style={{ position: "relative" }}>
            <img src="../../assets/mascot.png" alt="WatchLater mascot" width={128} height={128} style={{ filter: "drop-shadow(6px 6px 0 rgba(0,0,0,.12))" }} />
            <div style={{ position: "absolute", bottom: -4, right: -12, transform: "rotate(6deg)", background: "var(--card)", border: "3px solid var(--foreground)", boxShadow: "var(--shadow-brutal-sm)", fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 8 }}>I'm ready!</div>
          </div>
        </div>
      </main>

      <section id="what" className="vs-wrap vs-max-5xl" style={{ paddingBottom: 80 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, textAlign: "center", margin: "0 0 28px" }}>What you get from every video</h2>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr 1fr 1fr" }}>
          {features.map((f) => (
            <div key={f.title} className="vs-card sm-shadow" style={{ borderRadius: 28, padding: 20 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "var(--fg2)", margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="vs-wrap vs-max-3xl" style={{ paddingBottom: 90 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, textAlign: "center", margin: "0 0 28px" }}>How it works</h2>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {["Paste any public YouTube URL", "We pull the transcript and find the parts that actually matter", "You get a 5-minute interactive lesson + a 3-question quiz"].map((s, i) => (
            <li key={i} className="vs-card" style={{ borderRadius: 18, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--primary)", width: 28 }}>{i + 1}</span>
              <span style={{ fontWeight: 500 }}>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer style={{ borderTop: "2px solid var(--line-soft)", padding: "32px 0", textAlign: "center" }}>
        <Eyebrow style={{ letterSpacing: "0.2em" }}>WatchLater · A learning playground</Eyebrow>
      </footer>
    </div>
  );
}

/* ---------------- Processing ---------------- */
function Processing({ go }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= PROC_STEPS.length) { const t = setTimeout(() => go("lesson"), 450); return () => clearTimeout(t); }
    const t = setTimeout(() => setStep((s) => s + 1), 620);
    return () => clearTimeout(t);
  }, [step]);
  const pct = Math.min(100, (step / PROC_STEPS.length) * 100);
  return (
    <div className="vs-app" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "48px 24px" }}>
      <div style={{ width: "100%", maxWidth: 512, display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <img src="../../assets/mascot.png" alt="" width={96} height={96} className="animate-float" />
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, textAlign: "center", margin: 0 }}>Building your lesson…</h1>
          <Eyebrow style={{ letterSpacing: "0.15em" }}>This usually takes a moment</Eyebrow>
        </div>
        <div style={{ height: 16 }}><ProgressBar pct={pct} /></div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {PROC_STEPS.map((s, i) => {
            const done = i < step, active = i === step;
            return (
              <li key={s.label} style={{ display: "flex", gap: 12, alignItems: "flex-start", border: active ? "2px solid var(--foreground)" : "2px solid var(--line-soft)", borderRadius: 16, padding: "12px 16px", background: "var(--card)", boxShadow: active ? "var(--shadow-brutal-sm)" : "none", opacity: done ? 0.7 : active ? 1 : 0.5, transition: "all .2s" }}>
                <span style={{ marginTop: 1, width: 24, height: 24, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 9999, fontSize: 12, fontWeight: 700, background: done ? "var(--accent)" : active ? "var(--primary)" : "var(--muted)", color: done || active ? "#fff" : "var(--fg2)" }}>{done ? "✓" : i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{s.label}</div>
                  {active && <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--fg2)", marginTop: 2 }}>{s.quip}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Lesson hero ---------------- */
function LessonHero({ go, lesson, tone, setTone }) {
  return (
    <div className="vs-app">
      <header className="vs-wrap vs-max-6xl vs-header" style={{ paddingBottom: 8 }}>
        <Brand />
        <ToneToggle value={tone} onChange={setTone} />
      </header>
      <main className="vs-wrap vs-max-6xl" style={{ paddingBottom: 96, paddingTop: 24, display: "flex", flexDirection: "column", gap: 40 }}>
        <section style={{ display: "grid", gap: 32, gridTemplateColumns: "3fr 2fr", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <Eyebrow style={{ letterSpacing: "0.15em" }}>{lesson.video.channel} · {fmtTime(lesson.video.duration)}</Eyebrow>
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 44, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "10px 0 0" }}>{lesson.video.title}</h1>
            </div>
            <div className="vs-card sm-shadow vs-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Eyebrow tone="primary">This video in 30 seconds</Eyebrow>
              <p style={{ fontSize: 18, lineHeight: 1.55, margin: 0 }}>{lesson.reallyAbout}</p>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", paddingTop: 4 }}>
                <div className="vs-dashed" style={{ padding: 16, borderColor: "color-mix(in oklab, var(--accent) 60%, transparent)", background: "color-mix(in oklab, var(--accent) 10%, transparent)" }}>
                  <Eyebrow tone="accent">Best part · {fmtRange(lesson.bestPart.start, lesson.bestPart.end)}</Eyebrow>
                  <p style={{ fontSize: 13, margin: "6px 0 0" }}>{lesson.bestPart.why}</p>
                </div>
                <div className="vs-dashed" style={{ padding: 16, borderColor: "color-mix(in oklab, var(--foreground) 30%, transparent)", background: "var(--muted)" }}>
                  <Eyebrow>Skip · {fmtRange(lesson.skipPart.start, lesson.skipPart.end)}</Eyebrow>
                  <p style={{ fontSize: 13, margin: "6px 0 0" }}>{lesson.skipPart.why}</p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button size="lg" onClick={() => go("player")}>Start 5-minute lesson →</Button>
              <Button variant="outline" size="md">▶ Watch the best part</Button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <VideoFrame label="The Quiet Lab · 47:00" />
            <div className="vs-card sm-shadow" style={{ borderRadius: 28, padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
              <WatchScoreDial score={lesson.watchScore} />
              <div style={{ minWidth: 0 }}>
                <Eyebrow>Watch Score</Eyebrow>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, lineHeight: 1.15, margin: "2px 0" }}>{lesson.difficulty} · Worth your time</div>
                <p style={{ fontSize: 12, color: "var(--fg2)", margin: 0 }}>{lesson.scoreReason}</p>
              </div>
            </div>
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, margin: 0 }}>Attention map</h2>
            <p style={{ fontSize: 14, color: "var(--fg2)", margin: "4px 0 0" }}>Click a segment to jump the video. Skip the muted parts, savour the bright ones.</p>
          </div>
          <AttentionTimeline segments={lesson.segments} totalDuration={lesson.video.duration} onSeek={() => {}} />
        </section>

        <section className="vs-card sm-shadow vs-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <Eyebrow tone="primary">Recommendation</Eyebrow>
            <span className="vs-chip concept" style={{ borderRadius: 8 }}>Watch the core section</span>
          </div>
          <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{lesson.recommendation}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <Button variant="ink" size="sm" onClick={() => go("player")}>Start the lesson</Button>
            <Button variant="outline" size="sm" onClick={() => go("landing")}>← Try another video</Button>
          </div>
        </section>
      </main>
      <TutorPanel lesson={lesson} />
    </div>
  );
}

/* ---------------- Player ---------------- */
function Player({ go, lesson, tone, setTone }) {
  const [idx, setIdx] = useState(0);
  const card = lesson.cards[idx];
  const total = lesson.cards.length;
  const pct = Math.round(((idx + 1) / total) * 100);
  function next() { if (idx + 1 >= total) { go("quiz"); return; } setIdx((i) => i + 1); }
  function prev() { if (idx > 0) setIdx((i) => i - 1); }
  const reactions = [
    { emoji: "🤔", label: "Explain more" },
    { emoji: "✅", label: "Got it", primary: true },
    { emoji: "🥱", label: "Too basic" },
  ];
  return (
    <div className="vs-app">
      <header className="vs-wrap vs-max-5xl vs-header" style={{ paddingBottom: 4 }}>
        <Brand size="sm" />
        <ToneToggle value={tone} onChange={setTone} />
      </header>
      <main className="vs-wrap vs-max-2xl" style={{ paddingBottom: 96, paddingTop: 16, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 4px" }}>
            <Eyebrow style={{ letterSpacing: "0.15em" }}>Card {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</Eyebrow>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--primary)", fontSize: 14 }}>{pct}% complete</span>
          </div>
          <ProgressBar pct={pct} />
        </div>
        <LessonCardView card={card} tone={tone} onSeek={() => {}} />
        {card.timestamp !== undefined && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Eyebrow style={{ padding: "0 4px" }}>See it in the video · {fmtTime(card.timestamp)}</Eyebrow>
            <VideoFrame small label={`@ ${fmtTime(card.timestamp)}`} />
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {reactions.map((b) => (
            <button key={b.label} onClick={next} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, border: "3px solid var(--foreground)", borderRadius: 16, padding: 16, background: b.primary ? "var(--accent)" : "var(--card)", color: b.primary ? "#fff" : "inherit", boxShadow: b.primary ? "var(--shadow-brutal-sm)" : "none", transition: "transform .15s" }}
              onMouseEnter={(e) => { if (b.primary) e.currentTarget.style.transform = "translate(-1px,-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}>
              <span style={{ fontSize: 24 }}>{b.emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.01em" }}>{b.label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
          <button className="vs-quiet" onClick={prev} disabled={idx === 0}>← Previous</button>
          <button className="vs-quiet" onClick={() => go("lesson")}>Exit lesson</button>
          <button className="vs-quiet primary" onClick={next}>{idx + 1 === total ? "Quiz time →" : "Next →"}</button>
        </div>
      </main>
      <TutorPanel lesson={lesson} />
    </div>
  );
}

/* ---------------- Quiz ---------------- */
function Quiz({ go, lesson, setScore }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [picked, setPicked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const q = lesson.quiz[idx];
  const total = lesson.quiz.length;
  const correct = picked === q.correctIndex;
  function commit() {
    if (picked === null) return;
    if (!revealed) { setRevealed(true); return; }
    const nextAnswers = [...answers, picked];
    if (idx + 1 >= total) {
      const sc = nextAnswers.reduce((s, a, i) => s + (a === lesson.quiz[i].correctIndex ? 1 : 0), 0);
      setScore({ score: sc, total });
      go("done");
      return;
    }
    setAnswers(nextAnswers); setIdx((i) => i + 1); setPicked(null); setRevealed(false);
  }
  return (
    <div className="vs-app">
      <header className="vs-wrap vs-max-3xl vs-header" style={{ paddingBottom: 4 }}><Brand size="sm" /></header>
      <main className="vs-wrap vs-max-2xl" style={{ paddingBottom: 96, paddingTop: 16, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 4px" }}>
          <Eyebrow style={{ letterSpacing: "0.15em" }}>Question {idx + 1} / {total}</Eyebrow>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--primary)", fontSize: 14 }}>Quiz</span>
        </div>
        <ProgressBar pct={((idx + (revealed ? 1 : 0)) / total) * 100} amber />
        <div className="vs-card sm-shadow vs-pad-lg animate-card-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, lineHeight: 1.15, margin: 0 }}>{q.prompt}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {q.options.map((opt, i) => {
              const isPicked = picked === i, isCorrect = i === q.correctIndex;
              let st = { borderColor: "color-mix(in oklab, var(--foreground) 15%, transparent)", background: "var(--card)" };
              if (!revealed && isPicked) st = { borderColor: "var(--foreground)", background: "color-mix(in oklab, var(--primary) 10%, transparent)" };
              if (revealed && isCorrect) st = { borderColor: "var(--accent)", background: "color-mix(in oklab, var(--accent) 15%, transparent)" };
              else if (revealed && isPicked) st = { borderColor: "var(--destructive)", background: "color-mix(in oklab, var(--destructive) 10%, transparent)" };
              else if (revealed) st = { borderColor: "color-mix(in oklab, var(--foreground) 10%, transparent)", background: "var(--card)", opacity: 0.6 };
              return (
                <li key={i}>
                  <button onClick={() => !revealed && setPicked(i)} disabled={revealed} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", borderRadius: 16, border: "2px solid", padding: "15px 20px", textAlign: "left", fontWeight: 500, fontFamily: "var(--font-body)", fontSize: 15, ...st }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, width: 18, color: "var(--fg2)" }}>{String.fromCharCode(65 + i)}</span>
                    <span style={{ flex: 1 }}>{opt}</span>
                    {revealed && isCorrect && <span>✓</span>}
                    {revealed && isPicked && !isCorrect && <span>✗</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {revealed && (
            <div className="vs-dashed" style={{ padding: 16, borderColor: correct ? "var(--accent)" : "var(--destructive)", background: correct ? "color-mix(in oklab, var(--accent) 10%, transparent)" : "color-mix(in oklab, var(--destructive) 5%, transparent)" }}>
              <Eyebrow style={{ color: "var(--fg1)" }}>{correct ? "Nice." : "Not quite."}</Eyebrow>
              <p style={{ fontSize: 14, margin: "6px 0 0" }}>{q.explanation}</p>
            </div>
          )}
          <Button size="md" onClick={commit} disabled={picked === null} style={{ width: "100%" }}>
            {!revealed ? "Check answer →" : idx + 1 === total ? "Finish quiz →" : "Next question →"}
          </Button>
        </div>
      </main>
    </div>
  );
}

/* ---------------- Done ---------------- */
function Done({ go, lesson, result }) {
  const pct = Math.round((result.score / result.total) * 100);
  const label = pct >= 80 ? "Mastered" : pct >= 50 ? "Solid grasp" : "Worth a re-read";
  const [fb, setFb] = useState("idle");
  return (
    <div className="vs-app">
      <header className="vs-wrap vs-max-3xl vs-header" style={{ paddingBottom: 4 }}><Brand size="sm" /></header>
      <main className="vs-wrap vs-max-2xl" style={{ paddingBottom: 96, paddingTop: 16, textAlign: "center", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
          <img src="../../assets/mascot.png" alt="" width={128} height={128} className="animate-pop-in" />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 46, lineHeight: 1.1, margin: 0 }}>Lesson complete.</h1>
        <p style={{ color: "var(--fg2)", margin: 0 }}>You moved through a {Math.floor(lesson.video.duration / 60)}-minute video in five.</p>
        <div className="vs-card shadow vs-pad-lg" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Eyebrow>Mastery</Eyebrow>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 64, color: "var(--primary)", lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{label}</div>
          <p style={{ fontSize: 14, color: "var(--fg2)", margin: 0 }}>You got {result.score} of {result.total} correct.</p>
        </div>
        <div className="vs-card sm-shadow vs-pad" style={{ textAlign: "left" }}>
          <Eyebrow tone="primary">If you want more</Eyebrow>
          <p style={{ fontSize: 16, margin: "8px 0 0" }}>Watch <b>{fmtRange(lesson.bestPart.start, lesson.bestPart.end)}</b> in the video. That's the section where the argument really lands.</p>
        </div>
        <div className="vs-card sm-shadow vs-pad" style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 16 }}>
          <Eyebrow tone="primary">Was this useful?</Eyebrow>
          <textarea placeholder="Optional note" style={{ minHeight: 72, width: "100%", resize: "none", borderRadius: 16, border: "2px solid var(--line-soft)", background: "var(--background)", padding: "12px 14px", fontSize: 14, fontFamily: "var(--font-body)", outline: "none" }} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="primary" size="sm" style={{ background: "var(--accent)", boxShadow: "var(--shadow-brutal-sm)" }} onClick={() => setFb("saved")} disabled={fb === "saved"}>Useful</Button>
            <Button variant="outline" size="sm" onClick={() => setFb("saved")} disabled={fb === "saved"}>Not useful</Button>
            {fb === "saved" && <Eyebrow tone="accent">Saved</Eyebrow>}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", paddingTop: 4 }}>
          <Button variant="outline" size="sm" onClick={() => go("lesson")}>← Back to lesson hero</Button>
          <Button variant="primary" size="sm" onClick={() => go("landing")}>Process another video →</Button>
        </div>
      </main>
    </div>
  );
}

/* ---------------- Root flow ---------------- */
function App() {
  const [screen, setScreen] = useState("landing");
  const [tone, setTone] = useState("clear");
  const [result, setResult] = useState({ score: 2, total: 3 });
  const lesson = SAMPLE_LESSON;
  const go = (s) => { setScreen(s); window.scrollTo({ top: 0 }); };
  return (
    <>
      {screen === "landing" && <Landing go={go} />}
      {screen === "processing" && <Processing go={go} />}
      {screen === "lesson" && <LessonHero go={go} lesson={lesson} tone={tone} setTone={setTone} />}
      {screen === "player" && <Player go={go} lesson={lesson} tone={tone} setTone={setTone} />}
      {screen === "quiz" && <Quiz go={go} lesson={lesson} setScore={setResult} />}
      {screen === "done" && <Done go={go} lesson={lesson} result={result} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
