import type { Lesson } from "@/lib/lessonSchema";

// Sample video: Andrej Karpathy — "Intro to Large Language Models" style placeholder.
// Using a real, popular educational video so the embed works out of the box.
export const sampleLesson: Lesson = {
  video: {
    id: "sample",
    youtubeId: "zjkBMFhNj_g",
    url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
    title: "Intro to Large Language Models",
    channel: "Andrej Karpathy",
    duration: 3492, // ~58:12
    publishedAt: "2023-11-22",
    thumbnail: "https://img.youtube.com/vi/zjkBMFhNj_g/maxresdefault.jpg",
  },
  watchScore: 8.3,
  scoreReason:
    "High-signal explanation with strong demos, but the first 7 minutes are mostly setup and the closing 10 minutes overlap previously covered ground.",
  difficulty: "Intermediate",
  reallyAbout:
    "This isn't really a video about ‘what an LLM is’. It's about why LLMs behave like operating systems — and why agentic workflows need controlled checkpoints, not unlimited autonomy.",
  bestPart: {
    start: 1100,
    end: 1870,
    why: "The speaker stops being abstract and walks through a concrete agent loop with tool calls.",
  },
  skipPart: {
    start: 0,
    end: 405,
    why: "Mostly intro, definitions, and reading from slides you can skim in 30 seconds.",
  },
  recommendation:
    "Do the 5-minute lesson first. Then jump to the demo section (18:20–31:10) if you want implementation clarity.",
  segments: [
    { start: 0, end: 405, kind: "skip", title: "Intro & hype", blurb: "Setup and definitions. Skim or skip." },
    { start: 405, end: 1100, kind: "watch", title: "What LLMs really are", blurb: "Useful framing of LLMs as zip-compressed knowledge." },
    { start: 1100, end: 1870, kind: "core", title: "Agent loops & tools", blurb: "Core argument of the video. Worth watching." },
    { start: 1870, end: 2470, kind: "demo", title: "Live demo: controlled workflow", blurb: "Implementation clarity. Watch if practical." },
    { start: 2470, end: 3010, kind: "watch", title: "Failure modes", blurb: "Where unconstrained agents break, with examples." },
    { start: 3010, end: 3492, kind: "skip", title: "Closing thoughts", blurb: "Mostly recap. Skip unless you want the wrap-up." },
  ],
  cards: [
    {
      id: "c1",
      kind: "concept",
      title: "LLMs are operating systems, not chatbots",
      body: "The model isn't the product. It's the kernel. Real systems wrap it in memory, tools, and a controller — like an OS wraps a CPU.",
      timestamp: 480,
    },
    {
      id: "c2",
      kind: "analogy",
      title: "An agent is like a new intern",
      body: "Smart, eager, but useless without process. You don't fix a flaky intern by giving them a smarter brain. You fix them by giving them a checklist.",
      analogy:
        "Think of an AI agent like an intern. The model is the intern's brain. Tools are the office systems. If the systems are broken, the smart intern still fails.",
      timestamp: 1180,
    },
    {
      id: "c3",
      kind: "insight",
      title: "Controlled workflows beat raw autonomy",
      body: "Reliability comes from constraints. The most useful agents today look more like state machines with LLM nodes than like ‘free-roaming brains’.",
      timestamp: 1450,
    },
    {
      id: "c4",
      kind: "quote",
      title: "The line that defines the talk",
      body: "This is the moment the abstract argument lands.",
      quote:
        "Agents don't fail because models are weak. They fail because workflows are uncontrolled.",
      quoteAuthor: "Andrej Karpathy (paraphrased)",
      timestamp: 1690,
    },
    {
      id: "c5",
      kind: "concept",
      title: "Three layers of an agent",
      body: "Brain (the model), Hands (tools and APIs), Spine (the controller that decides what runs next). Most failures live in the spine.",
      timestamp: 1980,
    },
    {
      id: "c6",
      kind: "recap",
      title: "Remember this",
      body: "Don't chase smarter models when your workflow is broken. Add checkpoints, narrow the tool surface, and let the model do less.",
      timestamp: 2880,
    },
  ],
  keyMoments: [
    { timestamp: 480, caption: "The OS analogy lands" },
    { timestamp: 1180, caption: "The intern analogy" },
    { timestamp: 1690, caption: "Best line of the talk" },
    { timestamp: 1980, caption: "Three layers diagram" },
  ],
  quiz: [
    {
      id: "q1",
      prompt: "According to the talk, what's the main reason AI agents fail in production?",
      options: [
        "The underlying models aren't smart enough",
        "Workflows are uncontrolled",
        "Users ask poorly-formed questions",
        "Tools are too slow",
      ],
      correctIndex: 1,
      explanation:
        "The central claim: capability isn't the bottleneck — control is. Reliable systems constrain the workflow.",
    },
    {
      id: "q2",
      prompt: "Which analogy does the speaker use for an LLM-based agent?",
      options: ["A senior engineer", "A new intern", "A search engine", "A spreadsheet"],
      correctIndex: 1,
      explanation:
        "An intern is smart but needs process. Same with agents — the model is fine; the surrounding system is the problem.",
    },
    {
      id: "q3",
      prompt: "What do the ‘three layers’ of an agent refer to?",
      options: [
        "Prompt, response, evaluation",
        "Brain, hands, spine",
        "Frontend, backend, database",
        "Vector store, retriever, generator",
      ],
      correctIndex: 1,
      explanation:
        "Brain = model, hands = tools, spine = controller. Most production failures live in the spine.",
    },
  ],
  tutorSeed: [
    {
      q: "What does the speaker mean by ‘controlled workflow’?",
      a: "A workflow where the LLM only makes decisions at well-defined checkpoints, with a narrow set of tools, and where each step's output is validated before the next runs. The opposite is letting the model freely call any tool in any order.",
    },
    {
      q: "Is this video worth watching in full?",
      a: "Mostly no. The first 7 minutes are setup and the last 10 minutes are recap. The core 18:20–31:10 section is where the real argument is made — that's the part the lesson covers.",
    },
    {
      q: "How does this apply to building my own agent?",
      a: "Start with the spine, not the brain. Define the state machine first: what are the legal steps, what gets validated, where does a human approve? Then bolt the model in as a decision node, not as the whole system.",
    },
  ],
};