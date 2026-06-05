# VideoSense — "Tactile Field Guide" Design System Reference

This is the **authoritative** design-system reference for VideoSense (repo name:
`watchlater`). It is the source of truth that **all current and future design
work must adhere to 100%**.

The neo-brutalist **Tactile Field Guide** look is: _heavy near-black borders,
hard offset shadows, warm cream paper, white cards, primary blue, a friendly
round mascot_. It feels like a well-made printed field manual — tactile,
confident, lightly playful, never timid and never generic.

## Canonical files

The complete, framework-agnostic handoff bundle lives in
[`docs/design-system/`](./design-system/) and is the canonical spec:

- [`design-system/colors_and_type.css`](./design-system/colors_and_type.css) — **every token** (colour, type, radii, shadow/border, motion, semantic classes, keyframes) in importable oklch form. This is mirrored 1:1 by `src/styles.css`.
- [`design-system/DESIGN_SYSTEM.md`](./design-system/DESIGN_SYSTEM.md) — full product context, content voice, visual foundations, iconography.
- [`design-system/README.md`](./design-system/README.md) — the implementation handoff and checklist.
- [`design-system/ui_kit/`](./design-system/ui_kit/) — runnable click-through (`index.html`), component classes (`kit.css`), React reference components (`components.jsx`), the six screens (`app.jsx`), and the lesson data shape (`data.jsx`). **`index.html` is the behavioural source of truth.**
- [`design-system/motion/`](./design-system/motion/) — runnable motion specimens (keyframes, easing, press, progress).

The live implementation of these tokens:

- Tokens + utilities: `src/styles.css` (Tailwind v4 `@theme`, oklch).
- Brand + mascot: `src/components/Brand.tsx`, `src/assets/mascot.png`.
- Signature components: `LessonCard.tsx`, `AttentionTimeline.tsx`, `WatchScoreDial.tsx`, `ToneToggle.tsx`, `TutorPanel.tsx`, `YouTubeEmbed.tsx`.
- Screens: `src/routes/index.tsx`, `processing.$videoId.tsx`, `lesson.$videoId.tsx`, `…player.tsx`, `…quiz.tsx`, `…done.tsx`.

When `src/styles.css` and `design-system/colors_and_type.css` ever disagree,
the latter is correct and `src/styles.css` must be brought back in line.

---

## Colour

Authored in **oklch** for consistent lightness. Light theme is default; a
branded `.dark` theme ships in both files (cooler navy-charcoal paper, the four
accents stay at full strength).

### Foundation

| Token | oklch | Role |
|---|---|---|
| `--background` / `--bg1` | `oklch(0.984 0.013 95)` | Warm cream page / paper |
| `--foreground` / `--fg1` / `--line` | `oklch(0.21 0.025 260)` | Near-black cool ink — **all text & all borders** |
| `--card` / `--bg2` | `oklch(1 0 0)` | Pure white raised surface |
| `--muted` / `--bg3` | `oklch(0.95 0.012 95)` | Faint cream inset / track fill |
| `--muted-foreground` / `--fg2` | `oklch(0.5 0.02 260)` | Slate caption text |
| `--fg3` | ink @ 45% | Tertiary / disabled ink |
| `--line-soft` | ink @ 12% | Hairline dividers |

### The four signal accents (they do all the work)

| Token | oklch | Meaning |
|---|---|---|
| `--primary` | `oklch(0.62 0.19 256)` | **Blue** — watch / active / brand (matches mascot) |
| `--secondary` | `oklch(0.74 0.17 50)` | **Amber** — "core" segment |
| `--accent` | `oklch(0.66 0.14 155)` | **Green** — correct / demo / success |
| `--destructive` | `oklch(0.6 0.22 25)` | **Red** — wrong / error |

Accents appear at **full strength** on fills and as **low-alpha tints**
(`/10`–`/30`, e.g. `color-mix(in oklab, var(--accent) 15%, transparent)`) for
soft backgrounds behind chips & status rows. **Never introduce a fifth accent
hue** — these four carry all signalling.

These map to the product's colour language: `skip`→muted, `watch`→primary,
`core`→secondary (amber), `demo`/`correct`→accent (green), `wrong`/`error`→destructive.

---

## Typography

Three families, loaded from Google Fonts (already `@import`ed in both files).
**Do not replace the type system with a generic system-font stack.**

| Family token | Stack | Use |
|---|---|---|
| `--font-display` | **Plus Jakarta Sans**, system-ui | Headings, brand wordmark, CTAs. Weights 500/700/**800**. |
| `--font-body` | **Inter**, system-ui | Body & UI. 400/500/600/700. |
| `--font-mono` | **JetBrains Mono**, ui-monospace | Uppercase eyebrow labels & timecodes. 500/700. |

### Semantic type scale

Available as CSS vars (`--h1-*` …) and as ready-made classes
(`.vs-h1`/`.vs-h2`/`.vs-h3`/`.vs-body`/`.vs-small`/`.vs-label`/`.vs-code`).

| Style | Family | Size | Weight | Tracking | Leading |
|---|---|---|---|---|---|
| h1 | display | `clamp(2.75rem, 6vw, 4.5rem)` | 800 | −0.02em | 1.05 |
| h2 | display | `clamp(1.75rem, 3vw, 2.25rem)` | 800 | −0.02em | 1.1 |
| h3 | display | 1.25rem | 800 | −0.01em | 1.2 |
| body | body | 1.125rem | 400 | — | 1.6 |
| small | body | 0.875rem | 500 | — | — |
| label (eyebrow) | mono | 0.625rem | 700 | **0.15em** | uppercase |

The **mono uppercase eyebrow label** (`THIS VIDEO IN 30 SECONDS`,
`CARD 03 / 06`, `04:12–06:30`) is a **signature** — use `.vs-label` for all
section eyebrows, timecodes, and status labels. Headlines & body are sentence
case; eyebrows & timecodes are UPPERCASE mono.

---

## Borders, shadows & radii

The defining motifs. **Hard offset shadows with zero blur, foreground ink.**
Never use soft/blurred shadows on hero chrome.

| Token | Value | Utility |
|---|---|---|
| `--border-brutal` | `3px solid var(--foreground)` | `.brutal-border` |
| `--shadow-brutal-sm` | `4px 4px 0 0 var(--foreground)` | `.brutal-shadow-sm` |
| `--shadow-brutal` | `8px 8px 0 0 var(--foreground)` | `.brutal-shadow` |
| `--shadow-brutal-lg` | `12px 12px 0 0 var(--foreground)` | `.brutal-shadow-lg` |
| `--shadow-brutal-hover` | `10px 10px 0 0 var(--foreground)` | — (on lift) |

- Dividers use `--line-soft` (ink @ 12%); "secondary info" insets (analogy box, best/skip callouts) use a **2px dashed** border.
- The only blur in the system is the tutor-modal scrim (`bg-foreground/40 backdrop-blur-sm`) and the subtle focus glow behind the hero input. No glassmorphism, no neumorphism.

### Radius scale (base `--radius: 1.25rem` = 20px)

`sm` 16 · `md` 18 · `lg/base` 20 · `xl` 24 · `2xl` 28 · `3xl` 32 · `4xl` 36 ·
`pill` 9999px. **Cards use 28–32px.** The contrast of big radii against the
square-cornered hard shadow is what makes it friendly-brutalist rather than
harsh. Buttons use `rounded-2xl`/16px; chips `rounded-lg`; status dots & pills
are fully round. Do not switch to sharp enterprise rectangles.

---

## Motion

Spring-y and tactile. Transitions are quick (~0.15–0.4s). Gate entrance
animations behind `@media (prefers-reduced-motion: no-preference)` and fall
back to the visible end-state.

| Token | Value | Feel |
|---|---|---|
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoots then settles — the brand feel. Fills, dials, card-in, toggle thumb. |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Settles without overshoot — utility transitions. |

Three named keyframes (`.animate-float` / `.animate-card-in` / `.animate-pop-in`):

- **float** — `translateY(0→-10px)` + `rotate(-1deg→1deg)`, **6s** loop. The mascot.
- **card-in** — rise + rotate-in (`40px/rotate(2deg)/opacity 0` → `0/rotate(-1deg)/opacity 1`), **0.55s** spring. Player/quiz card entrance.
- **pop-in** — `scale(0.6→1.08→1)` + fade, **0.5s** spring. The done-screen celebration.

### Interaction physics (apply everywhere — this is the brand)

- **Hover:** `translate(-2px, -2px)` and the shadow grows (`--shadow-brutal` → `--shadow-brutal-lg`). Primary button adds `brightness(1.06)`. Outline/secondary buttons & chips **invert to ink** (`bg-foreground text-background`). List items darken their border.
- **Press/active:** `translateY(1–2px)` down and the shadow shrinks to `--shadow-brutal-sm`. The CTA visibly sinks.
- **Focus:** input border darkens to full ink and the shell lifts `-2,-2`; the brand glow fades in behind the hero input.
- **Progress fills / dial sweeps:** animate width / `stroke-dashoffset` over ~500–900ms with `--ease-spring`.

Do not add decorative particle systems, gradient morphing, or scroll spectacle.

---

## Components

Component classes are in [`design-system/ui_kit/kit.css`](./design-system/ui_kit/kit.css);
React references in [`components.jsx`](./design-system/ui_kit/components.jsx).
Live implementations are under `src/components/`.

### Button (`.vs-btn`)
`font-display` 700, `3px solid foreground`, radius 16, `active:translateY(2px)`.
Sizes `lg` 18px/14×24 · `md` 15px/12×20 · `sm` 13px/9×16/2px border.
Variants: **primary** (blue fill, white text, `--shadow-brutal`, hover lift +
brightness, active sink), **ink** (foreground fill, bg-coloured text,
`--shadow-brutal-sm`), **outline** (card bg, ink text, hover inverts to ink),
**quiet** (`.vs-quiet`, mono uppercase 10px label-button, no border, muted →
foreground on hover — used for Previous / Next / Exit). CTAs carry a trailing
arrow: `Generate lesson →`, `Start 5-minute lesson →`, `Quiz time →`.

### Card (`.vs-card`)
White fill, 3px border, radius **32px**, optional `.shadow`/`.sm-shadow`,
padding `.vs-pad` 24 / `.vs-pad-lg` 32. Soft variant `.vs-soft` (2px line-soft,
radius 16). Dashed inset `.vs-dashed` (2px dashed ink@22%, cream bg).

### Lesson card (signature — `LessonCard.tsx`)
A white card (3px border, radius 32, pad 32) with **two coloured cards peeking
out behind it**, slightly rotated, so the stack looks physically dealt: back
card `translate(12px,12px) rotate(2deg)` amber; mid card `translate(6px,6px)
rotate(-1deg)` green; face card `rotate(-1deg)`, entrance via `card-in`. Inside:
a kind chip (top-left) + mono timecode jump-link `@ 12:48 ↗` (top-right), a
display-800 32px title, 18px/1.6 body, optional dashed "analogy" box or a
`4px solid primary` left-border blockquote for "The Quote".

### Kind chips (`.vs-chip`)
10px uppercase 700 pills, 1px border, radius 8. Map: `concept`→amber tint,
`analogy`/`insight`→blue tint, `quote`→green tint, `recap`→amber tint. Labels:
Key Concept / Analogy / The Quote / Insight / Remember This.

### Tone toggle (`ToneToggle.tsx`, `.vs-toggle` + `.vs-seg`)
Segmented control, 2px border, radius 18, `--shadow-brutal-sm`. Active segment =
ink fill, bg text. Four options with **fixed functional emoji**: `💡 Clear`,
`🤝 Friendly`, `😄 Funny`, `🧐 Strict`. These rewrite the lead-in copy on
concept/recap cards live — brand voice as a control.

### Watch Score dial (`WatchScoreDial.tsx`)
SVG ring, r=44, 10px stroke. Track = ink@10%, fill = primary, round linecap,
rotated −90deg. `stroke-dashoffset` animates over **900ms** spring on mount.
Centre: display-800 28px score + mono `/ 10`.

### Attention timeline (`AttentionTimeline.tsx`)
24px-tall pill bar, 3px border, segments split by 3px ink dividers. Segment
colours: `skip`→muted, `watch`→primary@30%, `core`→secondary, `demo`→accent.
Click to seek. Below: a 2-up grid of soft cards (dot, title, timecode, blurb);
hover lifts `-2px` + border darkens.

### Progress bar (`.vs-track` + `.fill`)
12px tall, 3px border, pill. Fill = primary (`.amber` variant = secondary),
`transition: width 0.6s var(--ease-spring)`.

### Input shell (`.vs-input-shell`)
Flex shell, 3px border, radius 28, `--shadow-brutal`; hover lifts `-2,-2` +
shadow grows. Borderless input inside; trailing primary button (hero URL field)
or a 2px-line textarea for feedback.

### Tutor panel (`TutorPanel.tsx`)
Fixed launcher pinned `bottom-6 right-6`: ink pill, `💬 Ask the tutor`. Opens a
modal — the scrim is the only blur (`bg-foreground/40 backdrop-blur-sm`). Card:
3px border, radius 28, `--shadow-brutal`. User bubbles = primary fill
right-aligned; tutor bubbles = cream/line-soft. Seed-question pills (`.vs-pill`,
hover inverts to ink). The tutor **only answers from the transcript** — fallback
is exactly `"I cannot tell from this video."`

### Brand lockup (`Brand.tsx`)
Mascot PNG + "VideoSense" wordmark (display-800, −0.02em), side by side. Hover
rotates the mascot `-6deg`. Sometimes paired with a rotated speech bubble
(`rotate(6deg)`, 3px border, `--shadow-brutal-sm`, "I'm ready!").

---

## Content voice

Copy is load-bearing brand. A sharp, friendly study buddy who respects your
time. Confident, concrete, lightly funny. Never corporate, never hype-y.

- **Person:** talks to **"you"**; the product is **"we"** ("We'll watch the boring parts so you don't have to"). First person singular only from the **mascot** ("I'm ready!", "I cannot tell from this video.").
- **Casing:** headlines & body in **sentence case** (ending periods on headlines are intentional — "Lesson complete.", "in 5 minutes."); eyebrows & timecodes in **UPPERCASE** mono. Buttons in sentence case, usually with a trailing arrow. Numerals always as digits.
- **Tone is a feature:** Clear 💡 (no lead-in), Friendly 🤝 ("Okay — here's the gist: …"), Funny 😄 ("Brace yourself, hot take incoming: …"), Strict 🧐 ("Pay attention.").
- **Verdicts are blunt and kind:** "Skip it", "Watch the core section", "Worth your time"; result labels "Mastered" (≥80%) / "Solid grasp" (≥50%) / "Worth a re-read". Error copy is calm: "Something went sideways."

---

## Iconography & assets

- **Lucide is the official icon set** (`lucide-react`) — thin, rounded, 2px stroke. **Always use Lucide**; do not hand-draw raw-SVG icons when a Lucide glyph exists.
- **Unicode arrows as text** are idiomatic: trailing `→` on CTAs, `↗` on jump links, `←` on back links, `✓`/`✗` on quiz states, `▶` on watch buttons. Treat them as type, not icons.
- **Functional emoji only** on named controls (tone toggle 💡🤝😄🧐, player reactions 🤔✅🥱, tutor 💬). **Never decorative**; headlines and body copy never contain emoji.
- **The mascot** (`src/assets/mascot.png`) is the brand's hero image — use it for empty / loading / celebration states (grayscale on errors). **Do not recolour or redraw it.** There is no separate logo mark beyond the mascot + "VideoSense" wordmark.

---

## Layout

Centred, max-width columns (`max-w-4xl` hero, `max-w-6xl` lesson, `max-w-2xl`
reading views), generous vertical rhythm (`space-y-6`–`space-y-10`), `px-6`
gutters. The lesson hero uses an asymmetric **3/2 grid**; reading screens are
single-column. Backgrounds are **flat cream — no gradients, photos, textures, or
patterns** behind content (the one exception is the subtle focus glow behind the
URL input). Fixed: the tutor launcher at `bottom-6 right-6`.

---

## Adherence checklist (every new surface must pass)

1. Tokens only — pull colour/type/radius/shadow/motion from `src/styles.css`. Never hardcode hex/px shadows; never add a fifth accent hue.
2. Type system intact — Plus Jakarta Sans display, Inter body, JetBrains Mono eyebrows. Use `.vs-label` for eyebrows/timecodes.
3. Heavy 3px ink borders + hard offset shadows on cards, inputs, CTAs, embeds, panels. Dashed 2px for secondary-info insets, `--line-soft` for dividers.
4. Big radii (28–32px cards), full-round pills/dots. No sharp rectangles.
5. Interaction physics — hover lift `-2,-2` + shadow grow; press sink; focus border-darken; spring fills. Invert-to-ink on secondary controls.
6. Motion limited to float / card-in / pop-in / spring transitions; respect reduced-motion.
7. Lucide icons; unicode arrows as text; emoji only as control glyphs.
8. Mascot-led warmth on empty/loading/celebration. Never recolour the mascot.
9. Copy is time-respecting, sentence-case, "you"/"we"/mascot-"I".

## Prohibited

- Generic SaaS dashboard styling, minimal gray UI, or sharp enterprise rectangles.
- Purple gradient / orb / bokeh / abstract decorative backgrounds; any gradient, photo, texture, or pattern behind content.
- Soft / blurred shadows on hero chrome; glassmorphism or neumorphism.
- Replacing the mascot-led identity or the three-font type system.
- A fifth accent hue, or recolouring the four signal accents.
- Decorative emoji in prose; hand-drawn SVG icons where Lucide exists.
- Any redesign that weakens the cream / black-border / hard-shadow / blue-amber-green identity.
