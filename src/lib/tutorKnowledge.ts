import type { Lesson } from "./lessonSchema";

export type TutorKnowledge = {
  summary: string;
  keyPoints: string[];
  qaBank: Array<{ q: string; a: string }>;
  recommendation: string;
};

export function buildTutorKnowledge(lesson: Lesson): TutorKnowledge {
  return {
    summary: lesson.reallyAbout,
    keyPoints: lesson.cards.map((c) => c.title),
    qaBank: lesson.tutorSeed ?? [],
    recommendation: lesson.recommendation,
  };
}

const STOP_WORDS = new Set([
  "does",
  "speaker",
  "think",
  "about",
  "video",
  "what",
  "where",
  "when",
  "would",
  "could",
  "should",
  "tell",
  "this",
  "that",
  "from",
  "have",
  "will",
  "your",
  "more",
  "just",
  "mean",
]);

function qualifyingWords(question: string): string[] {
  return question
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

export function answerQuestion(knowledge: TutorKnowledge, question: string): string {
  const q = question.toLowerCase();

  if (/\b(watch|worth|full|skip|recommend)\b/.test(q)) {
    return knowledge.recommendation;
  }

  const words = qualifyingWords(question);
  if (words.length === 0) {
    return "I cannot tell from this video.";
  }

  // Build a searchable blob from the knowledge fields.
  const searchable = [
    knowledge.summary,
    knowledge.recommendation,
    ...knowledge.keyPoints,
    ...knowledge.qaBank.flatMap((item) => [item.q, item.a]),
  ]
    .join(" ")
    .toLowerCase();

  const supported = words.some((word) => searchable.includes(word));
  if (!supported) {
    return "I cannot tell from this video.";
  }

  const match = knowledge.qaBank.find((item) =>
    words.some(
      (word) => item.q.toLowerCase().includes(word) || item.a.toLowerCase().includes(word),
    ),
  );
  return match?.a ?? knowledge.summary;
}
