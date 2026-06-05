# VideoSense Documentation

This folder is the implementation reference for the VideoSense MVP. It records the product decisions, MVP scope, design direction, and engineering roadmap needed to move from the current scaffold to the complete product.

## Source Of Truth

- Product decisions: [decisions.md](./decisions.md)
- MVP scope and acceptance criteria: [mvp-spec.md](./mvp-spec.md)
- Screen behavior and UX: [design-document.md](./design-document.md)
- Visual system and component rules: [design-system-reference.md](./design-system-reference.md)
- Build sequence: [implementation-roadmap.md](./implementation-roadmap.md)

## Current App State

The current workspace contains a visually complete prototype of the intended experience:

- Paste URL landing screen: `src/routes/index.tsx`
- Processing screen: `src/routes/processing.$videoId.tsx`
- Lesson hero: `src/routes/lesson.$videoId.tsx`
- Lesson player: `src/routes/lesson.$videoId.player.tsx`
- Quiz and completion: `src/routes/lesson.$videoId.quiz.tsx`, `src/routes/lesson.$videoId.done.tsx`
- Core visual tokens: `src/styles.css`
- Core components: `src/components/Brand.tsx`, `src/components/WatchScoreDial.tsx`, `src/components/AttentionTimeline.tsx`, `src/components/LessonCard.tsx`, `src/components/TutorPanel.tsx`, `src/components/YouTubeEmbed.tsx`

The implementation is not yet MVP-complete. It still uses an in-memory lesson cache, prototype lesson generation, seeded tutor replies, and a synthetic fallback path when transcript ingestion fails. Those behaviors are acceptable only as current scaffold behavior. The MVP must replace them with Supabase persistence, real job status, transcript-backed OpenAI lesson generation, screenshot capture, grounded tutoring, and feedback storage.

## Design Lock

The current Pixel Perfect View design is the required direction. The design system is named **Tactile Field Guide**. Preserve the cream background, heavy black borders, hard offset shadows, playful mascot identity, bold display type, compact rounded cards, and blue/yellow/green accents.

Do not restyle the MVP into a generic SaaS dashboard, gray minimalist interface, purple gradient/orb aesthetic, or mascot-free productivity tool.
