// WatchLater — sample lesson fixture (shape matches src/lib/lessonSchema.ts)
// Realistic content written in the WatchLater voice.

const SAMPLE_LESSON = {
  video: {
    id: "vid_0001",
    youtubeId: "sample",
    url: "https://www.youtube.com/watch?v=sample",
    title: "Why your brain craves distraction — and how to train focus",
    channel: "The Quiet Lab",
    duration: 2820, // 47:00
    thumbnail: "",
  },
  watchScore: 7.4,
  scoreReason:
    "Dense and well-structured, with a genuinely useful framework in the back half. The intro meanders, but the core argument pays off.",
  difficulty: "Intermediate",
  reallyAbout:
    "Distraction isn't a willpower problem — it's your brain seeking relief from discomfort. The fix is to manage the internal trigger, not the phone.",
  bestPart: { start: 1290, end: 1830, why: "The four-step model for handling an urge, with a live walkthrough." },
  skipPart: { start: 0, end: 240, why: "Four minutes of channel intro and a sponsor read. Nothing load-bearing." },
  recommendation:
    "Do the lesson, then watch 21:30–30:30 if you want the full framework. You can safely skip the rest.",
  watchVerdict: "watch_core",
  segments: [
    { start: 0, end: 240, kind: "skip", title: "Intro & sponsor", blurb: "Channel intro, a joke, and a 60-second sponsor read.", },
    { start: 240, end: 1290, kind: "watch", title: "Why we get distracted", blurb: "The case that distraction is an escape from internal discomfort.", },
    { start: 1290, end: 1830, kind: "core", title: "The four-step model", blurb: "Identify the trigger, write it down, explore the sensation, ride it out.", },
    { start: 1830, end: 2520, kind: "demo", title: "Live walkthrough", blurb: "Applying the model to email, Slack, and doom-scrolling.", },
    { start: 2520, end: 2820, kind: "skip", title: "Outro & plugs", blurb: "Recap, merch, and a call to subscribe.", },
  ],
  cards: [
    { id: "c1", kind: "concept", title: "Distraction is an escape, not a flaw.",
      body: "We reach for the phone to escape an uncomfortable internal state — boredom, anxiety, uncertainty — not because the phone is irresistible. Name the feeling and the pull weakens.",
      timestamp: 312 },
    { id: "c2", kind: "analogy", title: "Your attention is a campfire.",
      body: "Left alone it burns steady. Every notification is a gust of wind — one won't put it out, but a constant breeze keeps it flickering and never warm.",
      analogy: "Tending focus is less about building walls against the wind and more about choosing where you light the fire.",
      timestamp: 690 },
    { id: "c3", kind: "concept", title: "The four-step model.",
      body: "When an urge hits: (1) identify the trigger, (2) write down the time, (3) explore the sensation with curiosity, (4) wait ten minutes. Most urges dissolve before the timer ends.",
      timestamp: 1290 },
    { id: "c4", kind: "quote", title: "The line that reframes it.",
      body: "The speaker's framing is the whole talk in one sentence.",
      quote: "You can't call something a distraction unless you know what it's distracting you from.",
      quoteAuthor: "The Quiet Lab",
      timestamp: 1512 },
    { id: "c5", kind: "insight", title: "Schedule the slack, not just the work.",
      body: "Blocking time for focused work fails if you don't also block time for the things pulling at you. Plan the scroll, the snack, the inbox — then they stop ambushing you.",
      timestamp: 2010 },
    { id: "c6", kind: "recap", title: "Manage the trigger, not the tool.",
      body: "Deleting apps treats the symptom. The durable fix is noticing the discomfort that sends you looking for them, and meeting it on purpose.",
      timestamp: 2460 },
  ],
  keyMoments: [
    { timestamp: 312, caption: "Distraction defined as escape" },
    { timestamp: 1290, caption: "The four-step model introduced" },
    { timestamp: 1512, caption: "The reframing quote" },
  ],
  quiz: [
    { id: "q1", prompt: "According to the video, what actually drives most distraction?",
      options: ["The design of the apps", "An escape from internal discomfort", "A lack of willpower", "Too many notifications"],
      correctIndex: 1,
      explanation: "The core claim is that we flee an uncomfortable internal state — the phone is just the nearest exit." },
    { id: "q2", prompt: "What is the first step of the four-step model?",
      options: ["Delete the app", "Wait ten minutes", "Identify the trigger", "Tell a friend"],
      correctIndex: 2,
      explanation: "You start by naming the trigger — you can't manage a pull you haven't noticed." },
    { id: "q3", prompt: "Why does deleting apps often fail as a fix?",
      options: ["The apps come back", "It treats the symptom, not the trigger", "It takes too long", "People reinstall them"],
      correctIndex: 1,
      explanation: "Removing the tool leaves the underlying discomfort intact, so it just finds a new outlet." },
  ],
  tutorSeed: [
    { q: "What's the four-step model again?", a: "Identify the trigger, write down the time, explore the sensation with curiosity, then wait ten minutes." },
    { q: "Is it worth watching in full?", a: "Do the lesson, then watch 21:30–30:30 for the full framework. The rest is skippable." },
    { q: "What's the single biggest takeaway?", a: "Manage the internal trigger, not the tool — distraction is an escape from discomfort." },
  ],
};

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function fmtRange(a, b) { return `${fmtTime(a)}–${fmtTime(b)}`; }

Object.assign(window, { SAMPLE_LESSON, fmtTime, fmtRange });
