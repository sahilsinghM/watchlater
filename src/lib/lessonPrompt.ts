// Shared prompt fragments for the lesson generators (Anthropic + OpenRouter).
// Kept as a pure module so the language contract is one string, unit-tested
// without touching either SDK.

/**
 * The lesson is written in the video's own language (owner decision
 * 2026-06-12), but the JSON contract stays English: zod enums in
 * lessonSchema.ts (difficulty, watchVerdict, segment/card kind,
 * visualContextStatus) reject translated values, which would kill the job as
 * GENERATION_SCHEMA_INVALID after a full generation run.
 */
export function languageDirective(languageCode: string): string {
  return (
    `LANGUAGE RULE: the transcript language code is "${languageCode}". ` +
    "Write ALL user-facing prose in that language — card titles/bodies/analogies, segment titles/blurbs, " +
    "quiz prompts/options/explanations, tutorSeed q&a, keyMoment captions, scoreReason, reallyAbout, " +
    "recommendation, and bestPart/skipPart why. " +
    "JSON field names and enum values (difficulty, watchVerdict, segment kind, card kind, visualContextStatus) " +
    "must remain EXACTLY the English strings specified in requiredShape; a translated enum value is a schema violation."
  );
}
