# VideoSense — Design System

> **VideoSense** turns any long YouTube video into a playful, interactive **5-minute lesson**: a colour-coded attention map, a stack of tappable lesson cards, a 3-question quiz with a mastery score, and a transcript-grounded AI tutor. *"Paste a YouTube link. We'll watch the boring parts so you don't have to."*

This folder is a **design system**: brand foundations, colour + type tokens, real assets, documented motifs, and a high-fidelity **UI kit** that recreates the product's screens. Use it to design new VideoSense surfaces — slides, marketing pages, product mocks, throwaway prototypes — that look and feel native to the brand.

---

## What the product is

VideoSense (internal repo name: **watchlater**) is a single-page web app built with **TanStack Start + React 19 + Tailwind v4 + shadcn/ui (new-york)**, lovable.dev–scaffolded, Supabase-backed. The core loop:

1. **Landing** — paste a YouTube URL into a big bordered input.
2. **Processing** — a stepper ("Reading the transcript… Finding the key moments…") while the lesson is built.
3. **Lesson hero** — "This video in 30 seconds", a **Watch Score** dial (0–10), an **Attention map** timeline (skip / watch / core / demo), best-part / skip-part callouts, and a recommendation verdict.
4. **Player** — swipeable **lesson cards** (Key Concept, Analogy, The Quote, Insight, Remember This) with a tone toggle (Clear / Friendly / Funny / Strict) and per-card video jump.
5. **Quiz** — 3 questions, instant reveal + explanation.
6. **Done** — a big mastery %, "If you want more" pointer, and a feedback prompt.

A floating **"Ask the tutor"** panel is available throughout — it only answers from the transcript ("I cannot tell from this video.").

The design system is named, in the source itself, the **"Tactile Field Guide"**: *heavy black borders, hard offset shadows, cream background, primary blue.* It's a warm, confident **neo-brutalist** style with a friendly round mascot.

### Mascot
A cheerful round **blue** character with rosy cheeks, holding a little play-button card — see `assets/mascot.png`. It floats on the landing page, celebrates on the done screen, and goes grayscale on errors. It is the brand's primary emotional anchor; reach for it before any abstract logo.

---

## Source

This system was reverse-engineered from a real codebase. The reader is encouraged to explore it for deeper fidelity:

- **GitHub:** [`sahilsinghM/watchlater`](https://github.com/sahilsinghM/watchlater) — `main` branch.
  - Design tokens: `src/styles.css` (Tailwind v4 `@theme`, oklch).
  - Brand + mascot: `src/components/Brand.tsx`, `src/assets/mascot.png`.
  - Signature components: `LessonCard.tsx`, `AttentionTimeline.tsx`, `WatchScoreDial.tsx`, `ToneToggle.tsx`, `TutorPanel.tsx`, `YouTubeEmbed.tsx`.
  - Screens: `src/routes/index.tsx`, `processing.$videoId.tsx`, `lesson.$videoId.tsx`, `…player.tsx`, `…quiz.tsx`, `…done.tsx`.
  - UI primitives: `src/components/ui/*` (shadcn/ui, new-york style, lucide icons).

> Note: the repo's UI primitives still use the default shadcn slate tokens in a few places, but the **product chrome** (everything custom) commits hard to the brutalist look defined in `styles.css`. This design system documents the *product* look, which is the source of truth.

---

## CONTENT FUNDAMENTALS

How VideoSense writes. Copy is a load-bearing part of the brand — it's playful, plain-spoken, and a little cheeky, but never wastes the reader's time.

**Voice:** A sharp, friendly study buddy who respects your time. Confident, concrete, lightly funny. Never corporate, never hype-y.

**Person:** Talks to **"you"**, and the product is **"we"** ("**We'll** watch the boring parts so **you** don't have to"). First person singular only ever comes from the **mascot** ("I'm ready!", "I cannot tell from this video.").

**Casing:**
- Headlines & body: **sentence case** ("Understand any long video in 5 minutes.", "What you get from every video").
- Tiny eyebrow labels & timecodes: **UPPERCASE**, mono, wide-tracked ("THIS VIDEO IN 30 SECONDS", "BEST PART · 04:12–06:30", "CARD 03 / 06").
- Buttons: sentence case, often with a trailing arrow ("Generate lesson →", "Start 5-minute lesson →", "Quiz time →").

**Tone is literally a feature.** The product ships four named tones the user can toggle, which is the clearest statement of brand voice you'll find:
- **Clear** 💡 — no lead-in, just the fact.
- **Friendly** 🤝 — "Okay — here's the gist: …"
- **Funny** 😄 — "Brace yourself, hot take incoming: …", "Tattoo this on your forearm: …"
- **Strict** 🧐 — "Pay attention." / "Do not forget: …"

**Recurring phrasings & vibe:**
- Time-respecting promises: *"in 5 minutes"*, *"This video in 30 seconds"*, *"You moved through a 47-minute video in five."*
- Honest, self-aware system copy: *"Watching the boring parts so you don't have to."*, *"Finding where the creator finally gets to the point."*, *"Making sure it's earned, not gifted."*
- Verdicts are blunt and kind: *"Skip it"*, *"Do the lesson only"*, *"Watch the core section"*, *"Worth your time"*.
- Result labels reward honestly: *"Mastered"* (≥80%), *"Solid grasp"* (≥50%), *"Worth a re-read"* (below).
- Error copy is calm and human: *"Something went sideways."*, *"This is usually transient — try again or pick another video."*

**Punctuation:** em dashes and colons for the conversational beat; **ending periods on headlines** are common and intentional ("Lesson complete.", "in 5 minutes."). Numerals always as digits.

**Emoji:** Used **sparingly and functionally**, not decoratively — only as fixed glyphs on interactive controls: the four tone toggles (💡🤝😄🧐), the three player reactions (🤔 Explain more · ✅ Got it · 🥱 Too basic), and the tutor launcher (💬). Body copy and headlines never contain emoji. Don't sprinkle emoji into prose.

---

## VISUAL FOUNDATIONS

The look is **neo-brutalist "Tactile Field Guide"** — like a well-designed printed field manual: cream paper, heavy ink borders, cards that cast hard shadows as if physically stacked, and a few confident pops of colour. Everything feels tactile, slightly playful, and nothing is timid.

**Colour vibe.** Warm **cream** page (`--background`), crisp **white** cards, near-black cool **ink** for all structure and text. Three saturated accents do all the signalling: **blue** (primary — the "watch / active" colour, matches the mascot), **amber/orange** (secondary — "core"), **green** (accent — "good / correct / demo"), plus **red** for destructive/wrong. Accents appear at full strength on fills and as low-alpha tints (`/10`–`/30`) for soft backgrounds. Colours are authored in **oklch** for consistent lightness.

**Type.** Three families: **Plus Jakarta Sans** (extrabold, `-0.02em` tracking) for all display/headings and the brand wordmark; **Inter** for body and UI; **JetBrains Mono** for the uppercase wide-tracked eyebrow labels and timecodes. The mono labels are a signature — small, `0.15em`+ letter-spacing, uppercase, muted.

**Borders.** The defining motif: a **3px solid near-black border** (`.brutal-border`) on cards, inputs, buttons, the timeline, the mascot's speech bubble. Softer UI dividers use ink at 10–12% alpha. Dashed 2px borders (`border-dashed`) mark "secondary information" insets (the analogy box, best/skip callouts).

**Shadows.** No soft blurred shadows on the hero chrome — instead **hard offset drop shadows** with zero blur: `4px 4px 0`, `8px 8px 0`, `12px 12px 0` of the foreground ink (`--shadow-brutal*`). On hover, elements **translate up-left** by ~0.5–2px and the shadow grows (e.g. to `10px 10px 0`), so the card appears to lift off the page. This is the single most important interaction detail.

**Corner radii.** Generously rounded — base radius is **20px**, and signature cards go bigger: `rounded-[28px]` to `rounded-[32px]`. Small chips/badges use `rounded-lg`/`rounded-md`; pills (tutor seeds, status dots) are fully round. The combination of *big radii + heavy square-cornered shadow* is what makes it feel friendly-brutalist rather than harsh.

**Cards.** White fill, 3px border, hard offset shadow, big radius, generous padding (`p-6`–`p-10`). Lesson cards are layered: two coloured cards (secondary + accent) peek out behind, slightly rotated (`rotate-2`, `-rotate-1`), so the stack looks physically dealt.

**Rotation & playfulness.** Slight **rotations** are intentional and recurring — cards sit at `-1deg`/`2deg`, speech bubbles at `rotate-6`, the mascot floats with a gentle rotate. Used in small doses to feel hand-placed, never chaotic.

**Backgrounds.** Flat cream — **no gradients, no photos, no textures, no patterns** behind content. The one gradient in the system is a subtle focus glow (`blur-xl`, primary @ 10%) that fades in behind the URL input on focus. Imagery = the mascot PNG and (in-product) YouTube thumbnails/embeds only. There are no decorative illustrations beyond the mascot.

**Animation.** Spring-y and tactile. The house easing is `--ease-spring` = `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoots, then settles); the secondary `--ease-out` = `cubic-bezier(0.16, 1, 0.3, 1)` settles without overshoot. Three named keyframes (all in `colors_and_type.css`, ready as `.animate-float` / `.animate-card-in` / `.animate-pop-in`): **float** (mascot bob + rotate, 6s loop), **card-in** (rise + rotate-in, used by the player/quiz), **pop-in** (scale 0.6→1.08→1, the celebration). Hover lifts elements `−2,−2` while the offset shadow grows; press sinks them `translateY(1–2px)`. Progress bars and dials animate their width/offset over ~500–900ms with the spring ease. Transitions are quick (0.4s). Reduced-motion should fall back to the visible end-state. Live specimens: `preview/motion-keyframes.html`, `preview/motion-easing.html`, `preview/motion-press.html` (rest → hover lift → press sink across buttons, reaction tiles, the tone toggle, and inputs), and `preview/motion-progress.html` (lesson/quiz bars, the processing stepper, the Watch Score dial sweep, and the attention-map assembly) — the **Motion** group in the Design System tab.

**Hover states.** Lift (translate up/left) + shadow grow on the big CTAs and cards; **invert to ink** (`hover:bg-foreground hover:text-background`) on secondary buttons and chips; brightness bump (`hover:brightness-110`) on the primary blue button; subtle border-darken on list items. Links/labels go from muted → foreground or → primary.

**Press / active states.** Physical: buttons **`active:translate-y-1`** (press down) or `active:translate-y-0.5`. The primary CTA visibly sinks on click.

**Focus.** Inputs use a 2px border that darkens to full ink on `focus-within`; the brand glow fades in behind the hero input. Form controls keep the heavy-border language.

**Transparency & blur.** Used only for overlays: the tutor modal scrim is `bg-foreground/40 backdrop-blur-sm`. Otherwise surfaces are opaque. Tint alphas (`/10`–`/30`) are used for coloured fills, not for glassmorphism.

**Layout rules.** Centred, max-width columns (`max-w-4xl` hero, `max-w-6xl` lesson, `max-w-2xl` reading views), generous vertical rhythm (`space-y-6`–`space-y-10`), `px-6` gutters. The lesson hero uses an asymmetric 3/2 grid. Fixed elements: the **tutor launcher** pinned `bottom-6 right-6`. Content is single-column and readable on the reading screens; the marketing page uses 3-up feature grids.

**Iconography.** See below — overwhelmingly **lucide** (the codebase's icon library) plus a few hand-placed unicode arrows and functional emoji.

---

## ICONOGRAPHY

- **Primary icon set: [Lucide](https://lucide.dev)** (`lucide-react`, declared in `components.json` and `package.json`). This is the official set for VideoSense — thin, rounded, consistent 2px stroke, which sits well against the heavy borders. **Always use Lucide** for UI icons (chevrons, play, search, close, check, etc.). In static HTML, load it from CDN:
  ```html
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>lucide.createIcons();</script>
  <!-- usage: <i data-lucide="play"></i> -->
  ```
  The UI kit in this system uses Lucide via CDN. **Do not hand-draw icons as raw SVG** when a Lucide glyph exists.
- **Unicode arrows as text** are idiomatic and everywhere — trailing `→` on CTAs, `↗` on jump links, `←` on back links, `✓`/`✗` on quiz states, `▶` on "watch" buttons. Treat these as part of the type, not as icons.
- **Functional emoji** appear only on a few named controls (tone toggle, player reactions, tutor launcher) — see Content Fundamentals. Never decorative.
- **The mascot** (`assets/mascot.png`) is the brand's hero image — use it for empty/loading/celebration states. Don't recolour or redraw it.
- There is **no separate logo mark** beyond the mascot + the "VideoSense" wordmark (Plus Jakarta Sans extrabold). The lockup is: mascot image + wordmark, side by side (`components/Brand.tsx`).

---

## Index — what's in this folder

| Path | What it is |
|---|---|
| `README.md` | This file — product context, content + visual foundations, iconography. |
| `colors_and_type.css` | All colour + type tokens (oklch), radii, the brutal shadow/border system, semantic classes, keyframes. Import this first. |
| `assets/mascot.png` | The VideoSense mascot — the brand's hero image. |
| `preview/` | Small HTML specimen cards that populate the Design System tab (colours, type, shadows, components). |
| `ui_kits/videosense/` | High-fidelity, interactive recreation of the product. `index.html` is a click-through of the whole flow; `*.jsx` are reusable components. |
| `SKILL.md` | Agent-Skills manifest so this system can be used as a downloadable skill. |

**To design with this system:** import `colors_and_type.css`, pull components/patterns from `ui_kits/videosense/`, use the mascot from `assets/`, load Lucide from CDN, and follow the foundations above. Keep the borders heavy, the shadows hard-offset, the copy time-respecting, and reach for the mascot whenever a screen needs warmth.
