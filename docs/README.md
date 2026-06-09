# WatchLater Documentation

This folder is the implementation reference for the WatchLater MVP. It records the product decisions, MVP scope, design direction, and engineering roadmap needed to move from the current scaffold to the complete product.

## Source Of Truth

- Product decisions: [decisions.md](./decisions.md)
- MVP scope and acceptance criteria: [mvp-spec.md](./mvp-spec.md)
- Screen behavior and UX: [design-document.md](./design-document.md)
- Visual system and component rules: [design-system-reference.md](./design-system-reference.md)
- Canonical design-system bundle (tokens, UI kit, motion specimens): [design-system/](./design-system/)
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

The **Tactile Field Guide** design system is the required direction and is a
hard guardrail for all current and future work. Its full, authoritative spec is
[design-system-reference.md](./design-system-reference.md), backed by the
canonical bundle in [design-system/](./design-system/). The tokens are
implemented in `src/styles.css` and mirror
[design-system/colors_and_type.css](./design-system/colors_and_type.css) 1:1
(including a branded `.dark` theme — blue/amber/green accents, not slate).

Preserve the cream background, heavy black borders, hard offset shadows, playful
mascot identity, bold display type, compact rounded cards, and the four signal
accents (blue / amber / green / red). Every new surface must pass the adherence
checklist in the reference doc.

Do not restyle the MVP into a generic SaaS dashboard, gray minimalist interface,
purple gradient/orb aesthetic, or mascot-free productivity tool. See
[`CLAUDE.md`](../CLAUDE.md) for the enforced design rules applied to all work in
this repo.
