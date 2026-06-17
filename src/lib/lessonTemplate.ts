import type { CardKind } from "./lessonSchema";

export const LESSON_TEMPLATE = {
  cardCount: 6,
  cardKinds: [
    "concept",
    "analogy",
    "insight",
    "quote",
    "concept",
    "recap",
  ] as const satisfies readonly CardKind[],
  segmentCount: 6,
} as const;
