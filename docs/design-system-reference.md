# Tactile Field Guide Design System Reference

The VideoSense design system is **Tactile Field Guide**. It is already implemented in `src/styles.css` and the current route/component files. MVP work must preserve this style exactly.

## Canonical Files

- Tokens and utilities: `src/styles.css`
- Brand and mascot: `src/components/Brand.tsx`
- Landing shell and paste form: `src/routes/index.tsx`
- Lesson hero layout: `src/routes/lesson.$videoId.tsx`
- Player card treatment: `src/components/LessonCard.tsx`
- Timeline: `src/components/AttentionTimeline.tsx`
- Watch Score: `src/components/WatchScoreDial.tsx`
- Tutor: `src/components/TutorPanel.tsx`
- YouTube embed frame: `src/components/YouTubeEmbed.tsx`

## Identity

- Name: Tactile Field Guide.
- Feel: playful, practical, physical, high-contrast, compact.
- Required signals: cream paper-like page, white cards, heavy dark outlines, hard offset shadows, mascot-led brand, bold display typography, bright blue/yellow/green accents.

## Fonts

Defined in `src/styles.css`:

- Display: `Plus Jakarta Sans`, used for headings, logo, CTAs, important labels.
- Body: `Inter`, used for normal reading text.
- Metadata: `JetBrains Mono`, used for timestamps, small uppercase labels, progress metadata, and technical details.

Rules:

- Headings use display font and heavy weight.
- Body copy remains readable and compact.
- Metadata uses small uppercase mono with wide tracking.
- Do not replace the type system with a generic system font stack.

## Core Tokens

Current light theme tokens from `src/styles.css`:

- `--radius: 1.25rem`
- `--background: oklch(0.984 0.013 95)` - cream background.
- `--foreground: oklch(0.21 0.025 260)` - dark ink foreground.
- `--card: oklch(1 0 0)` - white cards.
- `--primary: oklch(0.62 0.19 256)` - primary blue.
- `--primary-foreground: oklch(1 0 0)` - white text on blue.
- `--secondary: oklch(0.74 0.17 50)` - yellow/orange.
- `--secondary-foreground: oklch(0.21 0.025 260)` - dark text on yellow/orange.
- `--muted: oklch(0.95 0.012 95)` - warm muted surface.
- `--muted-foreground: oklch(0.5 0.02 260)` - muted ink.
- `--accent: oklch(0.66 0.14 155)` - green.
- `--accent-foreground: oklch(1 0 0)` - white text on green.
- `--destructive: oklch(0.6 0.22 25)` - red/orange failure.

Keep these tokens as the MVP baseline. Adding tokens is allowed only when a new component cannot be expressed with the current system, and the new token must fit this palette.

## Borders And Shadows

Utilities from `src/styles.css`:

- `.brutal-border`: `border: 3px solid var(--foreground)`
- `.brutal-shadow`: `box-shadow: 8px 8px 0 0 var(--foreground)`
- `.brutal-shadow-sm`: `box-shadow: 4px 4px 0 0 var(--foreground)`
- `--shadow-brutal-lg`: `12px 12px 0 0 var(--foreground)` available for larger moments.

Rules:

- Primary cards, input shells, CTAs, embeds, progress bars, and important panels should use heavy foreground borders.
- Hard offset shadows are part of the product identity.
- Avoid soft drop-shadow-heavy UI except for the existing subtle mascot image shadow.
- Do not flatten important surfaces into borderless gray cards.

## Radius Scale

Current radius language:

- Base token: `1.25rem`.
- Cards commonly use `rounded-3xl` or `rounded-[32px]`.
- Inputs use large rounded shells, for example `rounded-[28px]`.
- Buttons use `rounded-2xl`.
- Small badges use `rounded-lg`, `rounded-md`, or `rounded-full` depending on purpose.

Rules:

- Keep the current rounded card/input language.
- Do not switch to sharp enterprise rectangles.
- Do not make nested card stacks overly soft or pill-shaped beyond current examples.

## Motion

Current animations in `src/styles.css`:

- `float`: slow mascot float with slight rotation.
- `card-in`: card enters with translate/rotate and opacity.
- `pop-in`: completion/celebration pop.
- Motion easing: `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)`.

Component motion:

- Processing progress bar uses spring-like width animation.
- Lesson card transitions use horizontal movement, slight rotation, and spring easing.

Rules:

- Use current float, card-in, pop-in, and spring card transitions only.
- Do not add unrelated animation styles, decorative particle systems, gradient morphing, or scroll spectacle.
- Motion should help state changes feel tactile, not distract from learning.

## Components

### Brand

Source: `src/components/Brand.tsx`

- Mascot image plus bold `VideoSense` wordmark.
- Mascot rotates slightly on hover.
- Small and medium sizes are supported.
- Brand must remain visible on primary screens.

### Input Shell

Source: `src/routes/index.tsx`

- White card surface.
- `brutal-border`.
- Large rounded shell.
- Hard offset shadow.
- Blue CTA button inside the shell.
- On mobile, input and CTA stack.

### Brutal Buttons

Patterns:

- Primary CTA: blue background, white text, heavy border, hard shadow.
- Secondary CTA: white card background, heavy border, hover inversion or subtle translate.
- Dark CTA: foreground background with cream/white text.

Rules:

- Buttons should feel physical and pressable.
- Use hover translate and shadow changes consistently.
- Keep text short.

### WatchScoreDial

Source: `src/components/WatchScoreDial.tsx`

- Circular SVG progress dial.
- Blue stroke for score.
- Large display score in center.
- Mono `/ 10` label.

### AttentionTimeline

Source: `src/components/AttentionTimeline.tsx`

- Segmented horizontal bar with black dividers.
- Segment list with dots, title, timestamp, blurb, and badge.
- Uses skip/watch/core/demo color language.

### LessonCard

Source: `src/components/LessonCard.tsx`

- Stacked offset layers behind main card.
- Main card is white, rounded `[32px]`, heavy border, generous padding.
- Kind badge uses a tint and border.
- Title is large display type.
- Optional analogy card uses dashed border.
- Optional quote uses strong blue left border.

### TutorPanel

Source: `src/components/TutorPanel.tsx`

- Fixed bottom-right launcher.
- Bordered modal panel with hard shadow.
- Simple chat rows with primary user bubbles and bordered tutor bubbles.
- Suggested question pills.

### YouTubeEmbed

Source: `src/components/YouTubeEmbed.tsx`

- `aspect-video`.
- Black background.
- Rounded `2xl`.
- `brutal-border`.
- Must remain visually integrated with hero and timestamp card contexts.

## Layout Rules

- Use centered max-width page shells already present in routes.
- Prefer compact cards and dense-but-readable sections.
- Do not put UI cards inside other decorative cards unless matching the existing stacked lesson-card pattern.
- Hero surfaces should reveal the product identity and the next meaningful section, not become a marketing splash.
- Preserve current two-column lesson hero on desktop and single-column collapse on smaller screens.

## Prohibited Changes

- No generic SaaS dashboard styling.
- No minimal gray UI.
- No purple gradient, orb, bokeh, or abstract decorative background aesthetic.
- No replacing the mascot-led identity.
- No replacing the current fonts without an explicit design decision.
- No soft neumorphism or glassmorphism.
- No large unrelated illustrations.
- No visual redesign that weakens the cream, black-border, hard-shadow, blue/yellow/green identity.
