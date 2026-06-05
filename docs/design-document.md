# Design Document

This document describes the user experience while preserving the current Pixel Perfect View implementation. The visual system is locked in [design-system-reference.md](./design-system-reference.md).

## Design Source

Use the current app as the visual source of truth:

- Landing: `src/routes/index.tsx`
- Processing: `src/routes/processing.$videoId.tsx`
- Lesson hero: `src/routes/lesson.$videoId.tsx`
- Player: `src/routes/lesson.$videoId.player.tsx`
- Quiz: `src/routes/lesson.$videoId.quiz.tsx`
- Completion: `src/routes/lesson.$videoId.done.tsx`
- Components: `src/components/Brand.tsx`, `src/components/WatchScoreDial.tsx`, `src/components/AttentionTimeline.tsx`, `src/components/LessonCard.tsx`, `src/components/TutorPanel.tsx`, `src/components/YouTubeEmbed.tsx`
- Tokens and utilities: `src/styles.css`

## Landing And Paste Screen

The landing screen keeps the current hero composition:

- Cream full-page background.
- Header with `Brand`, mascot mark, and simple anchor navigation.
- Centered badge, oversized display headline, and concise supporting copy.
- Brutal bordered input shell with white card background, rounded `28px` shape, hard black offset shadow, blue focus glow, and strong blue CTA.
- Playful mascot below the form with floating animation and small bordered speech label.
- Compact "What you get" cards and "How it works" list using the same bordered card language.

MVP behavior changes:

- Remove or hide public `sample` shortcut. It can remain only as a development tool.
- Keep inline invalid URL error placement and tone.
- Add client-visible validation copy for unsupported URL shapes, including Shorts when detectable from URL.

## Processing Screen

Keep the current centered processing layout from `src/routes/processing.$videoId.tsx`:

- Mascot at top with float animation.
- Bold display heading.
- Mono uppercase subtext.
- Brutal bordered progress bar with blue fill.
- Vertical list of rounded step rows.
- Active row uses full foreground border and `brutal-shadow-sm`.
- Done row uses green accent circle.
- Future rows are faded, still card-like.

MVP behavior changes:

- Step state must come from a real backend job, not a timer-only animation.
- Recommended job steps:
  - Fetching video details.
  - Reading the transcript.
  - Finding the key moments.
  - Capturing important visuals.
  - Building your interactive lesson.
  - Preparing your quiz.
- Timer animation may smooth transitions, but it must not imply completion before the backend state exists.
- Errors use the current centered error state and add required failure states from [mvp-spec.md](./mvp-spec.md).

## Lesson Hero

Keep the current two-column lesson hero from `src/routes/lesson.$videoId.tsx`:

- Header with `Brand` and `ToneToggle`.
- Left column: metadata, large lesson title, "This video in 30 seconds" card, best/skip cards, and action buttons.
- Right column: brutal bordered YouTube embed and Watch Score panel.
- Below: attention map section and recommendation panel.

Behavior:

- The embedded video must use the original YouTube ID.
- "Start 5-minute lesson" opens the player route.
- "Watch the best part" seeks the embedded video to the generated best-part timestamp.
- Best and skip cards must use the current dashed-border card treatment.
- Recommendation panel must remain a compact brutal card, not a dashboard widget.

## Timeline

Use the current `AttentionTimeline` component:

- Segmented horizontal bar with black dividers and rounded full shape.
- Segment kinds: skip, watch, core, demo.
- Segment colors:
  - Skip: muted.
  - Watch: blue tint.
  - Core: yellow/orange tint.
  - Demo: green tint.
- Segment list uses compact rounded rows with dots, mono timestamp ranges, short blurbs, and kind badges.

Behavior:

- Clicking a segment seeks the video to the segment start.
- Each segment must have a title, start/end timestamps, kind, and grounded blurb.
- Segment count may vary, but the bar must remain readable and compact.

## Lesson Player

Keep the current player layout:

- Narrow centered column.
- Header with small brand and tone toggle.
- Mono progress label and brutal bordered progress bar.
- Stacked brutal lesson card with colored offset layers behind it.
- Timestamp embed below card when the card has a source timestamp.
- Three compact quick-action buttons below the card.
- Previous, exit, and next controls as small mono navigation.

Behavior:

- Cards come from generated lesson data.
- Each card must be grounded in transcript evidence.
- Timestamp controls seek the video.
- Quick actions should become persisted feedback signals where practical, but the visual control style should remain unchanged.

## Quiz

Keep the current quiz screen language:

- Small brand header.
- Mono question count.
- Brutal bordered progress bar with yellow/orange fill.
- Large brutal quiz card using display heading.
- Options as full-width rounded rows with strong border state changes.
- Correct state uses green accent; incorrect uses destructive tint.

MVP behavior changes:

- Fix the current prototype limitation where the button does not provide a separate check-then-next state if product wants answer reveal before advancing.
- Persist answers, correctness, and final score.
- Explanations must be grounded in the generated lesson/transcript.

## Completion

Keep the current completion screen:

- Mascot appears at top with pop-in animation.
- Large "Lesson complete" display heading.
- Brutal mastery card with large blue percentage.
- Compact follow-up card pointing to the best section.
- Buttons back to hero and process another video.

MVP behavior changes:

- Add a usefulness feedback control on or immediately after completion.
- Persist rating and optional reason to Supabase.
- Do not change the completion page into an analytics dashboard.

## Tutor

Keep the current `TutorPanel` interaction model:

- Fixed bottom-right brutal button.
- Modal drawer/panel with heavy border, hard shadow, card background, and simple chat rows.
- Suggested questions as rounded pills.
- Input row with rounded border and blue Ask button.

MVP behavior changes:

- Replace seeded local QA with grounded tutor responses.
- Tutor must answer only from transcript, lesson, and screenshot/key-frame context.
- If answer is not supported by source material, tutor should say it cannot tell from this video.
- Store tutor interactions only if needed for product learning, abuse prevention, or debugging.

## Responsive Behavior

- Preserve the current max-width centered layouts.
- Landing hero and lesson hero should collapse cleanly to one column.
- Input CTA stacks below the input on small screens as it does today.
- Touch targets must remain large enough for mobile.
- Text must not overflow card, button, or badge containers.

## Copy Tone

The product voice is direct, playful, and useful. Keep short lines like "Building your lesson...", "This video in 30 seconds", "Watch the best part", and "Lesson complete." Avoid enterprise wording, vague productivity claims, and long instructional text inside the app.
