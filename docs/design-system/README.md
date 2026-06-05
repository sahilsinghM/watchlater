# Handoff: VideoSense Design System → Production

## Overview
This is the complete **VideoSense** design system — the neo-brutalist "Tactile Field Guide" look for the app that turns long YouTube videos into playful 5-minute interactive lessons. This bundle gives a developer everything needed to implement VideoSense-branded UI in a real codebase: design tokens, type + colour, the motion system, the full set of components, and a working interactive reference of the product flow.

The original source product is the `sahilsinghM/watchlater` repo (TanStack Start + React 19 + Tailwind v4 + shadcn/ui). This handoff distills it into reusable, framework-agnostic guidance.

## About the Design Files
The files in this bundle are **design references created in HTML/CSS/JSX** — prototypes that show the intended look, motion, and behaviour. They are **not** production code to copy verbatim. The task is to **recreate this system in your target codebase's environment** using its established patterns and libraries:

- If your codebase already uses **Tailwind v4**, lift the tokens in `colors_and_type.css` straight into your `@theme` block (they're already in the Tailwind v4 oklch format from the source app).
- If you use **CSS variables / vanilla CSS / CSS-in-JS**, `colors_and_type.css` is directly importable as-is.
- If you use **React / Vue / Svelte / SwiftUI / native**, treat the `.jsx` files in `ui_kit/` as a spec — recreate each component with your framework's idioms, matching the exact values documented below.

The `ui_kit/index.html` is a **runnable, self-contained click-through** of the entire product (open it in a browser, no build step) — use it as the behavioural source of truth.

## Fidelity
**High-fidelity (hifi).** Every colour, font, radius, shadow, easing curve, and piece of copy here is final and intentional. Recreate the UI pixel-for-pixel using your codebase's libraries. The values below are exact.

---

## Design Tokens

All tokens live in **`colors_and_type.css`** (importable as-is). Authored in **oklch** to match the source app.

### Colour — foundation
| Token | oklch | Role |
|---|---|---|
| `--background` | `oklch(0.984 0.013 95)` | Warm cream page / paper |
| `--foreground` | `oklch(0.21 0.025 260)` | Near-black cool ink — **all text & all borders** |
| `--card` | `oklch(1 0 0)` | Pure white raised surface |
| `--muted` | `oklch(0.95 0.012 95)` | Faint cream inset / track fill |
| `--muted-foreground` | `oklch(0.5 0.02 260)` | Slate caption text |

### Colour — signal accents (the four that do all the work)
| Token | oklch | Meaning |
|---|---|---|
| `--primary` | `oklch(0.62 0.19 256)` | **Blue** — watch / active / the brand colour (matches mascot) |
| `--secondary` | `oklch(0.74 0.17 50)` | **Amber** — "core" segment |
| `--accent` | `oklch(0.66 0.14 155)` | **Green** — correct / demo / success |
| `--destructive` | `oklch(0.6 0.22 25)` | **Red** — wrong / error |

Accents appear at **full strength** on fills and as **low-alpha tints** (`/10`–`/30`, via `color-mix(in oklab, var(--accent) 15%, transparent)`) for soft backgrounds behind chips & status rows.

> A `.dark` theme is included in `colors_and_type.css` (cooler navy-charcoal paper). Ship it if you need dark mode; otherwise ignore.

### Convenience aliases
`--fg1` (= foreground), `--fg2` (= muted-foreground), `--fg3` (ink @ 45%), `--bg1` (page), `--bg2` (card), `--bg3` (muted), `--line` (= foreground, the structural border), `--line-soft` (ink @ 12%, hairline dividers).

### Typography
| Family token | Stack | Use |
|---|---|---|
| `--font-display` | **Plus Jakarta Sans**, system-ui | Headings, brand wordmark. Weights 500/700/**800**. |
| `--font-body` | **Inter**, system-ui | Body & UI. 400/500/600/700. |
| `--font-mono` | **JetBrains Mono**, ui-monospace | Uppercase eyebrow labels & timecodes. 500/700. |

Load from Google Fonts (already `@import`ed at the top of `colors_and_type.css`):
`Plus+Jakarta+Sans:wght@500;700;800` · `Inter:wght@400;500;600;700` · `JetBrains+Mono:wght@500;700`

**Semantic type scale** (CSS vars + `.vs-h1`/`.vs-h2`/`.vs-h3`/`.vs-body`/`.vs-small`/`.vs-label` classes provided):
| Style | Family | Size | Weight | Tracking | Leading |
|---|---|---|---|---|---|
| h1 | display | `clamp(2.75rem, 6vw, 4.5rem)` | 800 | −0.02em | 1.05 |
| h2 | display | `clamp(1.75rem, 3vw, 2.25rem)` | 800 | −0.02em | 1.1 |
| h3 | display | 1.25rem | 800 | −0.01em | 1.2 |
| body | body | 1.125rem | 400 | — | 1.6 |
| small | body | 0.875rem | 500 | — | — |
| label (eyebrow) | mono | 0.625rem | 700 | **0.15em** | uppercase |

The **mono uppercase eyebrow label** (`THIS VIDEO IN 30 SECONDS`, `CARD 03 / 06`, `04:12–06:30`) is a signature — use it for all section eyebrows, timecodes, and status labels.

### Radius scale (base `--radius: 1.25rem` = 20px)
`sm` 16 · `md` 18 · `lg/base` 20 · `xl` 24 · `2xl` 28 · `3xl` 32 · pill `9999px`. **Cards use 28–32px.** The contrast of big radii against the square-cornered hard shadow is the brand.

### The signature shadow + border system
| Token | Value |
|---|---|
| `--border-brutal` | `3px solid var(--foreground)` |
| `--shadow-brutal-sm` | `4px 4px 0 0 var(--foreground)` |
| `--shadow-brutal` | `8px 8px 0 0 var(--foreground)` |
| `--shadow-brutal-lg` | `12px 12px 0 0 var(--foreground)` |
| `--shadow-brutal-hover` | `10px 10px 0 0 var(--foreground)` |

**Zero blur, foreground ink, hard offset.** Never use soft/blurred shadows on hero chrome. Dividers use `--line-soft` (2px ink @ 12%); "secondary info" insets (analogy box, best/skip callouts) use a **2px dashed** border.

### Motion tokens
| Token | Value | Feel |
|---|---|---|
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoots then settles — the brand feel. Use for fills, dials, card-in, the toggle thumb. |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Settles without overshoot — utility transitions. |

Three named keyframes (provided as `.animate-float` / `.animate-card-in` / `.animate-pop-in`):
- **float** — `translateY(0→-10px)` + `rotate(-1deg→1deg)`, **6s** `ease-in-out` infinite. The mascot.
- **card-in** — from `translateY(40px) rotate(2deg) opacity:0` → `translateY(0) rotate(-1deg) opacity:1`, **0.55s** spring. Player/quiz card entrance.
- **pop-in** — `scale(0.6→1.08→1)` + fade, **0.5s** spring. The done-screen celebration.

**Interaction physics (apply everywhere):**
- **Hover:** `translate(-2px, -2px)` + shadow grows (`--shadow-brutal` → `--shadow-brutal-lg`); primary button adds `brightness(1.06)`; outline/secondary buttons & chips **invert to ink** (`background: foreground; color: background`).
- **Press/active:** `translateY(1–2px)` down + shadow shrinks to `--shadow-brutal-sm`. The CTA visibly sinks.
- **Focus:** input border darkens from ink@35% to full ink + the shell lifts `-2,-2`.
- **Progress fills, dial sweeps:** animate width / `stroke-dashoffset` over **~500–900ms** with `--ease-spring`.
- **Reduced motion:** `@media (prefers-reduced-motion: no-preference)` should gate entrances; fall back to the visible end-state.

See `motion/*.html` for runnable demonstrations of each.

---

## Components

All component classes are in **`ui_kit/kit.css`**; React reference implementations in **`ui_kit/components.jsx`**. Recreate these in your framework.

### Button (`.vs-btn`)
- Base: `font-display` 700, `3px solid foreground` border, radius 16px, `active:translateY(2px)`.
- Sizes: `lg` 18px / 14×24 pad · `md` 15px / 12×20 · `sm` 13px / 9×16 / 2px border.
- **primary** — bg primary, white text, `--shadow-brutal`; hover lift + `brightness(1.06)`; active sink to `--shadow-brutal-sm`.
- **ink** — bg foreground, bg-coloured text, `--shadow-brutal-sm`.
- **outline** — bg card, ink text; hover inverts to ink.
- **quiet** (`.vs-quiet`) — mono uppercase 10px label-button, no border, muted → foreground on hover. Used for Previous / Next / Exit.
- CTAs carry a trailing arrow: `Generate lesson →`, `Start 5-minute lesson →`, `Quiz time →`.

### Card (`.vs-card`)
White fill, `3px solid foreground`, radius **32px** (`.vs-card` default), optional `.shadow`/`.sm-shadow`. Padding `.vs-pad` 24 / `.vs-pad-lg` 32. Soft variant `.vs-soft` (2px line-soft, radius 16). Dashed inset `.vs-dashed` (2px dashed ink@22%, cream bg).

### Lesson card (signature — `LessonCardView`)
The hero component. A white card (3px border, radius 32, pad 32) with **two coloured cards peeking out behind it**, slightly rotated, so the stack looks physically dealt:
- back card: `translate(12px,12px) rotate(2deg)`, bg `--secondary` (amber)
- mid card: `translate(6px,6px) rotate(-1deg)`, bg `--accent` (green)
- face card: `rotate(-1deg)` (or 0), entrance via `card-in`.
Inside: a kind chip (top-left) + mono timecode jump-link `@ 12:48 ↗` (top-right), a display-800 32px title, 18px/1.6 body. Optional dashed "analogy" box or a `4px solid primary` left-border blockquote for "The Quote".

### Kind chips (`.vs-chip`)
Small 10px uppercase 700 pills, 1px border, radius 8. Map: `concept`→amber tint, `analogy`/`insight`→blue tint, `quote`→green tint, `recap`→amber tint. Labels: Key Concept / Analogy / The Quote / Insight / Remember This.

### Tone toggle (`.vs-toggle` + `.vs-seg`)
Segmented control, 2px border, radius 18, `--shadow-brutal-sm`. Active segment = ink fill, bg text. Four options with **fixed functional emoji**: `💡 Clear`, `🤝 Friendly`, `😄 Funny`, `🧐 Strict`. These four tones change the lead-in copy on concept/recap cards (see `TONE_LEAD` in `components.jsx`) — this is brand voice as a control.

### Watch Score dial (`WatchScoreDial`)
SVG ring, r=44, 10px stroke. Track = ink@10%, fill = primary, `stroke-linecap: round`, rotated −90deg. `stroke-dashoffset` animates over **900ms** spring on mount. Centre: display-800 28px score + mono `/ 10`.

### Attention timeline (`AttentionTimeline`)
A 24px-tall pill bar, 3px border, split into segments (3px ink dividers between). Segment colours by kind: `skip`→muted, `watch`→primary@30%, `core`→secondary, `demo`→accent. Click a segment to seek. Below: a 2-up grid of soft cards (one per segment) with a colour dot, title, timecode, blurb; hover lifts `-2px` + border darkens.

### Progress bar (`.vs-track` + `.fill`)
12px tall, 3px border, pill. Fill = primary (`.amber` variant = secondary), `transition: width 0.6s var(--ease-spring)`.

### Input (`.vs-input-shell`)
Flex shell, 3px border, radius 28, `--shadow-brutal`; hover lifts `-2,-2` + shadow grows. Borderless input inside, mono/body placeholder. Trailing primary button (the hero URL field) or a 2px-line textarea for feedback.

### Tutor panel (`TutorPanel`)
Fixed launcher pinned `bottom-24 right-24`: ink pill, `💬 Ask the tutor`. Opens a modal — scrim is the only blur in the system: `background: foreground/40; backdrop-filter: blur(4px)`. Card has 3px border, radius 28, `--shadow-brutal`. User bubbles = primary fill right-aligned; tutor bubbles = cream/line-soft. Seed-question pills (`.vs-pill`, hover inverts to ink). The tutor **only answers from the transcript** — fallback line is exactly `"I cannot tell from this video."`

### Brand lockup (`Brand`)
Mascot PNG (`assets/mascot.png`) + "VideoSense" wordmark in display-800 −0.02em, side by side. Hover rotates the mascot `-6deg`. Sometimes paired with a rotated speech bubble (`rotate(6deg)`, 3px border, `--shadow-brutal-sm`, "I'm ready!").

---

## Screens / Views (product flow)
The full flow is in `ui_kit/app.jsx` (six screens) — runnable via `ui_kit/index.html`.

1. **Landing** — centred max-w-896 hero; "Built for busy learners" pill, h1 `Understand any long video in 5 minutes.` (the "in 5 minutes." in italic primary), URL input shell, floating mascot with speech bubble; "What you get" 3-up feature grid; "How it works" numbered list; footer eyebrow.
2. **Processing** — centred, mascot floating, "Building your lesson…", a `--ease-spring` progress bar, and a 6-step list that auto-advances (~620ms each); the active step shows a self-aware quip ("Watching the boring parts so you don't have to.").
3. **Lesson hero** — asymmetric **3/2 grid**. Left: title + "This video in 30 seconds" card with best/skip dashed callouts + CTAs. Right: video frame + Watch Score dial card. Below: full-width Attention map + a recommendation card. Tone toggle in header, tutor launcher fixed.
4. **Player** — max-w-672 reading column. "Card NN / 06" mono eyebrow + "% complete", progress bar, the stacked lesson card (`card-in`), a video frame at the card's timestamp, three reaction tiles (`🤔 Explain more` / `✅ Got it` / `🥱 Too basic`), quiet prev/exit/next nav.
5. **Quiz** — 3 questions; pick → **Check answer** → reveal (correct = green border/tint + ✓, wrong pick = red + ✗, others dim) → dashed explanation box → next. Amber progress bar. Scores at the end.
6. **Done** — `pop-in` mascot, "Lesson complete.", big primary **mastery %** card, result label (≥80% Mastered / ≥50% Solid grasp / else Worth a re-read), "If you want more" pointer to the best part, and a feedback prompt.

## Interactions & Behavior
- **Navigation:** linear `landing → processing → lesson → player → quiz → done`, with back-links (`← Try another video`, `Exit lesson`, `Back to lesson hero`). `window.scrollTo(0)` on each transition.
- **Processing** auto-advances on a timer, then routes to the lesson hero.
- **Tone toggle** is global to the lesson/player and rewrites concept/recap card lead-ins live.
- **Quiz** is a two-tap commit (check, then advance); reveal is instant and colour-coded.
- **Tutor** matches the question against seeded Q/A by keyword; no match → the transcript-only fallback line.
- All hover/press/focus physics per the Motion tokens above.

## State Management
Minimal, client-side: `screen` (which view), `tone` (clear/friendly/funny/strict), quiz `idx`/`picked`/`revealed`/`answers`, and `result` `{score,total}`. In production, the lesson object (see `ui_kit/data.jsx` for the exact shape — video meta, watchScore, segments, cards, quiz, tutorSeed) would come from your API; here it's the `SAMPLE_LESSON` fixture.

## Assets
- **`assets/mascot.png`** — the VideoSense mascot (cheerful round blue character with a play-button card). The brand's hero image; use on empty/loading/celebration states. Do **not** recolour or redraw it. Originally `src/assets/mascot.png` in the source repo.
- **Icons: Lucide** (`lucide-react` in production; CDN `lucide@0.544.0` in the HTML reference). Thin rounded 2px-stroke set — the official VideoSense icon library. Don't hand-draw SVG icons. Unicode arrows (`→ ↗ ← ✓ ✗ ▶`) are used as text, and functional emoji only on the tone toggle / reactions / tutor launcher.

## Files in this bundle
| Path | What it is |
|---|---|
| `README.md` | This handoff. Self-sufficient implementation spec. |
| `DESIGN_SYSTEM.md` | The full design-system reference (product context, content voice, visual foundations, iconography). |
| `colors_and_type.css` | **Import this first.** All tokens — colour, type, radii, shadow/border, motion, semantic classes, keyframes. Tailwind v4 / vanilla CSS ready. |
| `assets/mascot.png` | The mascot. |
| `ui_kit/index.html` | Runnable click-through of the whole product (open in a browser). |
| `ui_kit/kit.css` | Component classes built on the tokens. |
| `ui_kit/components.jsx` | React reference for every component. |
| `ui_kit/app.jsx` | The six screens + flow. |
| `ui_kit/data.jsx` | The lesson data shape + a realistic fixture. |
| `motion/*.html` | Runnable motion specimens — keyframes, easing curves, press states, progress fills. |

## Implementation checklist
1. Drop `colors_and_type.css` tokens into your theme (or `@theme` if Tailwind v4).
2. Wire the three Google Fonts.
3. Add Lucide to your icon pipeline.
4. Build the primitives (button, card, chip, input, progress, eyebrow label) to the specs above.
5. Build the signature pieces (stacked lesson card, watch-score dial, attention timeline, tone toggle, tutor panel).
6. Honour the interaction physics — hard offset shadows, hover lift, press sink, spring fills — they're the brand.
7. Keep the copy plain-spoken and time-respecting; "you"/"we"/mascot-"I"; emoji only as control glyphs.
