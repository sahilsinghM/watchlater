# CLAUDE.md — WatchLater (watchlater)

Guidance for any agent working in this repo. **Read before touching UI.**

## Content Integrity

Never invent or fabricate content. If source material (chapter text, essay
file, transcript) is empty or truncated, **STOP and report this to the user**
rather than generating content to fill the gap.

## What this is

WatchLater turns a long YouTube video into a playful, interactive **5-minute
lesson**: a colour-coded attention map, a stack of tappable lesson cards, a
3-question quiz with a mastery score, and a transcript-grounded AI tutor.
TanStack Start + React 19 + Tailwind v4 + shadcn/ui (new-york), Supabase-backed.

## Design system is non-negotiable

This product ships **one** design system — the neo-brutalist **"Tactile Field
Guide"**: warm cream paper, white cards, **3px near-black ink borders**, **hard
offset shadows (zero blur)**, **primary blue**, a friendly round mascot, and big
rounded corners. **All current and future design must adhere to it 100%.**

- **Authoritative spec:** [`docs/design-system-reference.md`](./docs/design-system-reference.md)
- **Canonical bundle (tokens, UI kit, motion):** [`docs/design-system/`](./docs/design-system/)
- **Live tokens:** `src/styles.css` — mirrors [`docs/design-system/colors_and_type.css`](./docs/design-system/colors_and_type.css) 1:1.

Before adding or changing any UI, read the reference doc and make the change pass
its **Adherence checklist**. When `src/styles.css` and `colors_and_type.css`
disagree, the latter is correct.

### Hard rules (do not violate without an explicit, documented design decision)

1. **Tokens only.** Use the CSS vars / Tailwind tokens in `src/styles.css`
   (`--primary`, `--foreground`, `--shadow-brutal*`, `--radius-*`, `--ease-*`,
   `.vs-*`, `.brutal-*`). Never hardcode hex colours or px shadow values.
2. **Four accents, no more.** Blue (`--primary`) / amber (`--secondary`) /
   green (`--accent`) / red (`--destructive`). Never add a fifth accent hue or
   recolour these. Use low-alpha tints (`/10`–`/30`) for soft fills.
3. **Three fonts.** Plus Jakarta Sans (display/headings, weight 800, −0.02em),
   Inter (body/UI), JetBrains Mono (uppercase eyebrows & timecodes via
   `.vs-label`). No generic system-font stack.
4. **Heavy borders + hard offset shadows.** `3px solid foreground` + zero-blur
   offset shadows on cards, inputs, CTAs, embeds, panels. Dashed 2px for
   secondary-info insets; `--line-soft` for dividers. No soft/blurred shadows
   on chrome; no glassmorphism or neumorphism.
5. **Big radii** (cards 28–32px, pills fully round). No sharp enterprise
   rectangles.
6. **Interaction physics are the brand.** Hover: lift `-2,-2` + shadow grows;
   secondary controls/chips invert to ink; primary button adds `brightness`.
   Press: sink `translateY(1–2px)` + shadow shrinks. Focus: border darkens to
   full ink. Spring fills (`--ease-spring`) for bars/dials. Respect
   `prefers-reduced-motion`.
7. **Motion** limited to `float` / `card-in` / `pop-in` / spring transitions.
   No particle systems, gradient morphing, or scroll spectacle.
8. **Icons: Lucide** (`lucide-react`). Unicode arrows (`→ ↗ ← ✓ ✗ ▶`) as text.
   **Emoji only** as control glyphs (tone toggle 💡🤝😄🧐, reactions 🤔✅🥱,
   tutor 💬) — never decorative, never in prose. Don't hand-draw SVG icons.
9. **Mascot-led warmth** on empty/loading/celebration states
   (`src/assets/mascot.png`). Never recolour or redraw the mascot. There is no
   other logo mark beyond mascot + "WatchLater" wordmark.
10. **Backgrounds are flat cream.** No gradients, photos, textures, or patterns
    behind content (only the subtle focus glow behind the hero URL input).

### Copy voice

Time-respecting, plain-spoken, lightly cheeky. Talk to **"you"**; the product is
**"we"**; first-person singular only from the mascot. Headlines & body in
sentence case (ending periods intentional); eyebrows & timecodes in UPPERCASE
mono. CTAs get a trailing arrow. Numerals as digits.

### Prohibited

Generic SaaS dashboard / gray minimalist UI; purple gradient/orb/bokeh
aesthetic; soft shadows on chrome; glass/neumorphism; mascot-free identity;
replacing the fonts or palette; decorative emoji. Any of these is a design
regression — flag it instead of shipping it.

## Development Workflow

- Package manager: `bun` (`bun install`, `bun run dev`, `bun run build`, `bun test`, `bun run lint`).
- Keep the four signal colours semantically consistent: skip→muted, watch→blue, core→amber, demo/correct→green, wrong/error→red.
- **Strict TDD for all feature work:** write failing tests first, implement to
  make them pass, then run the full test suite (`bun test`) and build
  (`bun run build`) before opening a PR.
- Follow the pipeline: **PRD → issues → TDD → QA → review → ship**.

## Security checklist

- Before every commit, verify `.env` and any secrets files are gitignored.
  Never commit real credentials or service-role keys (one leaked to the public
  repo before — do not repeat this).
- Confirm DB migrations are applied to the **remote** database before declaring
  a persistence feature complete. Local-only migration = unshipped feature.

## Known Issues / Gotchas

- **YouTube transcript ingestion fails on datacenter IPs** (Vercel, Replicate,
  etc.) due to IP blocking — this is not a code bug. Route through a proxy
  (Supadata) rather than re-attempting headless Chrome scraping.

## QA / Browser Testing

- When generating screenshots or mockups for the user, capture to `/tmp` and
  serve over HTTP so the user can actually view them — do not render only in
  your own view.
